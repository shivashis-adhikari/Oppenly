import { CLEAN_TEXTS } from './corpus';
import { check } from './helpers';

/** [text, original, expected first replacement] */
const CASES: [string, string, string][] = [
  ['Their going to the store tomorow.', 'tomorow', 'tomorrow'],
  ['Their going to the store tomorrow.', 'Their', "They're"],
  ['They will buy alot of apples.', 'alot', 'a lot'],
  ['Me and him goes to school every day.', 'Me and him', 'He and I'],
  ['Me and him goes to school every day.', 'goes', 'go'],
  ['Me and my friend went to the mall.', 'Me and my friend', 'My friend and I'],
  ['The data shows that the results is significant.', 'is', 'are'],
  ['Each of the students have their own book.', 'have', 'has'],
  ['Everyone have finished the test.', 'have', 'has'],
  ['Less people came than we expected.', 'Less', 'Fewer'],
  ['More people came then we expected.', 'then', 'than'],
  ['Your welcome to join us.', 'Your', 'You’re'],
  ['I seen him at the store yesterday.', 'seen', 'saw'],
  ['It start raining when we left.', 'start', 'starts'],
  ['She go to school by bus.', 'go', 'goes'],
  ['I have went there before.', 'went', 'gone'],
  ['The informations you provided were helpful.', 'informations', 'information'],
  ['Between you and I, this is a secret.', 'I', 'me'],
  ['The storm effected everyone in the town.', 'effected', 'affected'],
  ['We were going to the park but it started raining heavily.', 'park but', 'park, but'],
  ['I would like to discuss this in order to make progress.', 'in order to', 'to'],
  ['It was reviewed by the manager.', 'It was reviewed by the manager', 'The manager reviewed it'],
  [
    'The report was written by the team.',
    'The report was written by the team',
    'The team wrote the report',
  ],
  ['He can plays the guitar.', 'plays', 'play'],
  ["I don't have no money left.", 'no', 'any'],
  ['If I was you, I would call her.', 'was', 'were'],
  ['Please contact myself if you have questions.', 'myself', 'me'],
  ['The dogs barks loudly at night.', 'barks', 'bark'],
  ['There is many reasons to stay.', 'is', 'are'],
  [
    'Sorry for the late reply, here is the file.',
    'Sorry for the late reply',
    'Thank you for your patience',
  ],
  ['The service was very bad.', 'very bad', 'terrible'],
  ['We need more manpower for this project.', 'manpower', 'workforce'],
  ['It is to late to change the plan.', 'to', 'too'],
  ['Who’s car is parked outside?', 'Who’s', 'Whose'],
  ['She teached me how to swim.', 'teached', 'taught'],
  ['This is your’s, not mine.', 'your’s', 'yours'],
  ['The end result was a total success.', 'end result', 'result'],
  ['This is a very unique opportunity.', 'very unique', 'unique'],
  ['We should utilize the new tool.', 'utilize', 'use'],
  ["Don't loose your ticket.", 'loose', 'lose'],
  ['I am gonna finish it tonight.', 'gonna', 'going to'],
  ['That was really great!!', '!!', '!'],
  ['The policy had a big affect on sales.', 'affect', 'effect'],
  ['He is more taller than his brother.', 'more taller', 'taller'],
  ['She dont know the answer.', 'dont', "don't"],
  ['I was wondering if you could send me the file.', 'I was wondering if you could', 'Could you'],
  ['Hey guys, the meeting starts at noon.', 'Hey guys', 'Hi everyone'],
];

describe('catches common errors', () => {
  for (const [text, original, expected] of CASES) {
    test(`${text} → ${expected}`, async () => {
      const out = await check(text);
      const hit = out.find((s) => s.original === original && s.replacements.includes(expected));
      expect(
        hit,
        JSON.stringify(out.map((s) => [s.original, s.replacements, s.rule])),
      ).toBeTruthy();
    });
  }
});

test('does not turn a question into nonsense', async () => {
  const out = await check('I was wondering if the report is finished.');
  expect(out.filter((s) => s.original.toLowerCase().startsWith('i was wondering'))).toEqual([]);
});

describe('no false alarms on correct writing', () => {
  test('clean corpus has no correctness issues (British spellings excepted in American mode)', async () => {
    const problems: string[] = [];
    for (const text of CLEAN_TEXTS) {
      const out = await check(text);
      for (const s of out) {
        if (s.category !== 'correctness') continue;
        if (s.rule === 'grammar.SpellCheck' && /our|ys|is/.test(s.original)) continue;
        problems.push(`${s.original} → ${s.replacements[0]} [${s.rule}] in: ${text.slice(0, 60)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('British spelling is accepted in British mode', async () => {
    const out = await check(
      'Mathematics is my favourite subject, and the data were analysed carefully.',
      { dialect: 'british', oxfordComma: false },
    );
    expect(out.filter((s) => s.rule === 'grammar.SpellCheck')).toEqual([]);
  });

  test('personal dictionary words are not flagged', async () => {
    const out = await check('Please ask Shivashis about the Oppenly roadmap.', {
      dictionary: ['Oppenly'],
    });
    expect(out.filter((s) => s.category === 'correctness')).toEqual([]);
  });

  test('urls, emails and code are ignored', async () => {
    const out = await check(
      'Email me at jane.doe@examplz.com or visit https://examplz.com/pagez and run `npm instal`.',
    );
    expect(out.filter((s) => s.category === 'correctness')).toEqual([]);
  });
});

describe('goals change delivery suggestions', () => {
  test('formal goal expands contractions', async () => {
    const out = await check("We can't attend the meeting.", {
      goals: { audience: 'general', formality: 'formal', domain: 'business', intent: 'inform' },
    });
    expect(out.some((s) => s.original === "can't" && s.replacements[0] === 'cannot')).toBe(true);
  });

  test('informal goal leaves slang alone', async () => {
    const out = await check("Yeah, I'm gonna be there at eight.", {
      goals: { audience: 'general', formality: 'informal', domain: 'casual', intent: 'inform' },
    });
    expect(out.some((s) => s.rule === 'style.informal')).toBe(false);
  });
});

describe('settings', () => {
  test('disabled categories are hidden', async () => {
    const out = await check('The service was very bad.', { disabledCategories: ['engagement'] });
    expect(out.some((s) => s.category === 'engagement')).toBe(false);
  });

  test('disabled rules are hidden', async () => {
    const out = await check('We should utilize the new tool.', {
      disabledRules: ['style.complex-words'],
    });
    expect(out.some((s) => s.rule === 'style.complex-words')).toBe(false);
  });
});
