import type { Suggestion } from '@oppenly/engine';
import { describe, expect, test } from 'vitest';
import { remap } from './remap';

const text = 'I seen the report and it was good.';

function at(word: string, source = text): Suggestion {
  const start = source.indexOf(word);
  return { id: word, start, end: start + word.length, original: word } as Suggestion;
}

function spans(list: Suggestion[], source: string): string[] {
  return list.map((s) => source.slice(s.start, s.end));
}

describe('remap', () => {
  test('shifts suggestions after an edit', () => {
    const after = `Hello. ${text}`;
    expect(spans(remap([at('seen'), at('good')], text, after), after)).toEqual(['seen', 'good']);
  });

  test('keeps suggestions before an edit in place', () => {
    const after = text.replace('good', 'great');
    expect(remap([at('seen')], text, after)).toEqual([at('seen')]);
  });

  test('drops a suggestion whose text was edited', () => {
    const after = text.replace('seen', 'sen');
    expect(remap([at('seen'), at('good')], text, after).map((s) => s.id)).toEqual(['good']);
  });

  test('drops a suggestion when typing joins onto its word', () => {
    const after = text.replace('seen', 'seenx');
    expect(remap([at('seen')], text, after)).toEqual([]);
    const before = text.replace('seen', 'xseen');
    expect(remap([at('seen')], text, before)).toEqual([]);
  });

  test('keeps a suggestion when typing a space or punctuation next to it', () => {
    const after = text.replace('seen', 'seen,');
    expect(spans(remap([at('seen'), at('good')], text, after), after)).toEqual(['seen', 'good']);
    const before = text.replace(' seen', '  seen');
    expect(spans(remap([at('seen')], text, before), before)).toEqual(['seen']);
  });

  test('returns the same list when nothing changed', () => {
    const list = [at('seen')];
    expect(remap(list, text, text)).toBe(list);
  });
});
