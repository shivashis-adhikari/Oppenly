import type { Paragraph } from '../nlp/tokenize';
import type { ToneId, ToneReading } from '../types';

export const TONE_LABELS: Record<ToneId, string> = {
  confident: 'Confident',
  tentative: 'Tentative',
  formal: 'Formal',
  informal: 'Informal',
  friendly: 'Friendly',
  appreciative: 'Appreciative',
  optimistic: 'Optimistic',
  excited: 'Excited',
  concerned: 'Concerned',
  urgent: 'Urgent',
  apologetic: 'Apologetic',
  direct: 'Direct',
  curious: 'Curious',
  disappointed: 'Disappointed',
  neutral: 'Neutral',
};

type Lexicon = readonly (string | RegExp)[];

const CUES: Partial<Record<ToneId, Lexicon>> = {
  confident: [
    /\bwill\b/,
    'definitely',
    'certainly',
    'confident',
    'clearly',
    'without doubt',
    'guarantee',
    'i know',
    'we know',
    'i am sure',
    "i'm sure",
    'no doubt',
    'proven',
    'committed to',
    'i recommend',
    'we recommend',
  ],
  tentative: [
    'maybe',
    'perhaps',
    'possibly',
    'might',
    'i think',
    'i guess',
    'i suppose',
    'kind of',
    'sort of',
    'somewhat',
    'i was wondering',
    'not sure',
    'probably',
    'i hope',
    'just wanted',
    'if that makes sense',
    'a bit',
    'a little',
  ],
  formal: [
    'regarding',
    'therefore',
    'furthermore',
    'moreover',
    'sincerely',
    'kindly',
    'hereby',
    'pursuant',
    'accordingly',
    'respectfully',
    'dear',
    'please find',
    'with regard to',
    'consequently',
    'nevertheless',
  ],
  informal: [
    'gonna',
    'wanna',
    'gotta',
    'yeah',
    'yep',
    'nope',
    'lol',
    'haha',
    'btw',
    'tbh',
    'kinda',
    'sorta',
    'cool',
    'awesome',
    'hey',
    'guys',
    'stuff',
    'ok',
    'okay',
  ],
  friendly: [
    'hi',
    'hello',
    'hope you',
    'hope this',
    'glad',
    'happy to',
    'pleasure',
    'cheers',
    'warmly',
    'take care',
    'have a great',
    'looking forward',
    'feel free',
    'let me know',
    'welcome',
    'nice to',
  ],
  appreciative: [
    'thank',
    'thanks',
    'appreciate',
    'grateful',
    'gratitude',
    'thankful',
    'kind of you',
    'means a lot',
  ],
  optimistic: [
    'hope',
    'looking forward',
    'excited to',
    'confident',
    'promising',
    'opportunity',
    'bright',
    'positive',
    'progress',
    'better',
    'improve',
    'success',
    'win',
  ],
  excited: [
    'excited',
    "can't wait",
    'cannot wait',
    'thrilled',
    'amazing',
    'awesome',
    'incredible',
    'love',
    'wow',
    'fantastic',
    'delighted',
    'yay',
  ],
  concerned: [
    'worried',
    'concern',
    'concerned',
    'afraid',
    'risk',
    'issue',
    'problem',
    'unfortunately',
    'fear',
    'anxious',
    'trouble',
    'uncertain',
    'unclear',
    'delay',
  ],
  urgent: [
    'urgent',
    'asap',
    'immediately',
    'right away',
    'as soon as possible',
    'deadline',
    'by today',
    'by tomorrow',
    'critical',
    'time-sensitive',
    'end of day',
    'eod',
    'right now',
    'at once',
  ],
  apologetic: [
    'sorry',
    'apologize',
    'apologise',
    'apologies',
    'regret',
    'my mistake',
    'my bad',
    'excuse me',
    'forgive',
  ],
  direct: [
    'please send',
    'please confirm',
    'you need to',
    'you must',
    'we need',
    'i need',
    'do not',
    "don't",
    'make sure',
    'ensure',
  ],
  curious: [
    'wonder',
    'curious',
    'interested in',
    'how does',
    'why does',
    'what if',
    'could you explain',
    'tell me more',
    'how do',
    'what is',
  ],
  disappointed: [
    'disappointed',
    'frustrated',
    'unacceptable',
    'upset',
    'annoyed',
    'not happy',
    'let down',
    'unfortunately',
    'dissatisfied',
    'fed up',
    'again',
  ],
};

