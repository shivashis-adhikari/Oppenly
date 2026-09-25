import type { Goals } from '@oppenly/engine';
import { COMMON_DEFAULTS, type CommonSettings } from '@oppenly/ui/settings-model';

export { DIALECTS, engineSettingsFor } from '@oppenly/ui/settings-model';

/** Everything the user can change. Stored in `chrome.storage.local` (never synced, never uploaded). */
export interface Settings extends CommonSettings {
  /** Master switch. */
  enabled: boolean;
  /** Epoch ms until which checking is paused everywhere; 0 when not paused. */
  pausedUntil: number;
  /** Hostnames where the user turned Oppenly off. */
  disabledSites: string[];
  /** Show the Oppenly button inside text fields. */
  showButton: boolean;
  /** Per-site goals, keyed by hostname. */
  siteGoals: Record<string, Goals>;
  welcomeSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  ...COMMON_DEFAULTS,
  enabled: true,
  pausedUntil: 0,
  disabledSites: [],
  showButton: true,
  siteGoals: {},
  welcomeSeen: false,
};

const KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored, ai: { ...DEFAULT_SETTINGS.ai, ...stored?.ai } };
}

export async function updateSettings(
  patch: Partial<Settings> | ((s: Settings) => Partial<Settings>),
): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  await browser.storage.local.set({ [KEY]: next });
  return next;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !changes[KEY]) return;
    const value = changes[KEY].newValue as Partial<Settings> | undefined;
    cb({ ...DEFAULT_SETTINGS, ...value, ai: { ...DEFAULT_SETTINGS.ai, ...value?.ai } });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Is checking active on `host` right now? */
export function isActiveOn(s: Settings, host: string): boolean {
  if (!s.enabled) return false;
  if (s.pausedUntil > Date.now()) return false;
  return !s.disabledSites.includes(host);
}

export function goalsFor(s: Settings, host: string): Goals {
  return s.siteGoals[host] ?? s.goals;
}
