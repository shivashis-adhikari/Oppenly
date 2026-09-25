import type { Token } from '../../nlp/tokenize';
import { matchCase } from '../../util/text';
import { APOLOGIES, FORMAL_ONLY, HEDGES, IMPOLITE, INCLUSIVE, INFORMAL } from '../data/phrases';
import { atSentenceStart, findPhrases, phraseDraft } from '../phrase-match';
import { eachSentence, type Rule, type RuleContext } from './types';

const D = 'delivery' as const;

function tokenAt(
  ctx: RuleContext,
  start: number,
): { token: Token; tokens: Token[]; index: number } | null {
  for (const s of ctx.paragraph.sentences) {
    const index = s.tokens.findIndex((t) => t.start === start);
    if (index >= 0) return { token: s.tokens[index]!, tokens: s.tokens, index };
  }
  return null;
}

export const hedging: Rule = {
  id: 'style.hedging',
  category: D,
  name: 'Confident language',
  description: 'Removes hedges like “I think” and “just wanted to”.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.formality === 'informal' && ctx.goals.domain === 'casual') return;
    for (const hit of findPhrases(ctx, HEDGES)) {
      if (hit.key === 'kind of' || hit.key === 'sort of') {
        const found = tokenAt(ctx, hit.start);
        if (!found) continue;
        const prev = found.tokens[found.index - 1];
        const next = found.tokens[found.index + 2];
        if (
          prev &&
          (prev.pos === 'DET' ||
            [
              'what',
              'which',
              'this',
              'that',
              'some',
              'any',
              'every',
              'no',
              'one',
              'the',
              'a',
              'same',
              'right',
              'wrong',
              'different',
            ].includes(prev.lower))
        )
          continue;
        if (!next || !['ADJ', 'VERB', 'ADV'].includes(next.pos)) continue;
      }
      if (
        hit.key === 'i think that' ||
        hit.key === 'i believe that' ||
        hit.key === 'i guess' ||
        hit.key === 'i feel like'
      ) {
        const local = hit.start - ctx.paragraph.start;
        if (!atSentenceStart(ctx.paragraph.text, local)) continue;
      }
      const d = phraseDraft(
        ctx,
        hit,
        HEDGES[hit.key] ?? [],
        'Sound more confident',
        `“${hit.text}” can make you sound unsure. Removing it makes your point stronger.`,
      );
      if (d) report(d);
    }
  },
};

export const apologies: Rule = {
  id: 'style.apologies',
  category: D,
  name: 'Thank instead of apologise',
  description: '“Thank you for your patience” lands better than “Sorry for the delay”.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, APOLOGIES)) {
      const d = phraseDraft(
        ctx,
        hit,
        APOLOGIES[hit.key] ?? [],
        'Thank instead of apologizing',
        'Thanking the reader sounds more positive than apologizing.',
      );
      if (d) report(d);
    }
  },
};

export const politeness: Rule = {
  id: 'style.politeness',
  category: D,
  name: 'Polite phrasing',
  description: 'Softens phrases that can sound curt or passive-aggressive.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, IMPOLITE)) {
      const local = hit.start - ctx.paragraph.start;
      if (
        (hit.key === 'you need to' || hit.key === 'you must') &&
        !atSentenceStart(ctx.paragraph.text, local)
      )
        continue;
      if (hit.key === 'obviously' && !atSentenceStart(ctx.paragraph.text, local)) continue;
      const d = phraseDraft(
        ctx,
        hit,
        IMPOLITE[hit.key] ?? [],
        'Adjust the tone',
        `“${hit.text}” may come across as curt or impolite.`,
      );
      if (d) report(d);
    }
  },
};

export const informalWords: Rule = {
  id: 'style.informal',
  category: D,
  name: 'Informal language',
  description: 'Flags slang such as “gonna” when your goal is not casual.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.formality === 'informal') return;
    for (const hit of findPhrases(ctx, INFORMAL)) {
      if ((hit.key === 'u' || hit.key === 'ur') && hit.text !== hit.key) continue;
      const d = phraseDraft(
        ctx,
        hit,
        INFORMAL[hit.key] ?? [],
        'Use formal language',
        `“${hit.text}” is informal.`,
      );
      if (d) report(d);
    }
  },
};

