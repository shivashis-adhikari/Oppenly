import {
  baseFromParticiple,
  baseFromPast,
  COLLECTIVE_NOUNS,
  INVARIANT_NOUNS,
  isPluralNoun,
  isPluralVerb,
  isSingularCountNoun,
  isSingularVerb,
  OBJECT_TO_SUBJECT,
  OVERREGULARIZED,
  pluralVerbFor,
  singularVerbFor,
  toPast,
  toThirdPerson,
  UNCOUNTABLE_NOUNS,
} from '../../nlp/morphology';
import type { Token } from '../../nlp/tokenize';
import { isWord } from '../../nlp/tokenize';
import { capitalize, matchCase } from '../../util/text';
import {
  eachSentence,
  hasFiniteVerb,
  lowerIs,
  posIs,
  type Rule,
  SUBJECT_PRONOUNS,
  SUBORDINATORS,
} from './types';

const C = 'correctness' as const;

const COMPARATIVES = new Set([
  'more',
  'less',
  'better',
  'worse',
  'rather',
  'other',
  'fewer',
  'greater',
  'larger',
  'smaller',
  'higher',
  'lower',
  'older',
  'younger',
  'bigger',
  'faster',
  'slower',
  'easier',
  'harder',
  'longer',
  'shorter',
  'earlier',
  'later',
  'further',
  'farther',
  'stronger',
  'weaker',
  'cheaper',
  'richer',
  'smarter',
  'happier',
  'nicer',
  'taller',
  'closer',
  'lesser',
  'else',
]);

export const fewerLess: Rule = {
  id: 'style.fewer-less',
  category: C,
  name: 'Fewer vs. less',
  description: 'Use “fewer” for things you can count.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'less') continue;
        let j = i + 1;
        while (posIs(tokens[j], 'ADJ') && j < i + 3) j++;
        const noun = tokens[j];
        if (!noun || !isPluralNoun(noun)) continue;
        if (lowerIs(tokens[i - 1], 'no', 'much', 'far', 'even', 'a', 'the')) continue;
        if (
          /^(hours|minutes|seconds|days|weeks|months|years|miles|dollars|pounds|euros|percent|kilometers|kilometres|meters|metres|degrees|calories|points|dollars)$/.test(
            noun.lower,
          ) &&
          lowerIs(tokens[j + 1], 'than')
        )
          continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'fewer')],
          title: 'Use “fewer”',
          message: `“${noun.text}” can be counted, so “fewer” fits better than “less”.`,
        });
      }
    });
  },
};

export const thanThen: Rule = {
  id: 'style.than-then',
  category: C,
  name: 'Than vs. then',
  description: 'Use “than” in comparisons.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'then') continue;
        let comparative = false;
        for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
          const p = tokens[k]!;
          if (p.pos === 'PUNCT') break;
          if (
            COMPARATIVES.has(p.lower) ||
            (p.pos === 'ADJ' &&
              /[a-z]{2,}er$/.test(p.lower) &&
              !/(ever|over|under|other|after|never|per|super|inner|outer|upper|proper|clever|sober|former|latter|bitter)$/.test(
                p.lower,
              ))
          ) {
            comparative = true;
            break;
          }
          if (p.pos === 'VERB' && k < i - 1) break;
        }
        if (!comparative) continue;
        if (lowerIs(tokens[i + 1], ',', '.')) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'than')],
          title: 'Use “than” for comparisons',
          message: '“Than” compares things. “Then” refers to time or sequence.',
        });
      }
    });
  },
};

export const yourYoure: Rule = {
  id: 'style.your-youre',
  category: C,
  name: 'Your vs. you’re',
  description: 'Use “you’re” when you mean “you are”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'your') continue;
        const n = tokens[i + 1]!;
        const n2 = tokens[i + 2];
        let hit = false;
        if (n.lower === 'welcome' && (!n2 || n2.pos === 'PUNCT' || lowerIs(n2, 'to'))) hit = true;
        else if (
          [
            'a',
            'an',
            'not',
            'right',
            'wrong',
            'going',
            'being',
            'doing',
            'getting',
            'making',
            'coming',
            'so',
            'too',
            'very',
            'really',
            'always',
            'never',
            'just',
            'still',
            'probably',
          ].includes(n.lower)
        ) {
          if (n.lower === 'right' && n2 && n2.pos === 'NOUN') hit = false;
          else hit = true;
        } else if (
          n.pos === 'VERB' &&
          n.lower.endsWith('ing') &&
          n2 &&
          !posIs(n2, 'NOUN', 'VERB', 'AUX')
        )
          hit = true;
        else if (
          n.pos === 'ADJ' &&
          (!n2 || n2.pos === 'PUNCT' || lowerIs(n2, 'to', 'that', 'for', 'about', 'with'))
        )
          hit = true;
        if (!hit) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'you’re')],
          title: 'Use “you’re”',
          message: '“You’re” is short for “you are”. “Your” shows possession.',
        });
      }
    });
  },
};

