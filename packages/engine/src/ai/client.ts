import { onDeviceChat } from './on-device';
import { getPreset, type ProviderConfig, type ProviderPreset } from './providers';

export class ConsentRequiredError extends Error {
  constructor(provider: string) {
    super(
      `Oppenly will not send text to ${provider} until you agree on the provider settings page.`,
    );
    this.name = 'ConsentRequiredError';
  }
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** Sends one HTTP request. Defaults to `fetch`; the local web app routes through its relay. */
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

let transport: Transport = (url, init) => fetch(url, init);

/** Replace how provider requests are sent. Consent and address checks still run first. */
export function setTransport(next: Transport): void {
  transport = next;
}

export interface ChatRequest {
  system: string;
  user: string;
  model: string;
  /** Ask for a JSON object (enables provider JSON modes where supported). */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Receive text as it streams in. When omitted the request is not streamed. */
  onText?: (fullTextSoFar: string) => void;
}

/**
 * The only function in Oppenly that sends text off the device. It refuses to run without the
 * user's recorded consent for this provider, and only talks to the configured base URL.
 */
export async function chat(config: ProviderConfig, req: ChatRequest): Promise<string> {
  const preset = getPreset(config.presetId);
  if (!preset) throw new ProviderError(`Unknown provider “${config.presetId}”.`, null);
  if (!preset.local && !config.consentedAt) throw new ConsentRequiredError(preset.name);
  if (preset.protocol === 'on-device') {
    return onDeviceChat(req.system, req.user, {
      json: req.json,
      signal: req.signal,
      onText: req.onText,
    });
  }
  const base = normalizeBase(config.baseUrl || preset.baseUrl);

  switch (preset.protocol) {
    case 'openai':
      return openAIChat(base, preset, config, req, false);
    case 'azure':
      return openAIChat(base, preset, config, req, true);
    case 'anthropic':
      return anthropicChat(base, config, req);
    case 'gemini':
      return geminiChat(base, config, req);
    case 'bedrock':
      return bedrockChat(base, config, req);
  }
  throw new ProviderError(`Unsupported protocol ${preset.protocol}.`, null);
}

/** List available model ids, when the provider supports it. */
export async function listModels(config: ProviderConfig): Promise<string[]> {
  const preset = getPreset(config.presetId);
  if (!preset?.listsModels) return [];
  if (!preset.local && !config.consentedAt) throw new ConsentRequiredError(preset.name);
  const base = normalizeBase(config.baseUrl || preset.baseUrl);
  if (preset.protocol === 'gemini') {
    const res = await request(`${base}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': config.apiKey },
    });
    const data = (await res.json()) as {
      models?: { name: string; supportedGenerationMethods?: string[] }[];
    };
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  }
  if (preset.protocol === 'anthropic') {
    const res = await request(`${base}/models?limit=100`, { headers: anthropicHeaders(config) });
    const data = (await res.json()) as { data?: { id: string }[] };
    return (data.data ?? []).map((m) => m.id);
  }
  const res = await request(`${base}/models`, { headers: bearer(config) });
  const data = (await res.json()) as {
    data?: { id: string }[];
    models?: { id?: string; name?: string }[];
  };
  const list = data.data ?? data.models ?? [];
  return list
    .map((m) => ('id' in m && m.id ? m.id : ((m as { name?: string }).name ?? '')))
    .filter(Boolean);
}

function normalizeBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (
    parsed.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  ) {
    throw new ProviderError('For your security, remote providers must use https.', null);
  }
  return trimmed;
}

async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await transport(url, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ProviderError(
      'Could not reach the provider. Check the address and your connection.',
      null,
    );
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      detail =
        typeof body.error === 'string' ? body.error : (body.error?.message ?? body.message ?? '');
    } catch {
      /* body was not JSON */
    }
    const hint =
      res.status === 401 || res.status === 403
        ? 'The API key was rejected.'
        : res.status === 404
          ? 'The model or address was not found.'
          : res.status === 429
            ? 'The provider is rate-limiting requests. Try again shortly.'
            : `The provider returned an error (${res.status}).`;
    throw new ProviderError(detail ? `${hint} ${detail}` : hint, res.status);
  }
  return res;
}

function bearer(config: ProviderConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}

function anthropicHeaders(config: ProviderConfig): Record<string, string> {
  return {
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
    // Required for calls from browser contexts; the key belongs to the user.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/** Read a server-sent-events stream, calling `onData` with each `data:` payload. */
async function readSSE(res: Response, onData: (data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf('\n');
    while (idx >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data && data !== '[DONE]') onData(data);
      }
      idx = buffer.indexOf('\n');
    }
  }
}

async function openAIChat(
  base: string,
  preset: ProviderPreset,
  config: ProviderConfig,
  req: ChatRequest,
  azure: boolean,
): Promise<string> {
  const url = azure
    ? `${base}/openai/deployments/${encodeURIComponent(req.model)}/chat/completions?api-version=2024-10-21`
    : `${base}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(azure ? { 'api-key': config.apiKey } : bearer(config)),
  };
  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.user },
    ],
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.maxTokens)
    body[preset.id === 'openai' ? 'max_completion_tokens' : 'max_tokens'] = req.maxTokens;
  if (req.json && preset.jsonMode) body.response_format = { type: 'json_object' };
  if (req.onText) body.stream = true;

  const send = () =>
    request(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal });

  let res: Response;
  try {
    res = await send();
  } catch (err) {
    // Some models reject optional parameters. Drop them and retry once.
    if (
      err instanceof ProviderError &&
      err.status === 400 &&
      /temperature|max_tokens|max_completion_tokens|response_format/i.test(err.message)
    ) {
      delete body.temperature;
      delete body.response_format;
      if ('max_completion_tokens' in body) {
        body.max_tokens = body.max_completion_tokens;
        delete body.max_completion_tokens;
      } else if ('max_tokens' in body && /max_tokens/.test(err.message)) {
        body.max_completion_tokens = body.max_tokens;
        delete body.max_tokens;
      }
      res = await send();
    } else {
      throw err;
    }
  }

  if (req.onText) {
    let text = '';
    await readSSE(res, (data) => {
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const piece = chunk.choices?.[0]?.delta?.content;
      if (piece) {
        text += piece;
        req.onText!(text);
      }
    });
    return text;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

async function anthropicChat(
  base: string,
  config: ProviderConfig,
  req: ChatRequest,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? 2048,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.onText) body.stream = true;
  const res = await request(`${base}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...anthropicHeaders(config) },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (req.onText) {
    let text = '';
    await readSSE(res, (data) => {
      const event = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
      if (event.type === 'content_block_delta' && event.delta?.text) {
        text += event.delta.text;
        req.onText!(text);
      }
    });
    return text;
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

async function geminiChat(base: string, config: ProviderConfig, req: ChatRequest): Promise<string> {
  const body = {
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: [{ text: req.user }] }],
    generationConfig: {
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      ...(req.json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const model = encodeURIComponent(req.model.replace(/^models\//, ''));
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey };
  type Chunk = { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const textOf = (c: Chunk) =>
    (c.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (req.onText) {
    const res = await request(`${base}/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: req.signal,
    });
    let text = '';
    await readSSE(res, (data) => {
      text += textOf(JSON.parse(data) as Chunk);
      req.onText!(text);
    });
    return text;
  }
  const res = await request(`${base}/models/${model}:generateContent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });
  return textOf((await res.json()) as Chunk);
}

async function bedrockChat(
  base: string,
  config: ProviderConfig,
  req: ChatRequest,
): Promise<string> {
  const res = await request(`${base}/model/${encodeURIComponent(req.model)}/converse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(config) },
    body: JSON.stringify({
      system: [{ text: req.system }],
      messages: [{ role: 'user', content: [{ text: req.user }] }],
      inferenceConfig: {
        ...(req.maxTokens ? { maxTokens: req.maxTokens } : {}),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
    }),
    signal: req.signal,
  });
  const data = (await res.json()) as { output?: { message?: { content?: { text?: string }[] } } };
  const text = (data.output?.message?.content ?? []).map((c) => c.text ?? '').join('');
  req.onText?.(text);
  return text;
}
