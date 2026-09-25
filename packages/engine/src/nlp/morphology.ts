import type { Token } from './tokenize';

/** base, simple past, past participle */
const IRREGULAR = `
arise arose arisen|awake awoke awoken|be was been|bear bore borne|beat beat beaten|become became become
begin began begun|bend bent bent|bet bet bet|bind bound bound|bite bit bitten|bleed bled bled|blow blew blown
break broke broken|breed bred bred|bring brought brought|build built built|burn burned burned|burst burst burst
buy bought bought|catch caught caught|choose chose chosen|cling clung clung|come came come|cost cost cost
creep crept crept|cut cut cut|deal dealt dealt|dig dug dug|do did done|draw drew drawn|dream dreamed dreamed
drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed fed|feel felt felt|fight fought fought
find found found|flee fled fled|fling flung flung|fly flew flown|forbid forbade forbidden|forget forgot forgotten
forgive forgave forgiven|freeze froze frozen|get got gotten|give gave given|go went gone|grind ground ground
grow grew grown|hang hung hung|have had had|hear heard heard|hide hid hidden|hit hit hit|hold held held
hurt hurt hurt|keep kept kept|kneel knelt knelt|know knew known|lay laid laid|lead led led|leave left left
lend lent lent|let let let|lie lay lain|light lit lit|lose lost lost|make made made|mean meant meant|meet met met
mistake mistook mistaken|overcome overcame overcome|pay paid paid|prove proved proven|put put put|quit quit quit
read read read|ride rode ridden|ring rang rung|rise rose risen|run ran run|say said said|see saw seen
seek sought sought|sell sold sold|send sent sent|set set set|sew sewed sewn|shake shook shaken|shine shone shone
shoot shot shot|show showed shown|shrink shrank shrunk|shut shut shut|sing sang sung|sink sank sunk|sit sat sat
sleep slept slept|slide slid slid|speak spoke spoken|speed sped sped|spend spent spent|spin spun spun|spit spat spat
split split split|spread spread spread|spring sprang sprung|stand stood stood|steal stole stolen|stick stuck stuck
sting stung stung|stink stank stunk|strike struck struck|string strung strung|strive strove striven|swear swore sworn
sweep swept swept|swim swam swum|swing swung swung|take took taken|teach taught taught|tear tore torn|tell told told
think thought thought|throw threw thrown|understand understood understood|undertake undertook undertaken
upset upset upset|wake woke woken|wear wore worn|weave wove woven|weep wept wept|win won won|wind wound wound
withdraw withdrew withdrawn|write wrote written|forecast forecast forecast|mislead misled misled|overtake overtook overtaken
rewrite rewrote rewritten|undo undid undone|withhold withheld withheld|outdo outdid outdone|oversee oversaw overseen`;

interface Forms {
  past: string;
  participle: string;
}

const BY_BASE = new Map<string, Forms>();
const PAST_TO_BASE = new Map<string, string>();
const PARTICIPLE_TO_BASE = new Map<string, string>();

for (const entry of IRREGULAR.split(/[|\n]/)) {
  const parts = entry.trim().split(/\s+/);
  if (parts.length !== 3) continue;
  const [base, past, participle] = parts as [string, string, string];
  BY_BASE.set(base, { past, participle });
  if (!PAST_TO_BASE.has(past)) PAST_TO_BASE.set(past, base);
  if (!PARTICIPLE_TO_BASE.has(participle)) PARTICIPLE_TO_BASE.set(participle, base);
}