export const pronounCaseSubject: Rule = {
  id: 'style.pronoun-case-subject',
  category: C,
  name: 'Pronoun as subject',
  description: 'Use “I”, “he” or “she” when the pronoun does the action.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      // "Me and him went", "Him and me went", "John and me went", "Me and my friend went"
      const and = tokens.findIndex((t, k) => k > 0 && k < 5 && t.lower === 'and');
      if (and < 1) return;
      const left = tokens.slice(0, and);
      let r = and + 1;
      while (
        r < tokens.length &&
        r < and + 5 &&
        ['DET', 'ADJ', 'NOUN', 'PROPN', 'PRON'].includes(tokens[r]!.pos) &&
        !(tokens[r]!.pos === 'PRON' && r > and + 1)
      )
        r++;
      const right = tokens.slice(and + 1, r);
      const verb = tokens[r];
      if (
        !verb ||
        !(verb.pos === 'VERB' || verb.pos === 'AUX') ||
        left.length === 0 ||
        right.length === 0
      )
        return;
      const single = (np: Token[]) =>
        np.length === 1 ? OBJECT_TO_SUBJECT[np[0]!.lower] : undefined;
      const leftFix = single(left);
      const rightFix = single(right);
      if (!leftFix && !rightFix) return;
      if (
        (left.length === 1 && left[0]!.lower === 'her') ||
        (right.length === 1 && right[0]!.lower === 'her')
      ) {
        if (!(leftFix && rightFix)) return;
      }
      const phrase = (np: Token[], fix: string | undefined) =>
        fix ?? np.map((t, k) => (k === 0 ? t.text : (t.pre ? ' ' : '') + t.text)).join('');
      const leftText = phrase(left, leftFix);
      const rightText = phrase(right, rightFix);
      const hasI = leftFix === 'I' || rightFix === 'I';
      const others = [
        leftFix === 'I' ? null : leftText,
        rightFix === 'I' ? null : rightText,
      ].filter((x): x is string => Boolean(x));
      const decapitalize = (w: string) =>
        w === 'I' || (/^[A-Z][a-z]+$/.test(w) && left[0]!.pos === 'PROPN')
          ? w
          : w.charAt(0).toLowerCase() + w.slice(1);
      const ordered = hasI ? [...others.map(decapitalize), 'I'] : others.map(decapitalize);
      const fixed = capitalize(ordered.join(' and '));
      if (
        fixed ===
        tokens
          .slice(0, r)
          .map((t, k) => (k === 0 ? t.text : (t.pre ? ' ' : '') + t.text))
          .join('')
      )
        return;
      report({
        start: tokens[0]!.start,
        end: tokens[r - 1]!.end,
        replacements: [fixed],
        title: 'Change the pronoun',
        message:
          'This is the subject of the sentence, so use the subject form (I, he, she, we, they). Mention yourself last.',
      });
    });
  },
};

const OBJECT_PREPS = new Set([
  'between',
  'for',
  'with',
  'to',
  'from',
  'about',
  'against',
  'among',
  'like',
  'except',
  'behind',
  'beside',
  'without',
  'of',
  'by',
  'toward',
  'towards',
  'near',
  'at',
  'on',
]);

export const pronounCaseObject: Rule = {
  id: 'style.pronoun-case-object',
  category: C,
  name: 'Pronoun as object',
  description: 'Use “me” after prepositions such as “between” or “for”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 2; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t.text !== 'I' || !lowerIs(tokens[i - 1], 'and')) continue;
        const next = tokens[i + 1];
        if (next && (next.pos === 'VERB' || next.pos === 'AUX')) continue;
        let prep: Token | undefined;
        for (let k = i - 2; k >= Math.max(0, i - 5); k--) {
          const p = tokens[k]!;
          if (p.pos === 'VERB' || p.pos === 'AUX' || p.pos === 'PUNCT') break;
          if (OBJECT_PREPS.has(p.lower) && (p.pos === 'ADP' || p.lower === 'between')) {
            prep = p;
            break;
          }
        }
        if (!prep) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: ['me'],
          title: 'Change the pronoun',
          message: `After “${prep.text}”, use the object form “me”.`,
        });
      }
    });
  },
};

function subjectNumber(
  tokens: Token[],
  verbIndex: number,
): { plural: boolean; noun: Token } | null {
  // Walk back from the verb over adjectives/numbers to the head noun; require a clean
  // noun phrase at a clause start (no prepositional phrase in between).
  const noun = tokens[verbIndex - 1];
  if (!noun || noun.pos !== 'NOUN') return null;
  let k = verbIndex - 2;
  while (k >= 0 && posIs(tokens[k], 'ADJ', 'NUM', 'NOUN')) {
    if (tokens[k]!.pos === 'NOUN') return null; // compound nouns: head is ambiguous
    k--;
  }
  const before = tokens[k];
  const cleanStart =
    k < 0 ||
    (before &&
      (before.pos === 'DET' ||
        before.lower === 'these' ||
        before.lower === 'those' ||
        before.lower === 'my' ||
        before.lower === 'our' ||
        before.lower === 'your' ||
        before.lower === 'their' ||
        before.lower === 'his'));
  if (!cleanStart) return null;
  if (before && before.pos === 'DET') {
    const d = before.lower;
    const beforeDet = tokens[k - 1];
    if (
      beforeDet &&
      !(
        beforeDet.pos === 'PUNCT' ||
        beforeDet.pos === 'CCONJ' ||
        beforeDet.pos === 'SCONJ' ||
        SUBORDINATORS.has(beforeDet.lower)
      )
    )
      return null;
    if (['this', 'that', 'each', 'every', 'a', 'an', 'another'].includes(d) && isPluralNoun(noun))
      return null;
  }
  if (COLLECTIVE_NOUNS.has(noun.lower) || INVARIANT_NOUNS.has(noun.lower)) return null;
  if (isPluralNoun(noun)) return { plural: true, noun };
  if (isSingularCountNoun(noun) || UNCOUNTABLE_NOUNS.has(noun.lower))
    return { plural: false, noun };
  return null;
}