export const formalTone: Rule = {
  id: 'style.formal-tone',
  category: D,
  name: 'Formal word choice',
  description: 'When your goal is formal, suggests formal alternatives.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.formality !== 'formal') return;
    for (const hit of findPhrases(ctx, FORMAL_ONLY)) {
      const found = tokenAt(ctx, hit.start);
      if ((hit.key === 'pretty' || hit.key === 'super') && found) {
        const next = found.tokens[found.index + 1];
        if (!next || !['ADJ', 'ADV'].includes(next.pos)) continue;
      }
      if (
        ['hi', 'hey'].includes(hit.key) &&
        !atSentenceStart(ctx.paragraph.text, hit.start - ctx.paragraph.start)
      )
        continue;
      let options = FORMAL_ONLY[hit.key] ?? [];
      if (['a lot of', 'lots of', 'tons of'].includes(hit.key)) {
        const nextWord =
          ctx.paragraph.text.slice(hit.end - ctx.paragraph.start).match(/^\s+([A-Za-z]+)/)?.[1] ??
          '';
        options =
          /[^s]s$/i.test(nextWord) || /^(people|children|men|women)$/i.test(nextWord)
            ? ['many']
            : ['much'];
      }
      const d = phraseDraft(
        ctx,
        hit,
        options,
        'Use formal language',
        `“${hit.text}” sounds casual for formal writing.`,
      );
      if (d) report(d);
    }
  },
};

const CONTRACTIONS: Record<string, string> = {
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "i'm": 'I am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "what's": 'what is',
  "i'll": 'I will',
  "you'll": 'you will',
  "we'll": 'we will',
  "they'll": 'they will',
  "i've": 'I have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'd": 'I would',
  "let's": 'let us',
};

export const contractions: Rule = {
  id: 'style.contractions',
  category: D,
  name: 'Contractions in formal writing',
  description: 'Expands contractions when your goal is formal.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    if (ctx.goals.formality !== 'formal') return;
    const { text, start } = ctx.paragraph;
    for (const hit of findPhrases(ctx, CONTRACTIONS)) {
      let fix = CONTRACTIONS[hit.key]!;
      const following = text.slice(hit.end - start);
      if (/^\s+(been|got|gotten|had)\b/i.test(following)) {
        fix = fix.replace(/ is$/, ' has').replace(/ would$/, ' had');
      }
      report({
        start: hit.start,
        end: hit.end,
        replacements: [fix.startsWith('I ') ? fix : matchCase(hit.text, fix)],
        title: 'Expand the contraction',
        message: 'Contractions can feel casual in formal writing.',
      });
    }
  },
};

export const inclusive: Rule = {
  id: 'style.inclusive',
  category: D,
  name: 'Inclusive language',
  description: 'Suggests gender-neutral and respectful alternatives.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    for (const hit of findPhrases(ctx, INCLUSIVE)) {
      const d = phraseDraft(
        ctx,
        hit,
        INCLUSIVE[hit.key] ?? [],
        'Use inclusive language',
        `“${hit.text}” may exclude or offend some readers.`,
      );
      if (d) report(d);
    }
  },
};

const ACRONYM_OK = /^(?:[A-Z]{2,5}s?|[A-Z]+\d+|\d+[A-Z]+)$/;

export const shouting: Rule = {
  id: 'style.shouting',
  category: D,
  name: 'Exclamation marks and all caps',
  description: 'Flags repeated exclamation marks and words in all caps.',
  defaultOn: true,
  priority: 1,
  check(ctx, report) {
    const { text, start } = ctx.paragraph;
    const multi = /([!?])\1+|\?!+|!\?+/g;
    for (let m = multi.exec(text); m; m = multi.exec(text)) {
      report({
        start: start + m.index,
        end: start + m.index + m[0].length,
        replacements: [m[0].includes('?') ? '?' : '!'],
        title: 'Remove extra punctuation',
        message: 'Repeated punctuation can feel emotional or unprofessional.',
      });
    }
    let exclaimed = 0;
    for (const s of ctx.paragraph.sentences) {
      const last = s.tokens[s.tokens.length - 1];
      if (last?.text === '!') {
        exclaimed++;
        if (exclaimed === 3 && ctx.goals.formality !== 'informal') {
          report({
            start: last.start,
            end: last.end,
            replacements: ['.'],
            title: 'Use fewer exclamation marks',
            message:
              'Several exclamation marks close together can make your writing feel less serious.',
          });
        }
      }
    }
    const letters = text.replace(/[^A-Za-z]/g, '');
    if (letters.length > 0 && letters === letters.toUpperCase()) return; // whole paragraph is caps: likely a heading
    eachSentence(ctx, ({ tokens }) => {
      for (const t of tokens) {
        if (t.type !== 'word' || t.text.length < 4) continue;
        if (t.text !== t.text.toUpperCase() || !/[A-Z]/.test(t.text)) continue;
        if (ACRONYM_OK.test(t.text) && t.text.length <= 5) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [t.text.toLowerCase()],
          title: 'Avoid all caps',
          message: 'Words in all caps can read as shouting. Use bold or italics for emphasis.',
        });
      }
    });
  },
};

export const DELIVERY_RULES: Rule[] = [
  hedging,
  apologies,
  politeness,
  informalWords,
  formalTone,
  contractions,
  inclusive,
  shouting,
];
