import { capitalize, escapeRegExp, matchCase } from '../util/text';
import {
  CLICHES,
  COMPLEX_WORDS,
  FORMAL_ONLY,
  HEDGES,
  INFORMAL,
  type PhraseTable,
  REDUNDANT,
  WORDY,
} from './data/phrases';

/** Rewrite modes available without any AI. */
export type LocalRewriteMode = 'shorten' | 'formal' | 'friendly' | 'confident' | 'simplify';

export const LOCAL_REWRITE_LABELS: Record<LocalRewriteMode, string> = {
  shorten: 'Shorten it',
  formal: 'Sound formal',
  friendly: 'Sound friendly',
  confident: 'Sound confident',
  simplify: 'Simplify it',
};

function tableRegex(table: PhraseTable): RegExp {
  const keys = Object.keys(table).sort((a, b) => b.length - a.length);
  const body = keys
    .map((k) => escapeRegExp(k).replace(/\s+/g, '\\s+').replace(/'/g, "['’]"))
    .join('|');
  return new RegExp(`(?<![\\p{L}\\p{N}'’-])(?:${body})(?![\\p{L}\\p{N}'’-])`, 'giu');
}

function applyTable(text: string, table: PhraseTable, opts: { allowRemoval: boolean }): string {
  const re = tableRegex(table);
  return text.replace(re, (match) => {
    const key = match.toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");
    const options = table[key];
    if (!options) return match;
    const first = options.find((o) => o !== '');
    if (options[0] === '' || first === undefined) {
      if (opts.allowRemoval) return '\uE000';
      return first === undefined ? match : matchCase(match, first);
    }
    return matchCase(match, first);
  });
}

/** Tidy spacing and capitalisation after phrase removals. */
function tidy(text: string): string {
  return text
    .replace(/\uE000,?\s*/g, '\uE001')
    .replace(/\s*\uE001([.!?])/g, '$1')
    .replace(/\uE001/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/,([.!?])/g, '$1')
    .replace(/(^|[.!?]\s+|\n\s*)([a-z])/g, (_, lead: string, c: string) => lead + c.toUpperCase())
    .trim();
}

const EXPAND: Record<string, string> = {
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
  "i'm": 'I am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "i'll": 'I will',
  "we'll": 'we will',
  "you'll": 'you will',
  "i've": 'I have',
  "we've": 'we have',
  "let's": 'let us',
};

const CONTRACT: Record<string, string> = {
  'do not': "don't",
  'does not': "doesn't",
  'did not': "didn't",
  cannot: "can't",
  'will not': "won't",
  'would not': "wouldn't",
  'should not': "shouldn't",
  'is not': "isn't",
  'are not': "aren't",
  'was not': "wasn't",
  'have not': "haven't",
  'i am': "I'm",
  'you are': "you're",
  'we are': "we're",
  'they are': "they're",
  'it is': "it's",
  'that is': "that's",
  'i will': "I'll",
  'we will': "we'll",
  'i have': "I've",
  'let us': "let's",
};

const STIFF_TO_FRIENDLY: PhraseTable = {
  'please be advised that': ['just so you know,'],
  'i am writing to inform you that': ['I wanted to let you know that'],
  'we regret to inform you that': ['unfortunately,'],
  'at your earliest convenience': ['when you get a chance'],
  kindly: ['please'],
  'dear sir or madam': ['hello'],
  'to whom it may concern': ['hello'],
  'please do not hesitate to contact me': ['feel free to reach out'],
  'please do not hesitate to': ['feel free to'],
  'i look forward to hearing from you': ['talk soon'],
  'thank you for your cooperation': ['thanks for your help'],
  'further to our conversation': ['following up on our chat'],
  'as per': ['as in'],
};

const FORMAL_FROM_CASUAL: PhraseTable = {
  ...INFORMAL,
  ...FORMAL_ONLY,
  hey: ['hello'],
  thanks: ['thank you'],
  'no problem': ['you are welcome'],
  'sounds good': ['that works well'],
  'let me know': ['please let me know'],
};

function expandContractions(text: string): string {
  const re = new RegExp(
    `(?<![\\p{L}])(?:${Object.keys(EXPAND)
      .map((k) => escapeRegExp(k).replace(/'/g, "['’]"))
      .join('|')})(?![\\p{L}])`,
    'giu',
  );
  return text.replace(re, (m, offset: number, whole: string) => {
    let fix = EXPAND[m.toLowerCase().replace(/’/g, "'")] ?? m;
    if (/^\s+(been|got|had)\b/i.test(whole.slice(offset + m.length)))
      fix = fix.replace(/ is$/, ' has');
    return fix.startsWith('I ') ? fix : matchCase(m, fix);
  });
}

function contract(text: string): string {
  const re = new RegExp(
    `(?<![\\p{L}])(?:${Object.keys(CONTRACT).map(escapeRegExp).join('|')})(?![\\p{L}])`,
    'giu',
  );
  return text.replace(re, (m) => {
    const fix = CONTRACT[m.toLowerCase()] ?? m;
    return fix.startsWith("I'") ? fix : matchCase(m, fix);
  });
}

/** Complex words whose plain replacement is also shorter ("utilize" -> "use"). */
const SHORTER_WORDS: PhraseTable = Object.fromEntries(
  Object.entries(COMPLEX_WORDS).filter(
    ([word, options]) =>
      options[0] !== undefined && options[0] !== '' && options[0].length < word.length,
  ),
);

const FILLERS =
  /(?<![\p{L}])(?:basically|actually|literally|totally|really|very|quite|just|simply)\s+(?=[\p{L}])/giu;

/**
 * Deterministic, offline rewrites. They never invent content: each mode only removes,
 * contracts, expands or swaps words from curated tables.
 */
export function localRewrite(text: string, mode: LocalRewriteMode): string {
  let out = text;
  switch (mode) {
    case 'shorten':
      out = applyTable(out, WORDY, { allowRemoval: true });
      out = applyTable(out, REDUNDANT, { allowRemoval: true });
      out = applyTable(out, HEDGES, { allowRemoval: true });
      out = applyTable(out, CLICHES, { allowRemoval: true });
      out = applyTable(out, SHORTER_WORDS, { allowRemoval: false });
      out = out.replace(FILLERS, '');
      break;
    case 'formal':
      out = expandContractions(out);
      out = out.replace(
        /(?<![\p{L}])(a lot of|lots of|tons of)(\s+)([\p{L}]+)/giu,
        (_m, phrase: string, gap: string, word: string) => {
          const plural = /[^s]s$/i.test(word) || /^(people|children|men|women)$/i.test(word);
          return matchCase(phrase, plural ? 'many' : 'much') + gap + word;
        },
      );
      out = applyTable(out, FORMAL_FROM_CASUAL, { allowRemoval: false });
      out = out.replace(/!+/g, '.').replace(/\.{2,}(?!\.)/g, '.');
      break;
    case 'friendly':
      out = applyTable(out, STIFF_TO_FRIENDLY, { allowRemoval: false });
      out = contract(out);
      break;
    case 'confident':
      out = applyTable(out, HEDGES, { allowRemoval: true });
      out = out.replace(/(?<![\p{L}])(?:maybe|perhaps|possibly|probably)\s+(?=[\p{L}])/giu, '');
      out = out.replace(/(?<![\p{L}])(?:i think|i believe|i feel|i guess)\s+(?:that\s+)?/giu, '');
      break;
    case 'simplify':
      out = applyTable(out, COMPLEX_WORDS, { allowRemoval: false });
      out = applyTable(out, WORDY, { allowRemoval: true });
      break;
  }
  const result = tidy(out);
  // Preserve a leading capital or lowercase start exactly as the user had it.
  return /^[a-z]/.test(text.trimStart())
    ? result.charAt(0).toLowerCase() + result.slice(1)
    : capitalize(result);
}
