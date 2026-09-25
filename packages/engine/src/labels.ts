// Small display helpers with no heavy dependencies, safe to load anywhere.

/** Rewrite modes available without any AI. */
export type LocalRewriteMode = 'shorten' | 'formal' | 'friendly' | 'confident' | 'simplify';

export const LOCAL_REWRITE_LABELS: Record<LocalRewriteMode, string> = {
  shorten: 'Shorten it',
  formal: 'Sound formal',
  friendly: 'Sound friendly',
  confident: 'Sound confident',
  simplify: 'Simplify it',
};

/** "45 sec", "3 min", "3 min 20 sec". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

export function readabilityLabel(score: number): string {
  if (score >= 80) return 'Very easy to read';
  if (score >= 70) return 'Easy to read';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

/** The schooling a reader likely needs for a Flesch reading-ease score. */
export function readingLevel(score: number): string {
  if (score >= 90) return 'a reader with a 5th-grade education (about age 11)';
  if (score >= 80) return 'a reader with a 6th-grade education (about age 12)';
  if (score >= 70) return 'a reader with a 7th-grade education (about age 13)';
  if (score >= 60) return 'a reader with an 8th- or 9th-grade education (about age 14)';
  if (score >= 50) return 'a reader with a 10th- to 12th-grade education (about age 16)';
  if (score >= 30) return 'a reader with some college education';
  return 'a reader with a college degree';
}