export const subjectVerbAgreement: Rule = {
  id: 'style.subject-verb-agreement',
  category: C,
  name: 'Subject–verb agreement',
  description: 'Singular subjects take singular verbs; plural subjects take plural verbs.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length; i++) {
        const v = tokens[i]!;
        if (!(v.pos === 'VERB' || v.pos === 'AUX')) continue;
        const next = tokens[i + 1];
        const subj = subjectNumber(tokens, i);
        if (!subj) continue;
        if (subj.plural && isSingularVerb(v)) {
          const fix = pluralVerbFor(v);
          if (!fix || fix === v.lower) continue;
          if (v.pos === 'VERB' && next && next.pos === 'VERB') continue;
          report({
            start: v.start,
            end: v.end,
            replacements: [matchCase(v.text, fix)],
            title: 'Change the verb form',
            message: `“${subj.noun.text}” is plural, so the verb should be “${fix}”.`,
          });
        } else if (!subj.plural && isPluralVerb(v)) {
          const fix = singularVerbFor(v);
          if (!fix) continue;
          if (v.lower === 'have' || v.lower === 'do') {
            // "The kids' parents have", "the police have" are handled above; skip modal-like uses
            if (lowerIs(tokens[i - 2], 'to')) continue;
          }
          report({
            start: v.start,
            end: v.end,
            replacements: [matchCase(v.text, fix)],
            title: 'Change the verb form',
            message: `“${subj.noun.text}” is singular, so the verb should be “${fix}”.`,
          });
        }
      }

      // "John and Mary is", "He and I goes" → plural verb
      {
        const a = tokens[0];
        const and = tokens[1];
        const b = tokens[2];
        const v = tokens[3];
        const nounish = (t: Token | undefined) =>
          Boolean(
            t && (t.pos === 'PRON' || t.pos === 'PROPN' || (t.pos === 'NOUN' && !isPluralNoun(t))),
          );
        if (nounish(a) && and?.lower === 'and' && nounish(b) && v && isSingularVerb(v)) {
          const fix = pluralVerbFor(v);
          if (fix && fix !== v.lower) {
            report({
              start: v.start,
              end: v.end,
              replacements: [matchCase(v.text, fix)],
              title: 'Change the verb form',
              message: `“${a!.text} and ${b!.text}” is a plural subject, so use “${fix}”.`,
            });
          }
        }
      }

      // "Everyone have", "Nobody are" → singular
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        if (
          ![
            'everyone',
            'everybody',
            'someone',
            'somebody',
            'anyone',
            'anybody',
            'nobody',
            'everything',
            'something',
            'nothing',
            'anything',
          ].includes(t.lower)
        )
          continue;
        const v = tokens[i + 1]!;
        const fix = singularVerbFor(v);
        if (!fix || !isPluralVerb(v)) continue;
        if (tokens[i - 1] && ['that', 'which', 'who', 'what'].includes(tokens[i - 1]!.lower))
          continue;
        report({
          start: v.start,
          end: v.end,
          replacements: [matchCase(v.text, fix)],
          title: 'Change the verb form',
          message: `“${t.text}” is singular, so use “${fix}”.`,
        });
      }

      // "Each of the students have" → has
      for (let i = 0; i < tokens.length - 3; i++) {
        const t = tokens[i]!;
        const isEach =
          ['each', 'neither', 'either'].includes(t.lower) ||
          (t.lower === 'one' && i === 0) ||
          (t.lower === 'every' && lowerIs(tokens[i + 1], 'one'));
        if (!isEach) continue;
        const ofIdx =
          tokens[i + 1]?.lower === 'of' ? i + 1 : tokens[i + 2]?.lower === 'of' ? i + 2 : -1;
        if (ofIdx < 0) continue;
        for (let j = ofIdx + 1; j < Math.min(tokens.length, ofIdx + 6); j++) {
          const v = tokens[j]!;
          if (v.pos === 'PUNCT') break;
          if (v.pos === 'VERB' || v.pos === 'AUX') {
            const fix = singularVerbFor(v);
            if (fix && isPluralVerb(v)) {
              report({
                start: v.start,
                end: v.end,
                replacements: [matchCase(v.text, fix)],
                title: 'Change the verb form',
                message: `“${capitalize(t.text)} of …” refers to one item, so use “${fix}”.`,
              });
            }
            break;
          }
        }
      }

      // "There is many people" / "There are a problem"
      for (let i = 0; i < tokens.length - 2; i++) {
        if (tokens[i]!.lower !== 'there') continue;
        const v = tokens[i + 1]!;
        const n1 = tokens[i + 2]!;
        const n2 = tokens[i + 3];
        if (['is', 'was', "'s"].includes(v.lower) && v.lower !== "'s") {
          const plural =
            [
              'many',
              'several',
              'few',
              'two',
              'three',
              'four',
              'five',
              'some',
              'these',
              'those',
              'both',
              'various',
              'numerous',
            ].includes(n1.lower) &&
            n2 &&
            isPluralNoun(n2);
          const pluralNum =
            n1.pos === 'NUM' &&
            /^\d+$/.test(n1.text) &&
            Number(n1.text) > 1 &&
            n2 &&
            isPluralNoun(n2);
          if (plural || pluralNum) {
            report({
              start: v.start,
              end: v.end,
              replacements: [matchCase(v.text, v.lower === 'is' ? 'are' : 'were')],
              title: 'Change the verb form',
              message: 'The noun that follows is plural, so use a plural verb.',
            });
          }
        } else if (['are', 'were'].includes(v.lower)) {
          if (
            (n1.lower === 'a' || n1.lower === 'an' || n1.lower === 'one') &&
            n2 &&
            isSingularCountNoun(n2) &&
            !COLLECTIVE_NOUNS.has(n2.lower)
          ) {
            const n3 = tokens[i + 4];
            if (n3 && (n3.lower === 'of' || n3.pos === 'NOUN')) continue;
            report({
              start: v.start,
              end: v.end,
              replacements: [matchCase(v.text, v.lower === 'are' ? 'is' : 'was')],
              title: 'Change the verb form',
              message: 'The noun that follows is singular, so use a singular verb.',
            });
          }
        }
      }
    });
  },
};

