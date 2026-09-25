/// <reference lib="webworker" />
// Runs the writing engine off the main thread so typing never waits on a check.
import {
  type Analysis,
  Engine,
  type EngineSettings,
  type Goals,
  type LocalRewriteMode,
  localRewrite,
  RULE_INFO,
  type Suggestion,
} from '@oppenly/engine';
import { createBinaryModuleFromUrl } from 'harper.js';

export type WorkerRequest =
  | { id: number; t: 'init'; settings: Partial<EngineSettings> }
  | { id: number; t: 'settings'; settings: Partial<EngineSettings> }
  | { id: number; t: 'analyze'; text: string; goals: Goals; extra: Suggestion[] }
  | { id: number; t: 'rewrite'; text: string; mode: LocalRewriteMode }
  | { id: number; t: 'rules' };

export type WorkerReply =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

let engine: Engine | null = null;
let ready: Promise<Engine> | null = null;

function start(settings: Partial<EngineSettings>): Promise<Engine> {
  ready ??= (async () => {
    const binary = createBinaryModuleFromUrl(new URL('/harper.wasm', self.location.origin).href);
    const e = new Engine(binary);
    await e.init(settings);
    engine = e;
    return e;
  })();
  return ready;
}

async function handle(msg: WorkerRequest): Promise<unknown> {
  switch (msg.t) {
    case 'init':
      await start(msg.settings);
      return null;
    case 'settings':
      if (engine) await engine.updateSettings(msg.settings);
      else await start(msg.settings);
      return null;
    case 'analyze': {
      const e = await (ready ?? start({}));
      const analysis: Analysis = await e.analyze(msg.text, msg.extra, msg.goals);
      return analysis;
    }
    case 'rewrite':
      return localRewrite(msg.text, msg.mode);
    case 'rules':
      return RULE_INFO;
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    const result = await handle(msg);
    self.postMessage({ id: msg.id, ok: true, result } satisfies WorkerReply);
  } catch (err) {
    self.postMessage({
      id: msg.id,
      ok: false,
      error: (err as Error).message,
    } satisfies WorkerReply);
  }
};
