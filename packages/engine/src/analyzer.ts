import type { BinaryModule } from 'harper.js';
import { consistencyDrafts } from './local/consistency';
import { STOPWORDS } from './local/data/stopwords';
import { GrammarEngine, type GrammarFinding } from './local/harper';
import { ALL_RULES, DOCUMENT_RULES, type Draft, type Rule, type RuleContext } from './local/rules';
import { computeScore } from './local/score';
import { computeStats } from './local/stats';
import { detectTones } from './local/tone';
import { analyseParagraph, type Paragraph } from './nlp/tokenize';
import {
  type Analysis,
  CATEGORIES,
  type Category,
  type CategoryCounts,
  DEFAULT_SETTINGS,
  type EngineSettings,
  type Goals,
  type Suggestion,
  type SuggestionSource,
} from './types';
import { hash, splitParagraphs } from './util/text';

interface RuleFinding {
  rule: Rule;
  draft: Draft;
}

interface ParagraphResult {
  grammar: GrammarFinding[];
  rules: RuleFinding[];
}

const CACHE_LIMIT = 800;

/** Drop the oldest entries once a Map grows past `limit` (Maps iterate in insertion order). */
function trim<K, V>(map: Map<K, V>, limit: number): void {
  if (map.size <= limit) return;
  const excess = map.size - limit;
  let i = 0;
  for (const key of map.keys()) {
    if (i++ >= excess) break;
    map.delete(key);
  }
}

const SKIP_TOKEN_TYPES = new Set(['url', 'email', 'hashtag', 'mention', 'emoji', 'emoticon']);

/**
 * The local writing engine. Everything here runs on the user's device: Harper for grammar,
 * our rule set for style, and local heuristics for tone, statistics and the overall score.
 */
export class Engine {
  private readonly grammar: GrammarEngine;
  private settings: EngineSettings = DEFAULT_SETTINGS;
  private readonly paragraphs = new Map<string, Paragraph>();
  private readonly results = new Map<string, ParagraphResult>();
  private settingsKey = '';

  constructor(harperBinary: BinaryModule) {
    this.grammar = new GrammarEngine(harperBinary);
  }

