import type { Goals, Suggestion, TextStats } from '../types';

const WEIGHT = { correctness: 5, clarity: 2.5, engagement: 1.2, delivery: 2 } as const;

const READABILITY_TARGET = { general: 60, knowledgeable: 45, expert: 30 } as const;

/**
 * Overall writing score, 0–100. Deducts points per issue (weighted by category and scaled by
 * length) and for readability below the goal audience's target. Null for very short texts.
 */
export function computeScore(
  suggestions: Suggestion[],
  stats: TextStats,
  goals: Goals,
): number | null {
  if (stats.words < 12) return null;
  let penalty = 0;
  for (const s of suggestions) {
    const w = WEIGHT[s.category];
    penalty += s.kind === 'info' ? w * 0.5 : w;
  }
  const perHundred = (penalty * 100) / Math.max(stats.words, 60);
  const issueDeduction = Math.min(70, perHundred * 1.4);
  const target = READABILITY_TARGET[goals.audience];
  const gap = Math.max(0, target - stats.readability);
  const readabilityDeduction = Math.min(12, gap * 0.3);
  return Math.max(0, Math.min(100, Math.round(100 - issueDeduction - readabilityDeduction)));
}