const NO_AGREEMENT_BEFORE = new Set([
  'let',
  'lets',
  'make',
  'makes',
  'made',
  'help',
  'helps',
  'helped',
  'watch',
  'watched',
  'see',
  'saw',
  'hear',
  'heard',
  'have',
  'had',
  'does',
  'did',
  'do',
  'to',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'and',
  'or',
  'nor',
  'than',
  'bid',
  'feel',
  'felt',
  'notice',
  'noticed',
]);

export const pronounAgreement: Rule = {
  id: 'style.pronoun-agreement',
  category: C,
  name: 'He/she/it + verb',
  description: 'After “he”, “she” or “it”, present-tense verbs take -s.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const p = tokens[i]!;
        if (!['he', 'she', 'it'].includes(p.lower)) continue;
        const v = tokens[i + 1]!;
        if (
          v.pos !== 'VERB' ||
          v.lemma !== v.lower ||
          v.lower.endsWith('ing') ||
          v.lower.endsWith('ed')
        )
          continue;
        if (['be', 'have', 'do', 'need', 'dare'].includes(v.lower)) continue;
        const before = tokens[i - 1];
        if (before && (NO_AGREEMENT_BEFORE.has(before.lower) || before.pos === 'AUX')) continue;
        if (tokens.slice(0, i).some((t) => t.text === '?')) continue;
        const next = tokens[i + 2];
        if (next && next.lower === 'to' && v.lower === 'used') continue;
        const third = toThirdPerson(v.lower);
        const past = toPast(v.lower);
        report({
          start: v.start,
          end: v.end,
          replacements: [matchCase(v.text, third), matchCase(v.text, past)],
          title: 'Change the verb form',
          message: `After “${p.text}”, use “${third}” (present) or “${past}” (past).`,
        });
      }
    });
  },
};

export const uncountablePlural: Rule = {
  id: 'style.uncountable-plural',
  category: C,
  name: 'Uncountable nouns',
  description: 'Words like “information” and “advice” have no plural form.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    const PLURALS: Record<string, string> = {
      informations: 'information',
      advices: 'advice',
      furnitures: 'furniture',
      equipments: 'equipment',
      feedbacks: 'feedback',
      knowledges: 'knowledge',
      evidences: 'evidence',
      luggages: 'luggage',
      baggages: 'baggage',
      homeworks: 'homework',
      softwares: 'software',
      hardwares: 'hardware',
      sceneries: 'scenery',
      machineries: 'machinery',
      garbages: 'garbage',
      rubbishes: 'rubbish',
      jewelries: 'jewelry',
      jewelleries: 'jewellery',
      wildlifes: 'wildlife',
      merchandises: 'merchandise',
      researches: 'research',
    };
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        const fix = PLURALS[t.lower];
        if (!fix) continue;
        if (t.lower === 'researches' && !(posIs(tokens[i - 1], 'DET', 'ADJ') || t.pos === 'NOUN'))
          continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, fix)],
          title: 'Use the singular form',
          message: `“${fix}” is uncountable and has no plural. For quantities, try “pieces of ${fix}”.`,
        });
      }
    });
  },
};

const PARTICIPLE_AS_PAST: Record<string, string> = {
  seen: 'saw',
  done: 'did',
  begun: 'began',
  drunk: 'drank',
  sung: 'sang',
  swum: 'swam',
  rung: 'rang',
  sunk: 'sank',
  shrunk: 'shrank',
  gone: 'went',
  written: 'wrote',
  taken: 'took',
  eaten: 'ate',
  broken: 'broke',
  spoken: 'spoke',
  chosen: 'chose',
  driven: 'drove',
  forgotten: 'forgot',
  given: 'gave',
  ridden: 'rode',
  stolen: 'stole',
  thrown: 'threw',
  flown: 'flew',
  grown: 'grew',
  known: 'knew',
  shown: 'showed',
  fallen: 'fell',
  woken: 'woke',
  worn: 'wore',
  torn: 'tore',
};

