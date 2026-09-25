import type { Category, Dialect, EngineSettings, Goals } from '@oppenly/engine';
import { DEFAULT_GOALS } from '@oppenly/engine/types';

/** Everything the user can change. Stored in `chrome.storage.local` (never synced, never uploaded). */
export interface Settings {
  /** Master switch. */
  enabled: boolean;
  /** Epoch ms until which checking is paused everywhere; 0 when not paused. */
  pausedUntil: number;
  /** Hostnames where the user turned Oppenly off. */
  disabledSites: string[];
  /** Show the Oppenly button inside text fields. */
  showButton: boolean;
  dialect: Dialect;
  oxfordComma: boolean;
  /** Default goals. */
  goals: Goals;
  /** Per-site goals, keyed by hostname. */
  siteGoals: Record<string, Goals>;
  disabledRules: string[];
  disabledCategories: Category[];
  /** Personal dictionary. */
  dictionary: string[];
  ai: {
    /** Preset id of the provider in use, or null for local-only. */
    provider: string | null;
    /** Also ask the AI provider for suggestions while typing (in addition to local checks). */
    liveCheck: boolean;
  };
  /** Distinguish categories by underline shape as well as colour. */
  underlineShapes: boolean;
  welcomeSeen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  pausedUntil: 0,
  disabledSites: [],
  showButton: true,
  dialect: 'american',
  oxfordComma: true,
  goals: DEFAULT_GOALS,
  siteGoals: {},
  disabledRules: [],
  disabledCategories: [],
  dictionary: [],
  ai: { provider: null, liveCheck: true },
  underlineShapes: false,
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

export function engineSettingsFor(s: Settings): Partial<EngineSettings> {
  return {
    dialect: s.dialect,
    oxfordComma: s.oxfordComma,
    goals: s.goals,
    disabledRules: s.disabledRules,
    disabledCategories: s.disabledCategories,
    dictionary: s.dictionary,
  };
}

export const DIALECTS: { value: Dialect; label: string }[] = [
  { value: 'american', label: 'American English' },
  { value: 'british', label: 'British English' },
  { value: 'canadian', label: 'Canadian English' },
  { value: 'australian', label: 'Australian English' },
  { value: 'indian', label: 'Indian English' },
];