function countCue(text: string, cue: string | RegExp): number {
  if (cue instanceof RegExp) {
    const re = new RegExp(cue.source, 'gi');
    return (text.match(re) ?? []).length;
  }
  const re = new RegExp(
    `(?<![a-z])${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]")}(?![a-z])`,
    'gi',
  );
  return (text.match(re) ?? []).length;
}

/**
 * Local tone detection. Combines cue phrases, punctuation, contractions, sentence types and
 * sentiment. Returns up to three tones, strongest first, for texts of 90+ characters.
 */
export function detectTones(text: string, paragraphs: Paragraph[]): ToneReading[] {
  if (text.trim().length < 90) return [];
  const lower = text.toLowerCase();
  const words = Math.max(1, (lower.match(/[a-z']+/g) ?? []).length);
  const sentences = paragraphs.flatMap((p) => p.sentences);
  const nSent = Math.max(1, sentences.length);
  const sentiment = paragraphs.length
    ? paragraphs.reduce((n, p) => n + p.sentiment, 0) / paragraphs.length
    : 0;

  const raw: Partial<Record<ToneId, number>> = {};
  for (const [tone, cues] of Object.entries(CUES) as [ToneId, Lexicon][]) {
    let n = 0;
    for (const cue of cues) n += countCue(lower, cue);
    raw[tone] = (n / words) * 100;
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  const questions = sentences.filter((s) => s.text.trim().endsWith('?')).length;
  const contractions = (lower.match(/\b\w+['’](s|t|re|ve|ll|d|m)\b/g) ?? []).length;
  const emoji = (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
  const imperatives = sentences.filter((s) => {
    const first = s.tokens[0];
    return (
      first && first.pos === 'VERB' && first.lemma === first.lower && !s.text.trim().endsWith('?')
    );
  }).length;
  const longWords = (lower.match(/[a-z]{9,}/g) ?? []).length / words;

  raw.excited = (raw.excited ?? 0) + (exclamations / nSent) * 6 + emoji * 1.5;
  raw.curious = (raw.curious ?? 0) + (questions / nSent) * 8;
  raw.informal =
    (raw.informal ?? 0) + (contractions / words) * 40 + emoji * 2 + (exclamations > 1 ? 2 : 0);
  const greeting = /^(hi|hey|hello|thanks|thank you)\b/i.test(text.trim());
  raw.formal =
    (raw.formal ?? 0) + (contractions === 0 && words > 60 && !greeting ? 0.8 : 0) + longWords * 20;
  raw.direct = (raw.direct ?? 0) + (imperatives / nSent) * 6;
  raw.optimistic = (raw.optimistic ?? 0) + Math.max(0, sentiment) * 6;
  raw.disappointed = (raw.disappointed ?? 0) + Math.max(0, -sentiment) * 6;
  raw.concerned = (raw.concerned ?? 0) + Math.max(0, -sentiment) * 2;
  raw.confident = Math.max(0, (raw.confident ?? 0) + 1.5 - (raw.tentative ?? 0) * 0.8);

  // Formal and informal are opposites: keep only the stronger.
  if ((raw.formal ?? 0) >= (raw.informal ?? 0)) raw.informal = 0;
  else raw.formal = 0;
  if ((raw.confident ?? 0) > (raw.tentative ?? 0) * 1.5) raw.tentative = (raw.tentative ?? 0) * 0.5;

  const ranked = (Object.entries(raw) as [ToneId, number][])
    .filter(([, v]) => v >= 1.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (ranked.length === 0) return [{ id: 'neutral', label: TONE_LABELS.neutral, strength: 0.5 }];
  const top = ranked[0]![1];
  return ranked.map(([id, v]) => ({
    id,
    label: TONE_LABELS[id],
    strength: Math.round(Math.min(1, v / Math.max(top, 4)) * 100) / 100,
  }));
}
