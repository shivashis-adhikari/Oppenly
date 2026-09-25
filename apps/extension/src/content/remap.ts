import type { Suggestion } from '@oppenly/engine';

/**
 * Keep suggestions aligned while the user types, before a fresh analysis arrives. Finds the one
 * changed region between two texts; suggestions after it shift, suggestions touching it are
 * dropped (they may no longer apply).
 */
export function remap(suggestions: Suggestion[], before: string, after: string): Suggestion[] {
  if (before === after) return suggestions;
  let prefix = 0;
  const max = Math.min(before.length, after.length);
  while (prefix < max && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }
  const oldEnd = before.length - suffix;
  const newEnd = after.length - suffix;
  const delta = after.length - before.length;
  // A suggestion that touches the edit survives only if the edit did not join onto its word
  // ("seen" + "x" -> "seenx" drops it; "seen" + " " keeps it).
  const endsClear = !isWordChar(after[prefix]);
  const startsClear = !isWordChar(after[newEnd - 1]);
  const out: Suggestion[] = [];
  for (const s of suggestions) {
    if (s.end < prefix || (s.end === prefix && endsClear)) out.push(s);
    else if (s.start > oldEnd || (s.start === oldEnd && startsClear))
      out.push({ ...s, start: s.start + delta, end: s.end + delta });
  }
  return out;
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[\p{L}\p{N}'’]/u.test(c);
}
