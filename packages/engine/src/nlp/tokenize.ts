import model from 'wink-eng-lite-web-model';
import winkNLP, { type ItemSentence } from 'wink-nlp';

export interface Token {
  /** Index within its sentence. */
  i: number;
  text: string;
  lower: string;
  /** Absolute UTF-16 offsets in the analysed text. */
  start: number;
  end: number;
  /** Universal POS tag (NOUN, VERB, AUX, ADJ, ADV, PRON, DET, ADP, CCONJ, SCONJ, PART, NUM, PROPN, PUNCT, SYM, INTJ, X). */
  pos: string;
  lemma: string;
  /** word | punctuation | number | emoji | url | email | time | ... */
  type: string;
  negated: boolean;
  /** Whitespace immediately before this token. */
  pre: string;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
  tokens: Token[];
}

export interface Paragraph {
  text: string;
  start: number;
  end: number;
  sentences: Sentence[];
  /** Wink sentiment, -1..1. */
  sentiment: number;
}

type Wink = ReturnType<typeof winkNLP>;
let instance: Wink | null = null;

function engine(): Wink {
  instance ??= winkNLP(model, ['sbd', 'negation', 'sentiment', 'pos']);
  return instance;
}

/** Tokenise one paragraph. `offset` is the paragraph's position in the full text. */
export function analyseParagraph(text: string, offset: number): Paragraph {
  const nlp = engine();
  const its = nlp.its;
  const doc = nlp.readDoc(text);
  const sentences: Sentence[] = [];
  let cursor = 0;

  doc.sentences().each((sentence: ItemSentence) => {
    const tks = sentence.tokens();
    // wink's typings do not model every `its` helper, so read columns through one untyped call.
    const column = <T>(helper: unknown): T[] => (tks.out as (h: unknown) => T[])(helper);
    const values = column<string>(its.value);
    const pos = column<string>(its.pos);
    const lemma = column<string>(its.lemma);
    const type = column<string>(its.type);
    const neg = column<boolean>(its.negationFlag);
    const tokens: Token[] = [];

    for (let k = 0; k < values.length; k++) {
      const value = values[k]!;
      if (type[k] === 'tabCRLF') continue;
      let at = text.indexOf(value, cursor);
      if (at < 0) at = cursor;
      const pre = text.slice(cursor, at);
      cursor = at + value.length;
      tokens.push({
        i: tokens.length,
        text: value,
        lower: value.toLowerCase(),
        start: offset + at,
        end: offset + at + value.length,
        pos: pos[k] ?? 'X',
        lemma: (lemma[k] ?? value).toLowerCase(),
        type: type[k] ?? 'word',
        negated: Boolean(neg[k]),
        pre,
      });
    }
    if (tokens.length === 0) return;
    const start = tokens[0]!.start;
    const end = tokens[tokens.length - 1]!.end;
    sentences.push({ text: text.slice(start - offset, end - offset), start, end, tokens });
  });

  const sentiment = Number(doc.out(its.sentiment)) || 0;
  return { text, start: offset, end: offset + text.length, sentences, sentiment };
}

export function isWord(t: Token | undefined): t is Token {
  return Boolean(t && (t.type === 'word' || t.type === 'number') && /[\p{L}\p{N}]/u.test(t.text));
}
