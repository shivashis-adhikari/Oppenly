import type { Category, Suggestion } from '../types';
import { hash } from '../util/text';

export interface RawEdit {
  find: string;
  before?: string;
  replace: string;
  category?: string;
  title?: string;
  explanation?: string;
}

const CATEGORY_TITLES: Record<Category, string> = {
  correctness: 'Correct the error',
  clarity: 'Improve clarity',
  engagement: 'Choose a better word',
  delivery: 'Adjust the tone',
};

/** Pull the first JSON object out of a model reply (tolerates code fences and stray prose). */
export function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1]! : reply).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in reply');
  return JSON.parse(body.slice(start, end + 1));
}

export function parseEdits(reply: string): RawEdit[] {
  const data = extractJson(reply) as { edits?: unknown };
  if (!data || !Array.isArray(data.edits)) return [];
  return data.edits.filter((e): e is RawEdit => {
    if (!e || typeof e !== 'object') return false;
    const r = e as Record<string, unknown>;
    return typeof r.find === 'string' && typeof r.replace === 'string';
  });
}

function normalize(s: string): string {
  return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

/** Find the unique position of `find` in `passage`, disambiguated by the words before it. */
export function locate(passage: string, find: string, before = ''): number | null {
  if (!find || find.length > 400) return null;
  const positions: number[] = [];
  for (let i = passage.indexOf(find); i >= 0; i = passage.indexOf(find, i + 1)) positions.push(i);
  if (positions.length === 0) return null;
  const anchor = normalize(before);
  if (anchor) {
    const matching = positions.filter((p) =>
      normalize(passage.slice(Math.max(0, p - anchor.length - 40), p)).endsWith(anchor),
    );
    if (matching.length === 1) return matching[0]!;
    if (matching.length > 1) return null;
    // The anchor was paraphrased: fall back to uniqueness of `find` alone.
  }
  return positions.length === 1 ? positions[0]! : null;
}

const CATEGORIES = new Set<Category>(['correctness', 'clarity', 'engagement', 'delivery']);

/** Convert raw edits for `passage` (which starts at `base` in the document) into suggestions. */
export function editsToSuggestions(
  document: string,
  passage: string,
  base: number,
  edits: RawEdit[],
  source: 'ai' | 'device-ai',
): Suggestion[] {
  const out: Suggestion[] = [];
  const taken: [number, number][] = [];
  for (const e of edits) {
    if (e.find === e.replace) continue;
    const at = locate(passage, e.find, e.before);
    if (at === null) continue;
    const start = base + at;
    const end = start + e.find.length;
    if (document.slice(start, end) !== e.find) continue;
    if (taken.some(([a, b]) => start < b && a < end)) continue;
    taken.push([start, end]);
    const category: Category = CATEGORIES.has(e.category as Category)
      ? (e.category as Category)
      : 'correctness';
    const title = (e.title ?? '').trim().slice(0, 60) || CATEGORY_TITLES[category];
    const message = (e.explanation ?? '').trim().slice(0, 240) || 'Suggested by your AI provider.';
    const kind =
      e.replace === '' ? 'remove' : e.find.split(/\s+/).length > 6 ? 'rewrite' : 'replace';
    out.push({
      id: hash(`ai|${e.find}|${e.replace}|${passage.slice(Math.max(0, at - 16), at)}`),
      category,
      rule: `ai.${category}`,
      title,
      message,
      start,
      end,
      original: e.find,
      replacements: [e.replace],
      kind,
      source,
      priority: category === 'correctness' ? 2 : 1,
    });
  }
  return out;
}

/** Remove wrappers models sometimes add around rewritten text. */
export function cleanRewrite(reply: string): string {
  let text = reply.trim();
  const fenced = text.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1]!.trim();
  text = text.replace(
    /^(?:here(?:'s| is)[^\n:]*|sure[^\n:]*|certainly[^\n:]*|rewritten(?: text)?|revised(?: text)?):\s*\n+/i,
    '',
  );
  text = text.replace(/<\/?passage[^>]*>/gi, '').trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”'))
  ) {
    const inner = text.slice(1, -1);
    if (!/["“”]/.test(inner)) text = inner;
  }
  return text;
}
