import type { Category, Dialect, EngineSettings, Goals } from '@oppenly/engine';
import { DEFAULT_GOALS } from '@oppenly/engine/types';

/** Settings shared by the extension and the web app. Each app extends this with its own. */
export interface CommonSettings {
  dialect: Dialect;
  oxfordComma: boolean;
  /** Default goals. */
  goals: Goals;
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
}

export const COMMON_DEFAULTS: CommonSettings = {
  dialect: 'american',
  oxfordComma: true,
  goals: DEFAULT_GOALS,
  disabledRules: [],
  disabledCategories: [],
  dictionary: [],
  ai: { provider: null, liveCheck: true },
  underlineShapes: false,
};

export type SettingsPatch<T> = Partial<T> | ((s: T) => Partial<T>);

export interface SectionProps<T extends CommonSettings = CommonSettings> {
  settings: T;
  update: (patch: SettingsPatch<T>) => Promise<T>;
}

export function engineSettingsFor(s: CommonSettings): Partial<EngineSettings> {
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

export interface GoalOption {
  key: keyof Goals;
  label: string;
  hint: string;
  options: { value: string; label: string; hint?: string }[];
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    key: 'audience',
    label: 'Audience',
    hint: 'Who will read your writing',
    options: [
      { value: 'general', label: 'General', hint: 'Easy for anyone to read with minimal effort.' },
      {
        value: 'knowledgeable',
        label: 'Knowledgeable',
        hint: 'Requires focus to read and understand.',
      },
      { value: 'expert', label: 'Expert', hint: 'May require rereading to understand.' },
    ],
  },
  {
    key: 'formality',
    label: 'Formality',
    hint: 'How formal your writing should sound',
    options: [
      { value: 'informal', label: 'Informal' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  {
    key: 'domain',
    label: 'Domain',
    hint: 'The kind of writing',
    options: [
      { value: 'general', label: 'General', hint: 'Default settings.' },
      { value: 'academic', label: 'Academic', hint: 'Strict rules for formal writing.' },
      { value: 'business', label: 'Business', hint: 'Clear and professional.' },
      { value: 'technical', label: 'Technical', hint: 'Precise and consistent.' },
      { value: 'creative', label: 'Creative', hint: 'Room for style and experiment.' },
      { value: 'casual', label: 'Casual', hint: 'Relaxed rules for everyday writing.' },
      { value: 'email', label: 'Email', hint: 'Clear, polite and to the point.' },
    ],
  },
  {
    key: 'intent',
    label: 'Intent',
    hint: 'What you want to achieve',
    options: [
      { value: 'inform', label: 'Inform' },
      { value: 'describe', label: 'Describe' },
      { value: 'convince', label: 'Convince' },
      { value: 'tell-a-story', label: 'Tell a story' },
    ],
  },
];
