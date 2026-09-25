import {
  baseFromParticiple,
  isIrregularParticiple,
  OBJECT_TO_SUBJECT,
  SUBJECT_TO_OBJECT,
  toPast,
  toThirdPerson,
} from '../../nlp/morphology';
import type { Token } from '../../nlp/tokenize';
import { isWord } from '../../nlp/tokenize';
import { capitalize } from '../../util/text';
import { COMPLEX_WORDS, REDUNDANT, WORDY } from '../data/phrases';
import { findPhrases, phraseDraft } from '../phrase-match';
import { eachSentence, lowerIs, posIs, type Rule } from './types';

const CL = 'clarity' as const;

export const wordyPhrases: Rule = {
  id: 'style.wordy',
  category: CL,
  name: 'Wordy phrases',
  description: 'Replaces long phrases with shorter ones: “in order to” → “to”.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, WORDY)) {
      const d = phraseDraft(
        ctx,
        hit,
        WORDY[hit.key] ?? [],
        'Remove wordiness',
        `“${hit.text}” can be said more simply.`,
      );
      if (d) report(d);
    }
  },
};

export const redundantPhrases: Rule = {
  id: 'style.redundancy',
  category: CL,
  name: 'Redundancy',
  description: 'Removes words that repeat an idea: “end result” → “result”.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, REDUNDANT)) {
      const d = phraseDraft(
        ctx,
        hit,
        REDUNDANT[hit.key] ?? [],
        'Remove redundancy',
        `“${hit.text}” repeats itself.`,
      );
      if (d) report(d);
    }
  },
};

export const complexWords: Rule = {
  id: 'style.complex-words',
  category: CL,
  name: 'Simpler words',
  description: 'Suggests plain words: “utilize” → “use”.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.domain === 'academic' && ctx.goals.audience === 'expert') return;
    const tokensByStart = new Map<number, Token>();
    for (const s of ctx.paragraph.sentences)
      for (const t of s.tokens) tokensByStart.set(t.start, t);
    for (const hit of findPhrases(ctx, COMPLEX_WORDS)) {
      const t = tokensByStart.get(hit.start);
      if (hit.key === 'purchase' && t && t.pos !== 'VERB') continue;
      if ((hit.key === 'endeavor' || hit.key === 'endeavour') && t && t.pos === 'NOUN') {
        const d = phraseDraft(
          ctx,
          hit,
          ['effort'],
          'Choose a simpler word',
          `“${hit.text}” has a simpler alternative.`,
        );
        if (d) report(d);
        continue;
      }
      const d = phraseDraft(
        ctx,
        hit,
        COMPLEX_WORDS[hit.key] ?? [],
        'Choose a simpler word',
        `“${hit.text}” has a simpler alternative.`,
      );
      if (d) report(d);
    }
  },
};

const SUBJECT_IT = new Set(['it', 'this', 'that', 'which', 'who']);

const BE = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);

/** Participles that usually act as adjectives ("I am interested"). */
const ADJECTIVAL = new Set([
  'interested',
  'excited',
  'tired',
  'bored',
  'located',
  'based',
  'born',
  'married',
  'supposed',
  'used',
  'related',
  'concerned',
  'involved',
  'done',
  'finished',
  'gone',
  'called',
  'named',
  'pleased',
  'surprised',
  'satisfied',
  'worried',
  'scared',
  'confused',
  'disappointed',
  'embarrassed',
  'exhausted',
  'prepared',
  'dressed',
  'engaged',
  'qualified',
  'allowed',
  'amazed',
  'annoyed',
  'frustrated',
  'impressed',
  'convinced',
  'determined',
  'committed',
  'dedicated',
  'focused',
  'designed',
  'meant',
  'expected',
  'entitled',
  'equipped',
  'aimed',
  'devoted',
  'accustomed',
  'obliged',
  'blessed',
  'closed',
  'opened',
  'lost',
  'stuck',
  'fixed',
  'broken',
  'hurt',
  'injured',
  'thrilled',
  'delighted',
  'relieved',
  'shocked',
  'stressed',
  'overwhelmed',
  'known',
  'considered',
  'required',
  'needed',
  'set',
  'scheduled',
  'attached',
  'included',
  'enclosed',
  'parked',
  'seated',
  'situated',
  'listed',
  'shown',
  'given',
  'made',
]);

