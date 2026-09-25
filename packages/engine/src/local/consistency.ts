import type { Draft } from './rules/types';

/** Groups of spellings that should not be mixed within one document. */
const VARIANTS: readonly (readonly string[])[] = [
  ['email', 'e-mail'],
  ['online', 'on-line'],
  ['website', 'web site'],
  ['ebook', 'e-book'],
  ['percent', 'per cent'],
  ['toward', 'towards'],
  ['okay', 'OK'],
  ['cannot', 'can not'],
  ['setup', 'set-up'],
  ['login', 'log-in'],
  ['startup', 'start-up'],
  ['healthcare', 'health care'],
  ['coworker', 'co-worker'],
  ['cooperate', 'co-operate'],
  ['teammate', 'team-mate'],
  ['nonprofit', 'non-profit'],
  ['mid-year', 'midyear'],
  ['Wi-Fi', 'WiFi', 'wifi'],
  ['JavaScript', 'Javascript'],
  ['GitHub', 'Github'],
  ['iPhone', 'Iphone', 'IPhone'],
  ['LinkedIn', 'Linkedin'],
  ['YouTube', 'Youtube'],
  ['PowerPoint', 'Powerpoint'],
];

function pattern(v: string): RegExp {
  const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const caseSensitive = /[A-Z]/.test(v.slice(1)) || v === 'OK';
  return new RegExp(
    `(?<![\\p{L}\\p{N}-])${escaped}(?![\\p{L}\\p{N}-])`,
    caseSensitive ? 'gu' : 'giu',
  );
}

/**
 * When one term appears in more than one form, suggest the most common form for the others.
 * Ties go to the first form in the group (the modern default).
 */
export function consistencyDrafts(text: string): Draft[] {
  const drafts: Draft[] = [];
  for (const group of VARIANTS) {
    const hits = group.map((v) => {
      const re = pattern(v);
      const found: { start: number; end: number; text: string }[] = [];
      for (let m = re.exec(text); m; m = re.exec(text)) {
        // Case-insensitive groups: make sure we match the variant, not a different-cased cousin.
        if (
          group.some((other) => other !== v && other.toLowerCase() === v.toLowerCase()) &&
          m[0] !== v
        )
          continue;
        found.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
      return { variant: v, found };
    });
    const used = hits.filter((h) => h.found.length > 0);
    if (used.length < 2) continue;
    const winner = [...used].sort(
      (a, b) =>
        b.found.length - a.found.length || group.indexOf(a.variant) - group.indexOf(b.variant),
    )[0]!;
    for (const h of used) {
      if (h === winner) continue;
      for (const f of h.found) {
        const replacement =
          /^[A-Z]/.test(f.text) &&
          /^[a-z]/.test(winner.variant) &&
          !/[A-Z]/.test(winner.variant.slice(1))
            ? winner.variant[0]!.toUpperCase() + winner.variant.slice(1)
            : winner.variant;
        if (replacement === f.text) continue;
        drafts.push({
          start: f.start,
          end: f.end,
          replacements: [replacement],
          title: 'Keep spelling consistent',
          message: `You also wrote “${winner.variant}” in this document. Use one form throughout.`,
        });
      }
    }
  }
  return drafts;
}
