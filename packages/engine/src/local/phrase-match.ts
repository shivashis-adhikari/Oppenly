import { capitalize, escapeRegExp, matchCase } from '../util/text';
import type { Draft, RuleContext } from './rules/types';

export interface PhraseHit {
  /** Absolute offsets. */
  start: number;
  end: number;
  /** Lowercase table key that matched. */
  key: string;
  text: string;
}

const cache = new WeakMap<object, RegExp>();

function toPattern(key: string): string {
  return escapeRegExp(key).replace(/\s+/g, '\\s+').replace(/'/g, "['’]");
}

export function phraseRegex(table: Record<string, unknown>): RegExp {
  let re = cache.get(table);
  if (!re) {
    const keys = Object.keys(table).sort((a, b) => b.length - a.length);
    const body = keys.map(toPattern).join('|');
    re = new RegExp(`(?<![\\p{L}\\p{N}'’-])(?:${body})(?![\\p{L}\\p{N}'’-])`, 'giu');
    cache.set(table, re);
  }
  return re;
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/’/g, "'");
}

export function findPhrases(ctx: RuleContext, table: Record<string, unknown>): PhraseHit[] {
  const re = phraseRegex(table);
  const { text, start: offset } = ctx.paragraph;
  const hits: PhraseHit[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const key = normalizeKey(m[0]);
    if (!(key in table)) continue;
    hits.push({ start: offset + m.index, end: offset + m.index + m[0].length, key, text: m[0] });
  }
  return hits;
}

/** True when nothing but whitespace or an opening quote precedes `index` in its sentence. */
export function atSentenceStart(text: string, localIndex: number): boolean {
  const before = text.slice(0, localIndex).replace(/[\s"“'‘(]+$/, '');
  return before.length === 0 || /[.!?:]$/.test(before);
}

/**
 * Turn a phrase hit into a draft, handling removals so the result reads cleanly:
 * removes the neighbouring space or comma and re-capitalises a sentence start.
 */
export function phraseDraft(
  ctx: RuleContext,
  hit: PhraseHit,
  replacements: string[],
  title: string,
  message: string,
): Draft | null {
  const text = ctx.paragraph.text;
  const off = ctx.paragraph.start;
  let s = hit.start - off;
  let e = hit.end - off;
  const startOfSentence = atSentenceStart(text, s);
  const out: string[] = [];
  let removal = false;

  for (const r of replacements) {
    if (r === '') {
      removal = true;
      continue;
    }
    out.push(startOfSentence ? capitalize(r) : matchCase(hit.text, r));
  }

  if (!removal) {
    return { start: hit.start, end: hit.end, replacements: out, title, message };
  }

  // Removal: compute a wider span so spacing and punctuation stay correct.
  const after = text.slice(e);
  const trailing = after.match(/^,?\s+/)?.[0] ?? '';
  if (startOfSentence) {
    const next = after.slice(trailing.length).match(/^[\p{L}'’]+/u)?.[0];
    if (!next) return null;
    const newEnd = e + trailing.length + next.length;
    const replacement = capitalize(next);
    return {
      start: off + s,
      end: off + newEnd,
      replacements: [replacement, ...out.map((r) => `${r} ${next}`)],
      title,
      message,
      kind: 'remove',
    };
  }
  if (trailing) {
    e += trailing.length;
  } else {
    const lead = text.slice(0, s).match(/,?\s+$/)?.[0] ?? '';
    s -= lead.length;
  }
  return {
    start: off + s,
    end: off + e,
    replacements: ['', ...out.map((r) => matchCase(hit.text, r) + (trailing ? ' ' : ''))],
    title,
    message,
    kind: 'remove',
  };
}
