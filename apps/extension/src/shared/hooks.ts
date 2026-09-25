import { useEffect, useState } from 'preact/hooks';
import type { AiStatus, RuntimeRequest } from './messages';
import { getSettings, onSettingsChanged, type Settings, updateSettings } from './settings';

/** Live settings for extension pages. */
export function useSettings(): [
  Settings | null,
  (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => Promise<Settings>,
] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getSettings().then(setSettings);
    return onSettingsChanged(setSettings);
  }, []);
  return [settings, updateSettings];
}

/** Send a request to the background worker and unwrap its `{ ok, result | error }` reply. */
export async function request<T>(message: RuntimeRequest): Promise<T> {
  const reply = (await browser.runtime.sendMessage(message)) as
    | { ok: boolean; result?: T; error?: string }
    | undefined;
  if (!reply) throw new Error('Oppenly is starting. Try again in a moment.');
  if (!reply.ok) throw new Error(reply.error ?? 'Something went wrong.');
  return reply.result as T;
}

export function useAiStatus(deps: unknown[] = []): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    void request<AiStatus>({ t: 'ai-status' })
      .then(setStatus)
      .catch(() => setStatus({ ready: false, provider: null, local: true }));
  }, deps);
  return status;
}