export const participleAsPast: Rule = {
  id: 'style.participle-as-past',
  category: C,
  name: 'Past tense vs. past participle',
  description: 'Use “I saw”, not “I seen”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i]!;
        const past = PARTICIPLE_AS_PAST[t.lower];
        if (!past) continue;
        const subj = tokens[i - 1]!;
        if (!SUBJECT_PRONOUNS.has(subj.lower) && !(subj.pos === 'PROPN')) continue;
        if (subj.lower === 'it' && ['done', 'gone', 'known', 'seen'].includes(t.lower)) continue;
        const before = tokens[i - 2];
        if (
          before &&
          (before.pos === 'AUX' ||
            before.pos === 'VERB' ||
            ['have', 'has', 'had', 'got', 'get', 'be', 'been'].includes(before.lower))
        )
          continue;
        const perfect =
          subj.lower === 'he' || subj.lower === 'she' || subj.lower === 'it' || subj.pos === 'PROPN'
            ? 'has'
            : 'have';
        report({
          start: t.start,
          end: t.end,
          replacements: [past, `${perfect} ${t.lower}`],
          title: 'Change the verb form',
          message: `“${t.text}” needs a helper verb (“${perfect} ${t.lower}”). For the simple past, use “${past}”.`,
        });
      }
    });
  },
};

const MODALS = new Set([
  'can',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
]);

export const verbAfterModal: Rule = {
  id: 'style.verb-after-modal',
  category: C,
  name: 'Verb after can/will/did',
  description: 'Use the base form after helper verbs: “can go”, “did know”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const m = tokens[i]!;
        const isModal = MODALS.has(m.lower);
        const isDo =
          ['did', 'does', 'do'].includes(m.lower) ||
          (m.lower === "n't" && lowerIs(tokens[i - 1], 'did', 'does', 'do'));
        if (!isModal && !isDo) continue;
        let j = i + 1;
        if (lowerIs(tokens[j], 'not', "n't")) j++;
        while (posIs(tokens[j], 'ADV') && j < i + 3) j++;
        const v = tokens[j];
        if (!v || v.pos !== 'VERB') continue;
        if (['have', 'be', 'been', 'being', 'had'].includes(v.lower)) continue;
        let base: string | undefined;
        if (/[a-z]s$/.test(v.lower) && v.lemma !== v.lower && !v.lower.endsWith('ss'))
          base = v.lemma;
        else if (
          baseFromPast(v.lower) &&
          baseFromPast(v.lower) !== v.lower &&
          !baseFromParticiple(v.lower)
        )
          base = baseFromPast(v.lower);
        else if (v.lower.endsWith('ed') && v.lemma !== v.lower && isModal) base = v.lemma;
        if (!base) continue;
        if (isDo && m.lower === 'do' && lowerIs(tokens[i - 1], 'to')) continue;
        report({
          start: v.start,
          end: v.end,
          replacements: [matchCase(v.text, base)],
          title: 'Change the verb form',
          message: `After “${m.lower === "n't" ? `${tokens[i - 1]!.text}n't` : m.text}”, use the base form “${base}”.`,
        });
      }
    });
  },
};

export const overregularized: Rule = {
  id: 'style.irregular-past',
  category: C,
  name: 'Irregular past tense',
  description: 'Catches forms like “buyed” and “teached”.',
  defaultOn: true,
  priority: 4,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (const t of tokens) {
        const fix = OVERREGULARIZED[t.lower];
        if (!fix) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, fix)],
          title: 'Correct the verb form',
          message: `The past tense is “${fix}”.`,
        });
      }
    });
  },
};

const NEGATIVE_TO_ANY: Record<string, string> = {
  no: 'any',
  nothing: 'anything',
  nobody: 'anybody',
  nowhere: 'anywhere',
  none: 'any',
  'no one': 'anyone',
};

export const doubleNegative: Rule = {
  id: 'style.double-negative',
  category: C,
  name: 'Double negatives',
  description: '“Don’t have no” means “have some”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (!(t.lower === "n't" || t.lower === 'not' || t.lower === 'never')) continue;
        for (let j = i + 1; j < Math.min(tokens.length, i + 4); j++) {
          const w = tokens[j]!;
          if (w.pos === 'PUNCT' || w.pos === 'CCONJ' || w.pos === 'SCONJ') break;
          const fix = NEGATIVE_TO_ANY[w.lower];
          if (!fix) continue;
          if (
            w.lower === 'no' &&
            lowerIs(tokens[j + 1], 'longer', 'more', 'less', 'matter', 'doubt', 'one')
          )
            break;
          report({
            start: w.start,
            end: w.end,
            replacements: [matchCase(w.text, fix)],
            title: 'Remove the double negative',
            message: `“${t.lower === "n't" ? `${tokens[i - 1]?.text ?? ''}n't` : t.text} … ${w.text}” is a double negative. Use “${fix}”.`,
          });
          break;
        }
      }
    });
  },
};

export const affectEffect: Rule = {
  id: 'style.affect-effect',
  category: C,
  name: 'Affect vs. effect',
  description: '“Affect” is usually the verb; “effect” is usually the noun.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    const VERB_FORMS: Record<string, string> = {
      effect: 'affect',
      effects: 'affects',
      effected: 'affected',
      effecting: 'affecting',
    };
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        const fix = VERB_FORMS[t.lower];
        if (!fix) continue;
        const prev = tokens[i - 1]!;
        const next = tokens[i + 1]!;
        const verbSlot =
          SUBJECT_PRONOUNS.has(prev.lower) ||
          MODALS.has(prev.lower) ||
          [
            'not',
            "n't",
            'to',
            'will',
            'did',
            'does',
            'do',
            'has',
            'have',
            'had',
            'was',
            'were',
            'is',
            'are',
            'be',
            'been',
          ].includes(prev.lower);
        const objectFollows =
          posIs(next, 'PRON', 'DET', 'PROPN') || (next.pos === 'NOUN' && prev.lower !== 'the');
        const pastWithSubject =
          t.lower === 'effected' && (prev.pos === 'NOUN' || prev.pos === 'PROPN');
        if (!(verbSlot || pastWithSubject) || !objectFollows) continue;
        if (/^change/.test(next.lower) || (prev.lower === 'to' && t.lower === 'effect')) continue;
        if (
          ['is', 'are', 'was', 'were', 'be', 'been'].includes(prev.lower) &&
          t.lower !== 'effected'
        )
          continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, fix)],
          title: 'Correct the word choice',
          message: '“Affect” means to influence; “effect” usually means a result.',
        });
      }
    });
  },
};