  async init(settings: Partial<EngineSettings> = {}): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    await this.grammar.init(this.settings.dialect, this.settings.oxfordComma);
    await this.applySettings();
  }

  async updateSettings(settings: Partial<EngineSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.applySettings();
  }

  getSettings(): EngineSettings {
    return this.settings;
  }

  private async applySettings(): Promise<void> {
    const s = this.settings;
    await this.grammar.configure(s.dialect, s.oxfordComma, s.dictionary);
    const key = JSON.stringify([s.dialect, s.oxfordComma, [...s.dictionary].sort()]);
    if (key !== this.settingsKey) {
      this.settingsKey = key;
      this.results.clear();
    }
  }

  private tokenize(text: string): Paragraph {
    let p = this.paragraphs.get(text);
    if (!p) {
      p = analyseParagraph(text, 0);
      this.paragraphs.set(text, p);
      trim(this.paragraphs, CACHE_LIMIT);
    }
    return p;
  }

  private context(paragraph: Paragraph, docCounts: Map<string, number>, goals: Goals): RuleContext {
    const s = this.settings;
    return { paragraph, goals, dialect: s.dialect, oxfordComma: s.oxfordComma, docCounts };
  }

  private async checkParagraph(
    text: string,
    paragraph: Paragraph,
    docCounts: Map<string, number>,
    goals: Goals,
  ): Promise<ParagraphResult> {
    const cacheKey = `${JSON.stringify(goals)}|${text}`;
    const cached = this.results.get(cacheKey);
    if (cached) return cached;
    const grammar = await this.grammar.check(text);
    const rules: RuleFinding[] = [];
    const ctx = this.context(paragraph, docCounts, goals);
    for (const rule of ALL_RULES) {
      if (DOCUMENT_RULES.has(rule)) continue;
      rule.check(ctx, (draft) => rules.push({ rule, draft }));
    }
    const result = { grammar, rules };
    this.results.set(cacheKey, result);
    trim(this.results, CACHE_LIMIT);
    return result;
  }

  /**
   * Analyse `text`. Optional `extra` suggestions (for example from an AI provider) are merged in.
   * `goals` overrides the default goals for this call only (for per-site goals).
   */
  async analyze(
    text: string,
    extra: Suggestion[] = [],
    goals: Goals = this.settings.goals,
  ): Promise<Analysis> {
    const spans = splitParagraphs(text);
    const paragraphs = spans.map((span) => this.tokenize(span.text));

    const docCounts = new Map<string, number>();
    for (const p of paragraphs) {
      for (const s of p.sentences) {
        for (const t of s.tokens) {
          if (t.type !== 'word' || STOPWORDS.has(t.lower)) continue;
          docCounts.set(t.lemma, (docCounts.get(t.lemma) ?? 0) + 1);
        }
      }
    }

    const all: Suggestion[] = [];
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i]!;
      const paragraph = paragraphs[i]!;
      const result = await this.checkParagraph(span.text, paragraph, docCounts, goals);
      const blocked = blockedRanges(paragraph);
      for (const f of result.grammar) {
        if (!this.keepGrammarFinding(f, span.text, paragraph, blocked)) continue;
        all.push(
          this.finalize(text, span.start, f.start, f.end, {
            rule: `grammar.${f.rule}`,
            category: f.category,
            title: f.title,
            message: f.message,
            replacements: f.replacements,
            kind:
              f.replacements.length === 0
                ? 'info'
                : f.replacements.every((r) => r === '')
                  ? 'remove'
                  : 'replace',
            source: 'grammar',
            priority: 2,
          }),
        );
      }
      const ctx = this.context(paragraph, docCounts, goals);
      const docFindings: RuleFinding[] = [];
      for (const rule of DOCUMENT_RULES)
        rule.check(ctx, (draft) => docFindings.push({ rule, draft }));
      for (const { rule, draft } of [...result.rules, ...docFindings]) {
        if (overlapsBlocked(draft.start, draft.end, blocked)) continue;
        all.push(
          this.finalize(text, span.start, draft.start, draft.end, {
            rule: rule.id,
            category: draft.category ?? rule.category,
            title: draft.title,
            message: draft.message,
            replacements: draft.replacements,
            kind: draft.kind ?? (draft.replacements.length ? 'replace' : 'info'),
            source: 'style',
            priority: draft.priority ?? rule.priority,
          }),
        );
      }
    }

    for (const d of consistencyDrafts(text)) {
      all.push(
        this.finalize(text, 0, d.start, d.end, {
          rule: 'style.consistency',
          category: 'correctness',
          title: d.title,
          message: d.message,
          replacements: d.replacements,
          kind: 'replace',
          source: 'style',
          priority: 1,
        }),
      );
    }

    for (const s of extra) {
      if (text.slice(s.start, s.end) === s.original) all.push(s);
    }

    const suggestions = this.resolve(all);
    const stats = computeStats(text, paragraphs);
    const tones = detectTones(text, paragraphs);
    const counts = countByCategory(suggestions);
    const score = computeScore(suggestions, stats, goals);
    return { text, suggestions, counts, stats, tones, score };
  }

  private keepGrammarFinding(
    f: GrammarFinding,
    text: string,
    p: Paragraph,
    blocked: [number, number][],
  ): boolean {
    if (overlapsBlocked(f.start, f.end, blocked)) return false;
    const word = text.slice(f.start, f.end);
    if (f.kind === 'Spelling' || f.kind === 'Typo') {
      if (/[\d_@#/\\]/.test(word) || /[a-z][A-Z]/.test(word)) return false;
      if (/^[A-Z]{2,6}s?$/.test(word)) return false;
      if (/^[A-Z]/.test(word) && !startsSentence(text, f.start)) return false;
      const lower = word.toLowerCase();
      if (this.settings.dictionary.some((w) => w.toLowerCase() === lower)) return false;
    }
    // "went there yesterday" is not "their": only accept when a noun phrase follows.
    if (word.toLowerCase() === 'there' && f.replacements.some((r) => r.toLowerCase() === 'their')) {
      const next = tokenAfter(p, f.end);
      if (!next || !['NOUN', 'ADJ', 'PROPN', 'NUM'].includes(next.pos)) return false;
      if (TIME_WORDS.has(next.lower)) return false;
      const prev = tokenBefore(p, f.start);
      if (prev && PLACE_VERBS.has(prev.lower)) return false;
    }
    if (f.rule === 'QuiteQuiet' && word.toLowerCase() === 'quiet') {
      const next = tokenAfter(p, f.end);
      if (!next || !(next.pos === 'ADJ' || next.lower === 'a' || next.lower === 'an')) return false;
    }
    if (
      f.rule === 'SplitWords' &&
      f.replacements.every((r) => r.includes(' ')) &&
      /s$/.test(word)
    ) {
      // e.g. "informations" → "in formations": our uncountable-noun rule gives the right fix.
      return false;
    }
    return true;
  }

  private finalize(
    text: string,
    base: number,
    start: number,
    end: number,
    s: {
      rule: string;
      category: Category;
      title: string;
      message: string;
      replacements: string[];
      kind: Suggestion['kind'];
      source: SuggestionSource;
      priority: number;
    },
  ): Suggestion {
    const absStart = base + start;
    const absEnd = base + end;
    const original = text.slice(absStart, absEnd);
    // Context is clipped to the sentence so ids survive edits elsewhere in the document.
    const before =
      text
        .slice(Math.max(0, absStart - 24), absStart)
        .split(/[.!?\n]\s*/)
        .pop() ?? '';
    const after = text.slice(absEnd, absEnd + 24).split(/[.!?\n]/)[0] ?? '';
    const id = hash(`${s.rule}|${original}|${s.replacements[0] ?? ''}|${before}|${after}`);
    return { id, ...s, start: absStart, end: absEnd, original };
  }

  private resolve(all: Suggestion[]): Suggestion[] {
    const { disabledRules, disabledCategories, dismissed } = this.settings;
    const offRules = new Set(disabledRules);
    const offCats = new Set(disabledCategories);
    const gone = new Set(dismissed);
    const candidates = all.filter((s) => {
      if (offRules.has(s.rule) || offCats.has(s.category) || gone.has(s.id)) return false;
      if (
        s.kind !== 'info' &&
        s.replacements.length > 0 &&
        s.replacements.every((r) => r === s.original)
      )
        return false;
      return true;
    });

    // Actionable suggestions may not overlap; higher priority wins, then the narrower span.
    const actionable = candidates
      .filter((s) => s.kind !== 'info')
      .sort(
        (a, b) =>
          b.priority - a.priority || a.end - a.start - (b.end - b.start) || a.start - b.start,
      );
    const accepted: Suggestion[] = [];
    const taken: [number, number][] = [];
    const seen = new Set<string>();
    for (const s of actionable) {
      if (seen.has(s.id)) continue;
      if (taken.some(([a, b]) => s.start < b && a < s.end)) continue;
      accepted.push(s);
      taken.push([s.start, s.end]);
      seen.add(s.id);
    }
    // Informational notes (passive voice, long sentences) can sit alongside word-level fixes.
    for (const s of candidates) {
      if (s.kind !== 'info' || seen.has(s.id)) continue;
      if (
        accepted.some(
          (a) =>
            a.kind !== 'info' &&
            a.rule === 'style.passive-voice' &&
            a.start <= s.start &&
            s.end <= a.end,
        )
      )
        continue;
      accepted.push(s);
      seen.add(s.id);
    }
    return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  dispose(): void {
    this.grammar.dispose();
    this.paragraphs.clear();
    this.results.clear();
  }
}

function countByCategory(suggestions: Suggestion[]): CategoryCounts {
  const counts: CategoryCounts = { correctness: 0, clarity: 0, engagement: 0, delivery: 0 };
  for (const s of suggestions) counts[s.category]++;
  for (const c of CATEGORIES) counts[c] = counts[c] ?? 0;
  return counts;
}

function blockedRanges(p: Paragraph): [number, number][] {
  const out: [number, number][] = [];
  for (const s of p.sentences) {
    for (const t of s.tokens) {
      if (SKIP_TOKEN_TYPES.has(t.type)) out.push([t.start, t.end]);
    }
  }
  const code = /`[^`\n]+`/g;
  for (let m = code.exec(p.text); m; m = code.exec(p.text))
    out.push([m.index, m.index + m[0].length]);
  return out;
}

function overlapsBlocked(start: number, end: number, blocked: [number, number][]): boolean {
  return blocked.some(([a, b]) => start < b && a < end);
}

function startsSentence(text: string, index: number): boolean {
  const before = text.slice(0, index).replace(/[\s"“'‘(]+$/, '');
  return before.length === 0 || /[.!?:]$/.test(before);
}

const TIME_WORDS = new Set([
  'yesterday',
  'today',
  'tomorrow',
  'tonight',
  'now',
  'then',
  'again',
  'before',
  'soon',
  'later',
  'already',
  'too',
  'anymore',
  'last',
  'next',
  'every',
  'once',
  'twice',
  'often',
  'daily',
  'weekly',
  'this',
  'early',
  'late',
  'first',
  'together',
  'alone',
  'safely',
  'yet',
]);
const PLACE_VERBS = new Set([
  'went',
  'go',
  'goes',
  'going',
  'gone',
  'get',
  'got',
  'getting',
  'be',
  'been',
  'was',
  'were',
  'is',
  'are',
  'stay',
  'stayed',
  'staying',
  'live',
  'lived',
  'living',
  'moved',
  'move',
  'arrived',
  'arrive',
  'drove',
  'drive',
  'walked',
  'walk',
  'ran',
  'run',
  'flew',
  'fly',
  'sat',
  'sit',
  'stood',
  'stand',
  'over',
  'up',
  'down',
  'out',
  'in',
  'from',
  'back',
  'right',
  'get',
  'meet',
  'met',
  'see',
  'saw',
]);

function tokenBefore(p: Paragraph, start: number) {
  let found: Paragraph['sentences'][number]['tokens'][number] | undefined;
  for (const s of p.sentences) {
    for (const t of s.tokens) if (t.end <= start && t.type === 'word') found = t;
  }
  return found;
}

function tokenAfter(p: Paragraph, end: number) {
  for (const s of p.sentences) {
    for (const t of s.tokens) if (t.start >= end && t.type === 'word') return t;
  }
  return undefined;
}