/** Wrongly regularised past forms people actually write, mapped to the correct past tense. */
export const OVERREGULARIZED: Record<string, string> = {
  bringed: 'brought',
  brang: 'brought',
  buyed: 'bought',
  catched: 'caught',
  choosed: 'chose',
  drived: 'drove',
  eated: 'ate',
  falled: 'fell',
  feeled: 'felt',
  finded: 'found',
  forgetted: 'forgot',
  goed: 'went',
  growed: 'grew',
  holded: 'held',
  keeped: 'kept',
  knowed: 'knew',
  leaved: 'left',
  losed: 'lost',
  maked: 'made',
  meaned: 'meant',
  payed: 'paid',
  runned: 'ran',
  sayed: 'said',
  selled: 'sold',
  sended: 'sent',
  sitted: 'sat',
  sleeped: 'slept',
  speaked: 'spoke',
  spended: 'spent',
  standed: 'stood',
  stealed: 'stole',
  swimmed: 'swam',
  taked: 'took',
  teached: 'taught',
  telled: 'told',
  thinked: 'thought',
  throwed: 'threw',
  understanded: 'understood',
  weared: 'wore',
  winned: 'won',
  writed: 'wrote',
};

export function irregularForms(base: string): Forms | undefined {
  return BY_BASE.get(base);
}

export function baseFromPast(word: string): string | undefined {
  return PAST_TO_BASE.get(word);
}

export function baseFromParticiple(word: string): string | undefined {
  return PARTICIPLE_TO_BASE.get(word);
}

export function isIrregularParticiple(word: string): boolean {
  return PARTICIPLE_TO_BASE.has(word);
}

const VOWEL = /[aeiou]/;

