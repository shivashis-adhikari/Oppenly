/**
 * Chrome's built-in model (Gemini Nano) through the Prompt API. The model runs on the user's
 * device; no text leaves the computer. Availability depends on the browser and hardware.
 */

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

interface LanguageModelSession {
  prompt(
    input: string,
    options?: { signal?: AbortSignal; responseConstraint?: unknown },
  ): Promise<string>;
  promptStreaming(
    input: string,
    options?: { signal?: AbortSignal },
  ): ReadableStream<string> & AsyncIterable<string>;
  destroy(): void;
}

interface LanguageModelStatic {
  availability(options?: unknown): Promise<Availability>;
  create(options?: unknown): Promise<LanguageModelSession>;
}

function api(): LanguageModelStatic | null {
  const g = globalThis as unknown as { LanguageModel?: LanguageModelStatic };
  return g.LanguageModel ?? null;
}

const LANGS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};

export async function onDeviceAvailability(): Promise<Availability> {
  const lm = api();
  if (!lm) return 'unavailable';
  try {
    return await lm.availability(LANGS);
  } catch {
    return 'unavailable';
  }
}

export const EDITS_SCHEMA = {
  type: 'object',
  properties: {
    edits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          find: { type: 'string' },
          before: { type: 'string' },
          replace: { type: 'string' },
          category: { type: 'string', enum: ['correctness', 'clarity', 'engagement', 'delivery'] },
          title: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['find', 'before', 'replace', 'category', 'title', 'explanation'],
      },
    },
  },
  required: ['edits'],
};

export async function onDeviceChat(
  system: string,
  user: string,
  opts: {
    json?: boolean;
    signal?: AbortSignal;
    onText?: (text: string) => void;
    onDownload?: (fraction: number) => void;
  } = {},
): Promise<string> {
  const lm = api();
  if (!lm) throw new Error('This browser does not provide an on-device model.');
  const session = await lm.create({
    ...LANGS,
    initialPrompts: [{ role: 'system', content: system }],
    signal: opts.signal,
    monitor(m: EventTarget) {
      m.addEventListener('downloadprogress', (e) =>
        opts.onDownload?.((e as unknown as { loaded: number }).loaded),
      );
    },
  });
  try {
    if (opts.onText && !opts.json) {
      let text = '';
      for await (const chunk of session.promptStreaming(user, { signal: opts.signal })) {
        text += chunk;
        opts.onText(text);
      }
      return text;
    }
    return await session.prompt(user, {
      signal: opts.signal,
      ...(opts.json ? { responseConstraint: EDITS_SCHEMA } : {}),
    });
  } finally {
    session.destroy();
  }
}
