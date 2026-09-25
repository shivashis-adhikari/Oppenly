import type { Token } from '../../nlp/tokenize';
import { isWord } from '../../nlp/tokenize';
import { capitalize, matchCase } from '../../util/text';
import { BLAND, CLICHES, INTENSIFIED } from '../data/phrases';
import { STOPWORDS } from '../data/stopwords';
import { findPhrases, phraseDraft } from '../phrase-match';
import { eachSentence, type Rule } from './types';

const E = 'engagement' as const;

const INTENSIFIERS = new Set([
  'very',
  'really',
  'extremely',
  'incredibly',
  'awfully',
  'terribly',
  'super',
]);

export const vividWords: Rule = {
  id: 'style.vivid-words',
  category: E,
  name: 'Vivid words',
  description: 'Replaces “very + adjective” with one stronger word.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        if (!INTENSIFIERS.has(t.lower)) continue;
        const adj = tokens[i + 1]!;
        const options = INTENSIFIED[adj.lower];
        if (!options || !(adj.pos === 'ADJ' || adj.pos === 'ADV')) continue;
        const next = tokens[i + 2];
        if (next && (next.lower === 'that' || next.lower === 'than' || next.lower === 'to'))
          continue;
        report({
          start: t.start,
          end: adj.end,
          replacements: options.map((o) => matchCase(t.text, o)),
          title: 'Choose a more vivid word',
          message: `“${t.text} ${adj.text}” is weaker than a single precise word.`,
        });
      }
    });
  },
};

export const cliches: Rule = {
  id: 'style.cliches',
  category: E,
  name: 'Clichés',
  description: 'Flags overused expressions and suggests plainer ones.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, CLICHES)) {
      const d = phraseDraft(
        ctx,
        hit,
        CLICHES[hit.key] ?? [],
        'Replace the cliché',
        `“${hit.text}” is an overused expression.`,
      );
      if (d) report(d);
    }
  },
};

function contentKey(t: Token): string | null {
  if (!isWord(t) || t.pos === 'PROPN' || t.type !== 'word') return null;
  if (!['NOUN', 'VERB', 'ADJ', 'ADV'].includes(t.pos)) return null;
  if (t.lower.length < 4 || STOPWORDS.has(t.lower) || STOPWORDS.has(t.lemma)) return null;
  return t.lemma;
}

export const repetition: Rule = {
  id: 'style.repetition',
  category: E,
  name: 'Repetitive words',
  description: 'Flags words you use many times in a short passage.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    const seen = new Map<string, Token[]>();
    for (const s of ctx.paragraph.sentences) {
      for (const t of s.tokens) {
        const key = contentKey(t);
        if (!key) continue;
        const list = seen.get(key) ?? [];
        list.push(t);
        seen.set(key, list);
      }
    }
    for (const [key, list] of seen) {
      if (list.length < 3) continue;
      const synonyms = BLAND[list[2]!.lower] ?? BLAND[key];
      const t = list[2]!;
      report({
        start: t.start,
        end: t.end,
        replacements: synonyms ? synonyms.slice(0, 3).map((w) => matchCase(t.text, w)) : [],
        title: 'Avoid repetition',
        message: `You used “${key}” ${list.length} times in this paragraph. Try a synonym or restructure.`,
        kind: synonyms ? 'replace' : 'info',
      });
    }
  },
};

const WEAK_ADJECTIVES = new Set([
  'good',
  'bad',
  'nice',
  'great',
  'amazing',
  'awesome',
  'interesting',
  'important',
  'big',
  'huge',
  'hard',
  'easy',
]);

export const blandWords: Rule = {
  id: 'style.bland-words',
  category: E,
  name: 'Overused words',
  description: 'Suggests more precise words for common, vague ones.',
  defaultOn: true,
  priority: 0,
  check(ctx, report) {
    let flagged = 0;
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length; i++) {
        if (flagged >= 1) return;
        const t = tokens[i]!;
        if (!WEAK_ADJECTIVES.has(t.lower) || t.pos !== 'ADJ') continue;
        if ((ctx.docCounts.get(t.lemma) ?? 0) < 2) continue;
        const prev = tokens[i - 1];
        if (prev && INTENSIFIERS.has(prev.lower)) continue;
        const options = BLAND[t.lower];
        if (!options) continue;
        flagged++;
        report({
          start: t.start,
          end: t.end,
          replacements: options.slice(0, 3).map((w) => matchCase(t.text, w)),
          title: 'Choose a more precise word',
          message: `“${t.text}” is overused and says little. A precise word makes your point stronger.`,
        });
      }
    });
  },
};

export const sentenceStarts: Rule = {
  id: 'style.sentence-variety',
  category: E,
  name: 'Sentence variety',
  description: 'Flags three sentences in a row that start the same way.',
  defaultOn: true,
  priority: 0,
  check(ctx, report) {
    const starts = ctx.paragraph.sentences.map((s) => s.tokens.find(isWord));
    for (let i = 2; i < starts.length; i++) {
      const a = starts[i - 2];
      const b = starts[i - 1];
      const c = starts[i];
      if (!a || !b || !c) continue;
      if (a.lower === b.lower && b.lower === c.lower && !['the', 'a'].includes(c.lower)) {
        report({
          start: c.start,
          end: c.end,
          replacements: [],
          title: 'Vary your sentences',
          message: `Three sentences in a row start with “${capitalize(c.lower)}”. Varying the openings keeps readers engaged.`,
          kind: 'info',
        });
      }
    }
  },
};

export const ENGAGEMENT_RULES: Rule[] = [
  vividWords,
  cliches,
  repetition,
  blandWords,
  sentenceStarts,
];