export const loseLoose: Rule = {
  id: 'style.lose-loose',
  category: C,
  name: 'Lose vs. loose',
  description: '“Lose” is the verb; “loose” means not tight.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'loose' && t.lower !== 'loosing') continue;
        const prev = tokens[i - 1]!;
        const next = tokens[i + 1];
        const verbContext =
          MODALS.has(prev.lower) ||
          ['to', "n't", 'not', 'never', 'will', 'might', 'gonna'].includes(prev.lower) ||
          (t.lower === 'loosing' &&
            ['am', 'is', 'are', 'was', 'were', 'be', 'been', "'m", "'re"].includes(prev.lower));
        if (!verbContext) continue;
        if (next && lowerIs(next, 'end', 'ends', 'fit', 'change', 'thread', 'threads', 'leaf'))
          continue;
        const fix = t.lower === 'loose' ? 'lose' : 'losing';
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, fix)],
          title: 'Correct the word choice',
          message: '“Lose” means to misplace or fail to win. “Loose” means not tight.',
        });
      }
    });
  },
};

export const whoseWhos: Rule = {
  id: 'style.whose-whos',
  category: C,
  name: 'Whose vs. who’s',
  description: '“Whose” shows possession; “who’s” means “who is”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        const n = tokens[i + 1]!;
        // wink splits "who's" into "who" + "'s"
        if (t.lower === 'who' && (n.lower === "'s" || n.lower === '’s')) {
          const noun = tokens[i + 2];
          if (noun && noun.pos === 'NOUN' && !noun.lower.endsWith('ing')) {
            if (lowerIs(noun, 'going', 'coming', 'there', 'here', 'next', 'ready', 'up')) continue;
            report({
              start: t.start,
              end: n.end,
              replacements: [matchCase(t.text, 'whose')],
              title: 'Correct the word choice',
              message: '“Whose” shows ownership. “Who’s” means “who is” or “who has”.',
            });
          }
        } else if (
          t.lower === 'whose' &&
          (n.lower === 'going' ||
            n.lower === 'coming' ||
            n.pos === 'AUX' ||
            (n.pos === 'VERB' && n.lower.endsWith('ing')))
        ) {
          report({
            start: t.start,
            end: t.end,
            replacements: [matchCase(t.text, 'who’s')],
            title: 'Correct the word choice',
            message: '“Who’s” means “who is”. “Whose” shows ownership.',
          });
        }
      }
    });
  },
};

export const toToo: Rule = {
  id: 'style.to-too',
  category: C,
  name: 'To vs. too',
  description: 'Use “too” to mean “excessively” or “also”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    const DEGREE = new Set([
      'much',
      'many',
      'late',
      'early',
      'soon',
      'big',
      'small',
      'long',
      'far',
      'bad',
      'hard',
      'expensive',
      'busy',
      'often',
      'tired',
      'hot',
      'cold',
      'high',
      'low',
      'fast',
      'slow',
      'loud',
      'young',
      'old',
      'close',
      'difficult',
      'complicated',
      'short',
    ]);
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 1; i < tokens.length - 1; i++) {
        const t = tokens[i]!;
        const n = tokens[i + 1]!;
        if (t.lower !== 'to' || !DEGREE.has(n.lower)) continue;
        const after = tokens[i + 2];
        const endish = !after || after.pos === 'PUNCT' || lowerIs(after, 'for', 'to', 'and', 'but');
        if (!endish) continue;
        const prev = tokens[i - 1]!;
        if (
          [
            'go',
            'went',
            'come',
            'came',
            'from',
            'up',
            'down',
            'close',
            'next',
            'due',
            'back',
            'wait',
            'stay',
            'listen',
            'drive',
            'fly',
            'run',
            'walk',
            'move',
            'moved',
            'travel',
          ].includes(prev.lower)
        )
          continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'too')],
          title: 'Correct the word choice',
          message: '“Too” means “excessively” or “also”. “To” is a preposition.',
        });
      }
    });
  },
};

export const subjunctiveWere: Rule = {
  id: 'style.subjunctive-were',
  category: C,
  name: 'If I were',
  description: 'Use “were” for hypotheticals: “If I were you”.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 2; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'was') continue;
        const subj = tokens[i - 1]!;
        const lead = tokens[i - 2]!;
        const hypothetical =
          (lead.lower === 'if' && lowerIs(tokens[i + 1], 'you', 'him', 'her', 'them', 'in')) ||
          (lead.lower === 'wish' && subj.lower === 'i') ||
          (lead.lower === 'wish' && SUBJECT_PRONOUNS.has(subj.lower));
        if (!hypothetical || !SUBJECT_PRONOUNS.has(subj.lower)) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'were')],
          title: 'Use “were”',
          message: 'For hypothetical or wished-for situations, use “were” (the subjunctive).',
        });
      }
    });
  },
};

