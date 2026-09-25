import {
  COMMON_DEFAULTS,
  type CommonSettings,
  type SettingsPatch,
} from '@oppenly/ui/settings-model';
import { signal } from '@preact/signals';

export type Theme = 'system' | 'light' | 'dark';

/** Everything the user can change in the web app. Stored in this browser only. */
export interface WebSettings extends CommonSettings {
  theme: Theme;
  /** Open the goals dialog when starting a new document. */
  goalsOnNew: boolean;
  /** Document text size in pixels. */
  fontSize: number;
}

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  ...COMMON_DEFAULTS,
  theme: 'system',
  goalsOnNew: true,
  fontSize: 17,
};

const KEY = 'oppenly.settings';

function read(): WebSettings {
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<WebSettings>) : {};
    return {
      ...DEFAULT_WEB_SETTINGS,
      ...stored,
      ai: { ...DEFAULT_WEB_SETTINGS.ai, ...stored.ai },
    };
  } catch {
    return DEFAULT_WEB_SETTINGS;
  }
}

export const settings = signal<WebSettings>(read());

export async function updateSettings(patch: SettingsPatch<WebSettings>): Promise<WebSettings> {
  const current = settings.value;
  const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  settings.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage full or blocked: the change still applies for this session. */
  }
  return next;
}

// Keep several open tabs in step.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) settings.value = read();
});

export function applyTheme(theme: Theme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
