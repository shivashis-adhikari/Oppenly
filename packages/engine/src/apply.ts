import type { Suggestion } from './types';

/** Apply one replacement to `text`. Returns null when the text no longer matches. */
export function applySuggestion(
  text: string,
  s: Suggestion,
  replacement = s.replacements[0] ?? '',
): string | null {
  if (text.slice(s.start, s.end) !== s.original) return null;
  return text.slice(0, s.start) + replacement + text.slice(s.end);
}

/** Apply several suggestions at once (right to left so offsets stay valid). Skips any that overlap. */
export function applySuggestions(text: string, suggestions: Suggestion[]): string {
  const sorted = [...suggestions]
    .filter((s) => s.kind !== 'info' && s.replacements.length > 0)
    .sort((a, b) => b.start - a.start);
  let out = text;
  let limit = Number.POSITIVE_INFINITY;
  for (const s of sorted) {
    if (s.end > limit) continue;
    if (out.slice(s.start, s.end) !== s.original) continue;
    out = out.slice(0, s.start) + (s.replacements[0] ?? '') + out.slice(s.end);
    limit = s.start;
  }
  return out;
}
