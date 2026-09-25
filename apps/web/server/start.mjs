// Runs the Oppenly web app on this computer: `pnpm web` from the repository root.
// Serves the built app on http://localhost:4870 and the local AI relay. Listens on the loopback
// interface only, so other devices on the network cannot connect.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRelay, isOwnHost } from './relay.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
const args = new Set(process.argv.slice(2));
// The port is fixed on purpose: your documents are stored by the browser for this exact address.
const port = Number(process.env.OPPENLY_PORT ?? 4870);
const url = `http://localhost:${port}`;

if (!existsSync(path.join(dist, 'index.html')) || args.has('--build')) {
  process.stdout.write('Building the Oppenly web app (first run only)…\n');
  const result = spawnSync('pnpm', ['build'], {
    cwd: path.resolve(here, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const token = randomBytes(24).toString('base64url');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// The page may only talk to this server. Even a bug in the app cannot send text anywhere else.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

async function index() {
  // Read on every request so a rebuild while running is picked up.
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  return html.replace('%OPPENLY_RELAY_TOKEN%', token);
}

const server = createServer(async (req, res) => {
  const host = req.headers.host ?? '';
  if (!isOwnHost(host, port)) {
    res.writeHead(421, { 'content-type': 'text/plain' });
    return res.end('Open Oppenly at ' + url);
  }
  // Keep one address so the browser always finds the same documents.
  if (host.startsWith('127.0.0.1')) {
    res.writeHead(308, { location: url + (req.url ?? '/') });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', url).pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (pathname === '/relay') return handleRelay(req, res, { token, port });
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }

  const file = path.normalize(path.join(dist, pathname));
  const inside = file.startsWith(dist + path.sep);
  const ext = path.extname(file);
  if (inside && ext && existsSync(file)) {
    const body = await readFile(file);
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  if (ext) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'content-type': TYPES['.html'],
    'cache-control': 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : await index());
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    process.stderr.write(
      `Port ${port} is busy. Oppenly may already be running: open ${url}\n` +
        'To use another port, set OPPENLY_PORT (your documents are stored per address).\n',
    );
    process.exit(1);
  }
  throw err;
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`\n  Oppenly is running at ${url}\n  Press Ctrl+C to stop.\n\n`);
  if (!args.has('--no-open') && !process.env.CI) openBrowser(url);
});

function openBrowser(target) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const commandArgs = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
  // Opening the browser is a convenience; the address is printed above either way.
  const child = spawn(command, commandArgs, { stdio: 'ignore', detached: true });
  child.on('error', () => undefined);
  child.unref();
}
