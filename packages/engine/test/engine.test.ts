import { applySuggestions, localRewrite } from '../src';
import { engine } from './helpers';

describe('analysis', () => {
  test('counts, stats, tone and score', async () => {
    const e = await engine();
    const text =
      'Hi Sam,\n\nThank you so much for your help yesterday! I really appreciate it, and I am excited to see the results next week.\n\nBest,\nAva';
    const a = await e.analyze(text);
    expect(a.stats.words).toBeGreaterThan(20);
    expect(a.stats.sentences).toBeGreaterThanOrEqual(3);
    expect(a.stats.readingTime).toBeGreaterThan(0);
    expect(a.tones.map((t) => t.id)).toContain('appreciative');
    expect(a.score).not.toBeNull();
  });

  test('suggestion ids stay stable when unrelated text changes', async () => {
    const e = await engine();
    const a = await e.analyze('I seen it.');
    const b = await e.analyze('Hello there. I seen it.');
    expect(a.suggestions[0]?.id).toBe(b.suggestions.find((s) => s.original === 'seen')?.id);
  });

  test('offsets point at the original text', async () => {
    const e = await engine();
    const text = 'First paragraph is fine.\n\nSecond one has alot of errors and I seen them.';
    const a = await e.analyze(text);
    for (const s of a.suggestions) expect(text.slice(s.start, s.end)).toBe(s.original);
  });

  test('handles emoji before errors (UTF-16 offsets)', async () => {
    const e = await engine();
    const text = 'Great news 🎉 we recieved the package.';
    const a = await e.analyze(text);
    const s = a.suggestions.find((x) => x.original === 'recieved');
    expect(s).toBeTruthy();
    expect(text.slice(s!.start, s!.end)).toBe('recieved');
  });

  test('accept all correctness fixes', async () => {
    const e = await engine();
    const text = 'Their going to buy alot of apples tomorow.';
    const a = await e.analyze(text);
    const fixed = applySuggestions(
      text,
      a.suggestions.filter((s) => s.category === 'correctness'),
    );
    expect(fixed).toBe("They're going to buy a lot of apples tomorrow.");
  });

  test('removal suggestions leave clean spacing', async () => {
    const e = await engine();
    const text = 'I think that we should launch on Monday.';
    const a = await e.analyze(text);
    const s = a.suggestions.find((x) => x.rule === 'style.hedging');
    expect(s).toBeTruthy();
    const out = text.slice(0, s!.start) + s!.replacements[0] + text.slice(s!.end);
    expect(out).toBe('We should launch on Monday.');
  });
});

describe('local rewrites', () => {
  test('shorten', () => {
    expect(
      localRewrite(
        'Due to the fact that we are in the process of moving, I think that we should basically wait.',
        'shorten',
      ),
    ).toBe('Because we are moving, we should wait.');
  });
  test('formal', () => {
    expect(localRewrite("Hey, we're gonna need a lot of help with this stuff!", 'formal')).toBe(
      'Hello, we are going to need much help with this material.',
    );
  });
  test('friendly', () => {
    expect(
      localRewrite('I am writing to inform you that we do not have the file.', 'friendly'),
    ).toBe("I wanted to let you know that we don't have the file.");
  });
  test('confident', () => {
    expect(localRewrite('I think we should maybe try the second option.', 'confident')).toBe(
      'We should try the second option.',
    );
  });
  test('simplify', () => {
    expect(
      localRewrite('We will utilize additional resources to facilitate the process.', 'simplify'),
    ).toBe('We will use more resources to help the process.');
  });
});