function isParticiple(t: Token): boolean {
  if (t.pos !== 'VERB' && t.pos !== 'ADJ') return false;
  if (ADJECTIVAL.has(t.lower)) return false;
  if (t.lower.endsWith('ed')) return t.pos === 'VERB';
  return isIrregularParticiple(t.lower) && baseFromParticiple(t.lower) !== t.lower;
}

function toObject(np: string): string {
  const lower = np.toLowerCase();
  if (SUBJECT_TO_OBJECT[lower]) return SUBJECT_TO_OBJECT[lower]!;
  return np;
}

function toSubject(np: string): string {
  const lower = np.toLowerCase();
  if (OBJECT_TO_SUBJECT[lower]) return OBJECT_TO_SUBJECT[lower]!;
  return np;
}

function joinTokens(tokens: Token[]): string {
  return tokens.map((t, i) => (i === 0 ? t.text : (t.pre ? ' ' : '') + t.text)).join('');
}

/** A noun phrase moved out of sentence-initial position loses its capital (unless it is a name). */
function nounPhraseText(tokens: Token[]): string {
  const text = joinTokens(tokens);
  const first = tokens[0]!;
  if (first.pos === 'PROPN' || first.text === 'I') return text;
  return first.text.toLowerCase() + text.slice(first.text.length);
}

export const passiveVoice: Rule = {
  id: 'style.passive-voice',
  category: CL,
  name: 'Passive voice',
  description: 'Flags passive sentences and rewrites them when the doer is named.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.domain === 'academic' || ctx.goals.domain === 'technical') return;
    let notes = 0;
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length; i++) {
        const be = tokens[i]!;
        if (!BE.has(be.lower)) continue;
        let j = i + 1;
        if (lowerIs(tokens[j], 'not', "n't")) j++;
        if (posIs(tokens[j], 'ADV')) j++;
        const part = tokens[j];
        if (!part || !isParticiple(part)) continue;
        if (
          lowerIs(tokens[j + 1], 'to') &&
          ['supposed', 'used', 'expected', 'asked', 'told', 'allowed', 'required'].includes(
            part.lower,
          )
        )
          continue;
        if (
          lowerIs(tokens[j + 1], 'that', 'with') &&
          ['convinced', 'satisfied', 'disappointed', 'pleased'].includes(part.lower)
        )
          continue;

        // Find the clause subject: from clause start up to the be-verb.
        let s = i - 1;
        while (
          s > 0 &&
          !(
            tokens[s - 1]!.pos === 'PUNCT' ||
            tokens[s - 1]!.pos === 'CCONJ' ||
            tokens[s - 1]!.pos === 'SCONJ'
          )
        )
          s--;
        const subject = tokens.slice(s, i).filter((t) => t.pos !== 'AUX');
        const byIdx = tokens[j + 1]?.lower === 'by' ? j + 1 : -1;

        if (
          byIdx > 0 &&
          subject.length > 0 &&
          subject.length <= 6 &&
          subject.every((t) => ['DET', 'ADJ', 'NOUN', 'PROPN', 'PRON', 'NUM'].includes(t.pos))
        ) {
          let e = byIdx + 1;
          while (
            e < tokens.length &&
            ['DET', 'ADJ', 'NOUN', 'PROPN', 'PRON', 'NUM'].includes(tokens[e]!.pos)
          )
            e++;
          const agent = tokens.slice(byIdx + 1, e);
          const end = tokens[e];
          const cleanEnd = !end || end.pos === 'PUNCT' || end.pos === 'CCONJ';
          const base = baseFromParticiple(part.lower) ?? part.lemma;
          if (
            agent.length > 0 &&
            agent.length <= 6 &&
            cleanEnd &&
            base &&
            !lowerIs(tokens[i + 1], 'not', "n't") &&
            ['was', 'were', 'is', 'are'].includes(be.lower)
          ) {
            const past = ['was', 'were'].includes(be.lower);
            const agentText = toSubject(joinTokens(agent));
            const lastAgent = agent[agent.length - 1]!;
            const agentPlural =
              (lastAgent.pos === 'NOUN' && lastAgent.lemma !== lastAgent.lower) ||
              ['we', 'they', 'you', 'i'].includes(agentText.toLowerCase());
            const verb = past ? toPast(base) : agentPlural ? base : toThirdPerson(base);
            const objectText = toObject(nounPhraseText(subject));
            const startsSentence = s === 0;
            const rewritten = `${startsSentence ? capitalize(agentText) : agentText} ${verb} ${objectText}`;
            report({
              start: tokens[s]!.start,
              end: agent[agent.length - 1]!.end,
              replacements: [rewritten],
              title: 'Use the active voice',
              message: 'Active sentences are more direct: say who did what.',
              kind: 'rewrite',
              priority: 1,
            });
            continue;
          }
        }

        if (notes >= 1 || tokens[0]?.lower === 'there' || SUBJECT_IT.has(tokens[i - 1]!.lower))
          continue;
        notes++;
        report({
          start: be.start,
          end: part.end,
          replacements: [],
          title: 'Passive voice',
          message: 'This may be clearer in the active voice: say who did what.',
          kind: 'info',
          priority: 0,
        });
      }
    });
  },
};

