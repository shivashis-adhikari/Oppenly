import type {
  Analysis,
  EngineSettings,
  Goals,
  LocalRewriteMode,
  RuleInfo,
  Suggestion,
} from '@oppenly/engine';
import type { WorkerReply, WorkerRequest } from './engine.worker';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Body<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Talks to the engine worker. One worker serves the whole app. */
class EngineClient {
  private worker: Worker | null = null;
  private next = 1;
  private pending = new Map<number, Pending>();

  private call<T>(body: Body<WorkerRequest>): Promise<T> {
    if (!this.worker) {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.ok) p.resolve(e.data.result);
        else p.reject(new Error(e.data.error));
      };
    }
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker!.postMessage({ ...body, id } as WorkerRequest);
    });
  }

  init(settings: Partial<EngineSettings>): Promise<void> {
    return this.call({ t: 'init', settings });
  }

  configure(settings: Partial<EngineSettings>): Promise<void> {
    return this.call({ t: 'settings', settings });
  }

  analyze(text: string, goals: Goals, extra: Suggestion[] = []): Promise<Analysis> {
    return this.call({ t: 'analyze', text, goals, extra });
  }

  rewrite(text: string, mode: LocalRewriteMode): Promise<string> {
    return this.call({ t: 'rewrite', text, mode });
  }

  rules(): Promise<RuleInfo[]> {
    return this.call({ t: 'rules' });
  }
}

export const engine = new EngineClient();
export const loadRules = () => engine.rules();