export const possessivePronouns: Rule = {
  id: 'style.possessive-pronouns',
  category: C,
  name: 'Possessive pronouns',
  description: 'Possessive pronouns never take an apostrophe.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    const re = /\b(your|her|their|our)['’]s\b/gi;
    const { text, start } = ctx.paragraph;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const fix = `${m[1]}s`;
      report({
        start: start + m.index,
        end: start + m.index + m[0].length,
        replacements: [fix],
        title: 'Remove the apostrophe',
        message: `Possessive pronouns like “${fix.toLowerCase()}” don’t use an apostrophe.`,
      });
    }
  },
};

export const reflexiveMisuse: Rule = {
  id: 'style.reflexive-misuse',
  category: C,
  name: 'Myself vs. me',
  description: 'Use “myself” only when “I” is also the subject.',
  defaultOn: true,
  priority: 3,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      const hasI = tokens.some((t) => t.text === 'I');
      if (hasI) return;
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i]!;
        if (t.lower !== 'myself') continue;
        const prev = tokens[i - 1]!;
        const prevOk = prev.pos === 'VERB' || prev.pos === 'ADP' || lowerIs(prev, 'and', 'or');
        if (!prevOk) continue;
        if (lowerIs(prev, 'by', 'for') && lowerIs(tokens[i - 2], 'all')) continue;
        report({
          start: t.start,
          end: t.end,
          replacements: [matchCase(t.text, 'me')],
          title: 'Change the pronoun',
          message:
            '“Myself” is reflexive: use it only when “I” is the subject of the same sentence.',
        });
      }
    });
  },
};

const CONJUNCTIVE = new Set([
  'however',
  'therefore',
  'thus',
  'hence',
  'consequently',
  'otherwise',
  'nevertheless',
  'nonetheless',
  'meanwhile',
  'moreover',
  'furthermore',
  'besides',
  'instead',
  'then',
]);

export const commaSplice: Rule = {
  id: 'style.comma-splice',
  category: C,
  name: 'Comma splices',
  description: 'Two full sentences joined only by a comma.',
  defaultOn: true,
  priority: 2,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      if (tokens.length < 7) return;
      if (SUBORDINATORS.has(tokens[0]!.lower) || tokens[0]!.pos === 'ADP') return;
      if (
        /^(the (moment|minute|day|time|second)|every time|each time|now that|as soon as|the more|the less)\b/i.test(
          tokens
            .slice(0, 3)
            .map((t) => t.text)
            .join(' '),
        )
      )
        return;
      if (tokens.some((t) => t.text === '"' || t.text === '“' || t.text === '”')) return;
      for (let i = 2; i < tokens.length - 2; i++) {
        const comma = tokens[i]!;
        if (comma.text !== ',') continue;
        const left = tokens.slice(0, i);
        let k = i + 1;
        const conj = CONJUNCTIVE.has(tokens[k]!.lower) ? tokens[k]! : null;
        if (conj) k++;
        if (lowerIs(tokens[k], ',')) k++;
        const subj = tokens[k];
        const verb = tokens[k + 1];
        if (!subj || !verb) continue;
        const subjectLike =
          SUBJECT_PRONOUNS.has(subj.lower) ||
          subj.lower === 'this' ||
          subj.lower === 'that' ||
          (subj.lower === 'there' && lowerIs(verb, 'is', 'are', 'was', 'were'));
        if (!subjectLike) continue;
        if (!(verb.pos === 'VERB' || verb.pos === 'AUX')) continue;
        if (verb.lower.endsWith('ing') && verb.pos === 'VERB') continue;
        if (left.length < 3 || !hasFiniteVerb(left)) continue;
        if (left.some((t) => t.pos === 'SCONJ' || (SUBORDINATORS.has(t.lower) && t.lower !== 'so')))
          continue;
        if (left.some((t) => ['due', 'despite', 'given', 'considering'].includes(t.lower)))
          continue;
        if (left.filter((t) => t.text === ',').length > 0) continue;
        const leftVerbIdx = left.findIndex((t) => t.pos === 'AUX' || t.pos === 'VERB');
        if (leftVerbIdx < 1) continue;
        if (
          ['said', 'says', 'think', 'thought', 'guess', 'mean', 'know', 'see', 'hope'].includes(
            left[left.length - 1]!.lower,
          )
        )
          continue;
        const spanEnd = conj ? tokens[k - 1]!.end : subj.end;
        const replacements = conj
          ? [`; ${conj.lower},`, `. ${capitalize(conj.lower)},`]
          : [`; ${subj.text}`, `. ${capitalize(subj.text)}`];
        report({
          start: comma.start,
          end: spanEnd,
          replacements,
          title: 'Fix the comma splice',
          message:
            'Two complete sentences are joined with just a comma. Use a semicolon or split them.',
        });
        return;
      }
    });
  },
};

const COORDINATORS = new Set(['but', 'so', 'yet', 'and', 'or']);