export const longSentences: Rule = {
  id: 'style.long-sentence',
  category: CL,
  name: 'Hard-to-read sentences',
  description: 'Flags very long sentences and offers a split when there is a natural break.',
  defaultOn: true,
  priority: 0,
  check(ctx, report) {
    const limit = ctx.goals.audience === 'general' ? 30 : ctx.goals.audience === 'expert' ? 45 : 36;
    eachSentence(ctx, ({ tokens }) => {
      const words = tokens.filter(isWord);
      if (words.length < limit) return;
      // Look for ", and|but|so <subject>" or "; " closest to the middle.
      const mid = (tokens[0]!.start + tokens[tokens.length - 1]!.end) / 2;
      let best: { start: number; end: number; next: Token; dist: number } | null = null;
      for (let i = 2; i < tokens.length - 4; i++) {
        const t = tokens[i]!;
        if (t.text === ';') {
          const next = tokens[i + 1]!;
          const dist = Math.abs(t.start - mid);
          if (!best || dist < best.dist) best = { start: t.start, end: next.end, next, dist };
        } else if (t.text === ',' && lowerIs(tokens[i + 1], 'and', 'but', 'so')) {
          const next = tokens[i + 2]!;
          if (!(posIs(next, 'PRON', 'DET', 'PROPN') || next.lower === 'there')) continue;
          const verb = tokens[i + 3];
          if (!verb || !posIs(verb, 'VERB', 'AUX', 'NOUN', 'ADJ')) continue;
          const left = tokens.slice(0, i).filter(isWord).length;
          const right = tokens.slice(i + 2).filter(isWord).length;
          if (left < 8 || right < 8) continue;
          const dist = Math.abs(t.start - mid);
          if (!best || dist < best.dist) best = { start: t.start, end: next.end, next, dist };
        }
      }
      if (best) {
        const conj = tokens.find(
          (t) => t.start > best!.start && t.end <= best!.next.start && t.pos === 'CCONJ',
        );
        const lead = conj && conj.lower === 'but' ? 'But ' : '';
        const nextText =
          best.next.text === 'I' || best.next.pos === 'PROPN'
            ? best.next.text
            : best.next.text.toLowerCase();
        report({
          start: best.start,
          end: best.end,
          replacements: [`. ${lead}${lead ? nextText : capitalize(nextText)}`],
          title: 'Split the sentence',
          message: `This sentence has ${words.length} words. Splitting it makes it easier to read.`,
          kind: 'rewrite',
        });
        return;
      }
      report({
        start: tokens[0]!.start,
        end: tokens[tokens.length - 1]!.end,
        replacements: [],
        title: 'Hard-to-read sentence',
        message: `This sentence has ${words.length} words. Consider breaking it into shorter ones.`,
        kind: 'info',
      });
    });
  },
};

export const CLARITY_RULES: Rule[] = [
  wordyPhrases,
  redundantPhrases,
  complexWords,
  passiveVoice,
  longSentences,
];
