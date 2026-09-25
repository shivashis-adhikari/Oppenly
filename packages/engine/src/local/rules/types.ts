import type { Paragraph, Sentence, Token } from '../../nlp/tokenize';
import type { Category, Dialect, Goals, SuggestionKind } from '../../types';

export interface RuleContext {
  paragraph: Paragraph;
  goals: Goals;
  dialect: Dialect;
  oxfordComma: boolean;
  /** Lemma counts of content words across the whole document. */
  docCounts: Map<string, number>;
}

/** What a rule reports. The analyzer fills in ids, original text and source. */
export interface Draft {
  start: number;
  end: number;
  replacements: string[];
  title: string;
  message: string;
  kind?: SuggestionKind;
  /** Overrides the rule's category for this one finding. */
  category?: Category;
  priority?: number;
}

export interface Rule {
  /** Stable id, e.g. `style.fewer-less`. Used for settings and dismissals. */
  id: string;
  category: Category;
  /** Name shown in settings. */
  name: string;
  /** One line shown in settings. */
  description: string;
  defaultOn: boolean;
  /** Default priority when suggestions overlap. Grammar engine findings use 2. */
  priority: number;
  check(ctx: RuleContext, report: (d: Draft) => void): void;
}

export function eachSentence(ctx: RuleContext, fn: (s: Sentence) => void): void {
  for (const s of ctx.paragraph.sentences) fn(s);
}

/** The next word token after index i (skipping nothing). */
export function at(tokens: Token[], i: number): Token | undefined {
  return tokens[i];
}

export function lowerIs(t: Token | undefined, ...words: string[]): boolean {
  return Boolean(t && words.includes(t.lower));
}

export function posIs(t: Token | undefined, ...tags: string[]): boolean {
  return Boolean(t && tags.includes(t.pos));
}

/** Text of the paragraph between two absolute offsets. */
export function slice(ctx: RuleContext, start: number, end: number): string {
  const o = ctx.paragraph.start;
  return ctx.paragraph.text.slice(start - o, end - o);
}

export const SUBJECT_PRONOUNS = new Set(['i', 'you', 'he', 'she', 'it', 'we', 'they']);

export const SUBORDINATORS = new Set([
  'if',
  'when',
  'whenever',
  'because',
  'although',
  'though',
  'while',
  'whilst',
  'since',
  'after',
  'before',
  'as',
  'unless',
  'until',
  'once',
  'whereas',
  'wherever',
  'whether',
  'even',
  'so',
  'that',
  'which',
  'who',
  'where',
  'how',
  'what',
  'why',
]);

/** A finite verb is present (not just an infinitive or gerund). */
export function hasFiniteVerb(tokens: Token[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.pos === 'AUX') return true;
    if (t.pos === 'VERB') {
      const prev = tokens[i - 1];
      if (prev && prev.lower === 'to') continue;
      if (t.lower.endsWith('ing') && !(prev && prev.pos === 'AUX')) continue;
      return true;
    }
  }
  return false;
}
