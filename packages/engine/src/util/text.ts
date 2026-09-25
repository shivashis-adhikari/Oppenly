/** FNV-1a, 32-bit. Fast, deterministic, good enough for cache keys and suggestion ids. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Apply the capitalisation pattern of `source` to `target`. */
export function matchCase(source: string, target: string): string {
  if (!target) return target;
  const letters = source.replace(/[^A-Za-z]/g, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return target.toUpperCase();
  const first = source.match(/[A-Za-z]/)?.[0];
  if (first && first === first.toUpperCase()) return capitalize(target);
  return target;
}

export function capitalize(s: string): string {
  const i = s.search(/[A-Za-z]/);
  if (i < 0) return s;
  return s.slice(0, i) + s[i]!.toUpperCase() + s.slice(i + 1);
}

export function isCapitalized(s: string): boolean {
  const c = s.match(/[A-Za-z]/)?.[0];
  return Boolean(c && c === c.toUpperCase());
}

export interface ParagraphSpan {
  text: string;
  start: number;
  end: number;
}

/** Split on line breaks. Empty lines are dropped; offsets point into the original text. */
export function splitParagraphs(text: string): ParagraphSpan[] {
  const out: ParagraphSpan[] = [];
  const re = /[^\n]+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0].trim().length === 0) continue;
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
