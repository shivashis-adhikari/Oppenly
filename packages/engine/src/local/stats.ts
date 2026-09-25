import type { Paragraph } from '../nlp/tokenize';
import type { TextStats } from '../types';
import { COMMON_WORDS } from './data/common-words';

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Syllable estimate for English words (good to within one syllable on most words). */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Words per minute. Silent reading and speaking aloud. */
const READING_WPM = 238;
const SPEAKING_WPM = 150;

export function computeStats(text: string, paragraphs: Paragraph[]): TextStats {
  const words = text.match(WORD) ?? [];
  const wordCount = words.length;
  const sentenceCount = paragraphs.reduce((n, p) => n + p.sentences.length, 0);
  const letters = words.reduce((n, w) => n + w.replace(/[^\p{L}\p{N}]/gu, '').length, 0);
  const syllableCount = words.reduce((n, w) => n + syllables(w), 0);
  const lower = words.map((w) => w.toLowerCase().replace(/’/g, "'"));
  const unique = new Set(lower).size;
  const alpha = lower.filter((w) => /^[a-z]+$/.test(w));
  const rare = alpha.filter((w) => !COMMON_WORDS.has(w)).length;

  let longest = 0;
  for (const p of paragraphs) {
    for (const s of p.sentences) {
      const n = (s.text.match(WORD) ?? []).length;
      if (n > longest) longest = n;
    }
  }

  const wps = sentenceCount ? wordCount / sentenceCount : 0;
  const spw = wordCount ? syllableCount / wordCount : 0;
  const flesch = wordCount ? 206.835 - 1.015 * wps - 84.6 * spw : 0;

  return {
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    words: wordCount,
    sentences: sentenceCount,
    paragraphs: paragraphs.length,
    readingTime: Math.round((wordCount / READING_WPM) * 60),
    speakingTime: Math.round((wordCount / SPEAKING_WPM) * 60),
    averageWordLength: wordCount ? letters / wordCount : 0,
    averageSentenceLength: wps,
    readability: Math.round(Math.max(0, Math.min(100, flesch))),
    uniqueWords: wordCount ? unique / wordCount : 0,
    rareWords: alpha.length ? rare / alpha.length : 0,
    longestSentenceWords: longest,
  };
}

/** Human-friendly duration: "12 sec", "3 min 5 sec". */
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
