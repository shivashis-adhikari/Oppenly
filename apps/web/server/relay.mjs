// The local AI relay. It runs on the user's own computer, next to the web app, and forwards
// requests to the AI provider the user configured. Browsers block most provider APIs from web
// pages (CORS), so the app cannot call them directly. Nothing here stores or logs text or keys.
import { timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';

const MAX_BODY = 4 * 1024 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Only headers providers need. Cookies, origin and referrer are never forwarded.
const FORWARD_HEADERS = [
  'accept',
  'content-type',
  'authorization',
  'api-key',
  'x-api-key',
  'x-goog-api-key',
  'anthropic-version',
  'anthropic-beta',
];

/** Is `host` (a Host header) this server? Rejecting others blocks DNS-rebinding attacks. */
export function isOwnHost(host, port) {
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`;
}

/** Only https providers, or providers running on this computer. */
export function isAllowedTarget(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
}

function sameToken(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

function fail(res, status, message) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error: { message } }));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('too large');
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/**
 * Handles `/relay`. The app sends the provider URL in `x-oppenly-target` and the per-launch
 * secret in `x-oppenly-token`. Other websites cannot read the token, so they cannot use the relay.
 */
export async function handleRelay(req, res, { token, port }) {
  if (!isOwnHost(req.headers.host, port)) return fail(res, 403, 'Wrong host.');
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return fail(res, 403, 'Wrong origin.');
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin') return fail(res, 403, 'Cross-site request.');
  if (!sameToken(req.headers['x-oppenly-token'], token)) return fail(res, 403, 'Missing token.');
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed.');

  const target = String(req.headers['x-oppenly-target'] ?? '');
  if (!isAllowedTarget(target)) {
    return fail(res, 400, 'Providers must use https, or run on this computer.');
  }

  let body;
  try {
    body = req.method === 'POST' ? await readBody(req) : undefined;
  } catch {
    return fail(res, 413, 'Request too large.');
  }

  const headers = {};
  for (const name of FORWARD_HEADERS) {
    const value = req.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }

  const controller = new AbortController();
  res.on('close', () => controller.abort());
  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) return;
    return fail(res, 502, `Could not reach the provider (${err.cause?.code ?? err.message}).`);
  }

  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body)
    .on('error', () => res.destroy())
    .pipe(res);
}
