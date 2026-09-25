/** The four suggestion families. Every suggestion belongs to exactly one. */
export type Category = 'correctness' | 'clarity' | 'engagement' | 'delivery';

export const CATEGORIES: readonly Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];

export type Dialect = 'american' | 'british' | 'canadian' | 'australian' | 'indian';

export type Audience = 'general' | 'knowledgeable' | 'expert';
export type Formality = 'informal' | 'neutral' | 'formal';
export type Domain =
  | 'general'
  | 'academic'
  | 'business'
  | 'technical'
  | 'creative'
  | 'casual'
  | 'email';
export type Intent = 'inform' | 'describe' | 'convince' | 'tell-a-story';

export interface Goals {
  audience: Audience;
  formality: Formality;
  domain: Domain;
  intent: Intent;
}

export const DEFAULT_GOALS: Goals = {
  audience: 'knowledgeable',
  formality: 'neutral',
  domain: 'general',
  intent: 'inform',
};

/** Where a suggestion came from. Shown to the user so every suggestion is traceable. */
export type SuggestionSource = 'grammar' | 'style' | 'ai' | 'device-ai';

export type SuggestionKind = 'replace' | 'remove' | 'insert' | 'rewrite' | 'info';

export interface Suggestion {
  /** Stable for the same text, span, rule and fix. Used for dismissals and rendering keys. */
  id: string;
  category: Category;
  /** Stable rule identifier, e.g. `grammar.SpellCheck` or `style.wordy-phrase`. */
  rule: string;
  /** Short card title, e.g. "Correct your spelling". */
  title: string;
  /** One or two plain sentences explaining why. */
  message: string;
  /** UTF-16 offsets into the checked text. */
  start: number;
  end: number;
  /** The exact text at [start, end) when the suggestion was produced. */
  original: string;
  /** Best first. Empty for informational suggestions. */
  replacements: string[];
  kind: SuggestionKind;
  source: SuggestionSource;
  /** Higher wins when two suggestions overlap. */
  priority: number;
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  /** Seconds. */
  readingTime: number;
  /** Seconds. */
  speakingTime: number;
  averageWordLength: number;
  averageSentenceLength: number;
  /** Flesch reading ease, 0–100 (clamped). */
  readability: number;
  /** Share of distinct words among all words, 0–1. */
  uniqueWords: number;
  /** Share of words outside the most common English words, 0–1. */
  rareWords: number;
  longestSentenceWords: number;
}

export interface ToneReading {
  id: ToneId;
  label: string;
  /** 0–1 relative strength. */
  strength: number;
}

export type ToneId =
  | 'confident'
  | 'tentative'
  | 'formal'
  | 'informal'
  | 'friendly'
  | 'appreciative'
  | 'optimistic'
  | 'excited'
  | 'concerned'
  | 'urgent'
  | 'apologetic'
  | 'direct'
  | 'curious'
  | 'disappointed'
  | 'neutral';

export interface CategoryCounts {
  correctness: number;
  clarity: number;
  engagement: number;
  delivery: number;
}

export interface Analysis {
  text: string;
  suggestions: Suggestion[];
  counts: CategoryCounts;
  stats: TextStats;
  tones: ToneReading[];
  /** 0–100, or null when the text is too short to score. */
  score: number | null;
}

export interface EngineSettings {
  dialect: Dialect;
  goals: Goals;
  /** Rule ids the user switched off. */
  disabledRules: string[];
  /** Categories the user switched off. */
  disabledCategories: Category[];
  /** Words the user added to their dictionary. */
  dictionary: string[];
  /** Suggestion ids the user dismissed for this text. */
  dismissed: string[];
  /** American and Canadian default on, others off. */
  oxfordComma: boolean;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  dialect: 'american',
  goals: DEFAULT_GOALS,
  disabledRules: [],
  disabledCategories: [],
  dictionary: [],
  dismissed: [],
  oxfordComma: true,
};