function regularPast(base: string): string {
  if (base.endsWith('e')) return `${base}d`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ied`;
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(base)) return `${base}${base.at(-1)}ed`;
  return `${base}ed`;
}

export function toPast(base: string): string {
  return BY_BASE.get(base)?.past ?? regularPast(base);
}

export function toParticiple(base: string): string {
  return BY_BASE.get(base)?.participle ?? regularPast(base);
}

export function toThirdPerson(base: string): string {
  switch (base) {
    case 'be':
      return 'is';
    case 'have':
      return 'has';
    case 'do':
      return 'does';
    case 'go':
      return 'goes';
  }
  if (/(s|x|z|ch|sh|o)$/.test(base)) return `${base}es`;
  if (/[^aeiou]y$/.test(base)) return `${base.slice(0, -1)}ies`;
  return `${base}s`;
}

/** Nouns that look plural but take singular verbs, or have no useful singular/plural contrast. */
export const INVARIANT_NOUNS = new Set([
  'news',
  'series',
  'species',
  'means',
  'headquarters',
  'physics',
  'mathematics',
  'economics',
  'politics',
  'ethics',
  'statistics',
  'athletics',
  'gymnastics',
  'linguistics',
  'electronics',
  'logistics',
  'analytics',
  'aerobics',
  'measles',
  'diabetes',
  'billiards',
  'data',
  'media',
  'criteria',
  'sheep',
  'fish',
  'deer',
  'aircraft',
  'crossroads',
  'kudos',
  'lens',
  'bus',
  'gas',
  'plus',
  'bonus',
  'status',
  'campus',
  'virus',
  'census',
  'apparatus',
  'basis',
  'analysis',
  'crisis',
  'thesis',
  'process',
  'business',
  'success',
  'access',
  'address',
  'class',
  'glass',
  'loss',
  'boss',
  'dress',
  'progress',
  'congress',
  'witness',
  'awareness',
  'wellness',
  'fitness',
  'happiness',
  'kindness',
  'illness',
  'darkness',
]);

/** Collective nouns: singular or plural verbs are both acceptable (especially in British English). */
export const COLLECTIVE_NOUNS = new Set([
  'team',
  'staff',
  'family',
  'government',
  'committee',
  'group',
  'company',
  'band',
  'audience',
  'crew',
  'jury',
  'class',
  'public',
  'police',
  'board',
  'council',
  'management',
  'department',
  'faculty',
  'crowd',
  'party',
  'army',
  'couple',
  'majority',
  'minority',
  'number',
  'variety',
  'range',
  'set',
  'pair',
  'lot',
  'bunch',
  'host',
  'total',
  'rest',
  'percent',
  'percentage',
  'half',
  'none',
  'all',
  'most',
  'some',
  'any',
  'more',
]);

const IRREGULAR_PLURALS = new Set([
  'people',
  'children',
  'men',
  'women',
  'feet',
  'teeth',
  'mice',
  'geese',
  'oxen',
  'phenomena',
  'alumni',
  'cacti',
  'fungi',
  'nuclei',
  'syllabi',
  'theses',
  'analyses',
  'crises',
  'hypotheses',
]);

/** Nouns that never take a plural -s in standard English. */
export const UNCOUNTABLE_NOUNS = new Set([
  'information',
  'advice',
  'furniture',
  'equipment',
  'feedback',
  'knowledge',
  'evidence',
  'luggage',
  'baggage',
  'homework',
  'software',
  'hardware',
  'scenery',
  'machinery',
  'garbage',
  'rubbish',
  'jewelry',
  'jewellery',
  'clothing',
  'research',
  'news',
  'traffic',
  'weather',
  'music',
  'money',
  'bread',
  'rice',
  'water',
  'sand',
  'mud',
  'grass',
  'livestock',
  'merchandise',
  'wildlife',
  'vocabulary',
  'grammar',
  'punctuation',
  'mail',
  'stuff',
  'underwear',
  'cutlery',
  'crockery',
  'pollution',
  'patience',
  'courage',
  'honesty',
]);

export function isPluralNoun(t: Token): boolean {
  if (t.pos !== 'NOUN') return false;
  const w = t.lower;
  if (INVARIANT_NOUNS.has(w) || COLLECTIVE_NOUNS.has(w)) return false;
  if (IRREGULAR_PLURALS.has(w)) return true;
  if (!/[a-z]s$/.test(w) || /(ss|us|is)$/.test(w)) return false;
  return t.lemma !== w && t.lemma.length < w.length;
}

export function isSingularCountNoun(t: Token): boolean {
  if (t.pos !== 'NOUN') return false;
  const w = t.lower;
  if (COLLECTIVE_NOUNS.has(w) || INVARIANT_NOUNS.has(w) || IRREGULAR_PLURALS.has(w)) return false;
  if (!/^[a-z]+$/.test(w) || w.length < 3) return false;
  return t.lemma === w && !w.endsWith('s');
}

/** Verb forms that need a singular subject. */
export function isSingularVerb(t: Token): boolean {
  if (t.pos !== 'VERB' && t.pos !== 'AUX') return false;
  if (['is', 'was', 'has', 'does', "'s"].includes(t.lower)) return t.lower !== "'s";
  return /[a-z]s$/.test(t.lower) && t.lemma !== t.lower && toThirdPerson(t.lemma) === t.lower;
}

/** Verb forms that need a plural subject (present tense). */
export function isPluralVerb(t: Token): boolean {
  if (t.pos !== 'VERB' && t.pos !== 'AUX') return false;
  return ['are', 'were', 'have', 'do'].includes(t.lower);
}

export function singularVerbFor(t: Token): string | undefined {
  const map: Record<string, string> = { are: 'is', were: 'was', have: 'has', do: 'does' };
  return map[t.lower];
}

export function pluralVerbFor(t: Token): string | undefined {
  const map: Record<string, string> = { is: 'are', was: 'were', has: 'have', does: 'do' };
  if (map[t.lower]) return map[t.lower];
  if (t.pos === 'VERB' && t.lemma !== t.lower) return t.lemma;
  return undefined;
}

export const SUBJECT_TO_OBJECT: Record<string, string> = {
  i: 'me',
  he: 'him',
  she: 'her',
  we: 'us',
  they: 'them',
};

export const OBJECT_TO_SUBJECT: Record<string, string> = {
  me: 'I',
  him: 'he',
  her: 'she',
  us: 'we',
  them: 'they',
};

export function startsWithVowelSound(word: string): boolean {
  const w = word.toLowerCase();
  if (/^(hour|honest|honou?r|heir)/.test(w)) return true;
  if (/^(uni|use|usu|uti|eu|one|once|ewe|ubiq|uran|ure)/.test(w)) return false;
  return VOWEL.test(w[0] ?? '');
}