export const compoundComma: Rule = {
  id: 'style.compound-comma',
  category: C,
  name: 'Comma in compound sentences',
  description: 'Add a comma before “but”, “so” or “and” when they join two full sentences.',
  defaultOn: true,
  priority: 2,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      for (let i = 3; i < tokens.length - 2; i++) {
        const c = tokens[i]!;
        if (!COORDINATORS.has(c.lower) || c.pos !== 'CCONJ') continue;
        if (tokens[i - 1]!.pos === 'PUNCT') continue;
        const subj = tokens[i + 1]!;
        const verb = tokens[i + 2]!;
        if (!(SUBJECT_PRONOUNS.has(subj.lower) || subj.lower === 'there')) continue;
        if (!(verb.pos === 'VERB' || verb.pos === 'AUX')) continue;
        const left = tokens.slice(0, i);
        const right = tokens.slice(i + 1);
        if (!hasFiniteVerb(left) || !hasFiniteVerb(right)) continue;
        const minWords = c.lower === 'and' || c.lower === 'or' ? 5 : 3;
        if (left.filter(isWord).length < minWords || right.filter(isWord).length < minWords)
          continue;
        if (left.some((t) => t.text === ',')) continue;
        const prev = tokens[i - 1]!;
        report({
          start: prev.start,
          end: c.end,
          replacements: [`${prev.text}, ${c.text}`],
          title: 'Add a comma',
          message: `Use a comma before “${c.text}” when it joins two complete sentences.`,
          kind: 'insert',
        });
      }
    });
  },
};

const INTRO_WORDS = new Set([
  'however',
  'therefore',
  'unfortunately',
  'fortunately',
  'meanwhile',
  'moreover',
  'furthermore',
  'consequently',
  'nevertheless',
  'nonetheless',
  'additionally',
  'finally',
  'firstly',
  'secondly',
  'thirdly',
  'lastly',
  'honestly',
  'instead',
  'otherwise',
  'ideally',
  'personally',
  'surprisingly',
  'interestingly',
  'importantly',
  'hopefully',
  'luckily',
  'sadly',
  'clearly',
  'obviously',
  'basically',
  'overall',
  'yes',
  'thankfully',
  'similarly',
  'likewise',
  'regardless',
  'besides',
]);

const INTRO_PHRASES = [
  ['in', 'addition'],
  ['for', 'example'],
  ['for', 'instance'],
  ['on', 'the', 'other', 'hand'],
  ['in', 'conclusion'],
  ['as', 'a', 'result'],
  ['of', 'course'],
  ['in', 'fact'],
  ['in', 'other', 'words'],
  ['in', 'the', 'meantime'],
  ['to', 'be', 'honest'],
  ['in', 'short'],
  ['in', 'general'],
  ['by', 'the', 'way'],
  ['at', 'the', 'same', 'time'],
  ['on', 'the', 'contrary'],
  ['after', 'all'],
  ['above', 'all'],
  ['all', 'in', 'all'],
  ['in', 'summary'],
];

export const introComma: Rule = {
  id: 'style.intro-comma',
  category: C,
  name: 'Comma after introductory words',
  description: 'Add a comma after words like “However” at the start of a sentence.',
  defaultOn: true,
  priority: 2,
  check(ctx, report) {
    eachSentence(ctx, ({ tokens }) => {
      let len = 0;
      const first = tokens[0];
      if (!first) return;
      if (INTRO_WORDS.has(first.lower)) len = 1;
      else {
        for (const phrase of INTRO_PHRASES) {
          if (phrase.every((w, k) => tokens[k]?.lower === w)) {
            len = phrase.length;
            break;
          }
        }
      }
      if (!len) return;
      const last = tokens[len - 1]!;
      const next = tokens[len];
      const after = tokens[len + 1];
      if (!next || next.pos === 'PUNCT') return;
      // Only when a clause follows: subject + verb soon after
      const subjectish =
        SUBJECT_PRONOUNS.has(next.lower) ||
        next.pos === 'DET' ||
        next.pos === 'PROPN' ||
        next.pos === 'NOUN' ||
        next.lower === 'there' ||
        next.lower === 'this';
      if (!subjectish || !after) return;
      if (first.lower === 'yes' && next.pos !== 'PRON') return;
      if (
        [
          'however',
          'otherwise',
          'instead',
          'finally',
          'overall',
          'clearly',
          'obviously',
          'basically',
          'honestly',
          'personally',
          'ideally',
        ].includes(first.lower) &&
        len === 1
      ) {
        // "However you do it" / "Finally arrived" are fine without a comma: require a pronoun or determiner subject then a verb
        const verbSoon = tokens
          .slice(len + 1, len + 4)
          .some((t) => t.pos === 'VERB' || t.pos === 'AUX');
        if (!verbSoon) return;
        if (
          first.lower === 'however' &&
          lowerIs(next, 'much', 'many', 'long', 'you', 'hard', 'big', 'small')
        )
          return;
      }
      report({
        start: last.start,
        end: last.end,
        replacements: [`${last.text},`],
        title: 'Add a comma',
        message: `Add a comma after an introductory ${len === 1 ? 'word' : 'phrase'}.`,
        kind: 'insert',
      });
    });
  },
};

export const CORRECTNESS_RULES: Rule[] = [
  fewerLess,
  thanThen,
  yourYoure,
  pronounCaseSubject,
  pronounCaseObject,
  subjectVerbAgreement,
  pronounAgreement,
  uncountablePlural,
  participleAsPast,
  verbAfterModal,
  overregularized,
  doubleNegative,
  affectEffect,
  loseLoose,
  whoseWhos,
  toToo,
  subjunctiveWere,
  possessivePronouns,
  reflexiveMisuse,
  commaSplice,
  compoundComma,
  introComma,
];
