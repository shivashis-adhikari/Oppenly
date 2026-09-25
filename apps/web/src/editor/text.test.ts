import { describe, expect, test } from 'vitest';
import { buildDoc, markdownToBlocks } from '../io/testing';
import { TextMap } from './text';

describe('TextMap', () => {
  const doc = buildDoc(
    markdownToBlocks('# Title\n\nHello **bold** world.\n\n- item one\n- item two'),
  );
  const map = new TextMap(doc);

  test('joins text blocks with newlines', () => {
    expect(map.text).toBe('Title\nHello bold world.\nitem one\nitem two');
  });

  test('maps text offsets to the same characters in the document', () => {
    for (const word of ['Title', 'Hello', 'bold', 'world', 'item two']) {
      const start = map.text.indexOf(word);
      const range = map.toRange(start, start + word.length)!;
      expect(doc.textBetween(range.from, range.to)).toBe(word);
      expect(map.toOffset(range.from)).toBe(start);
    }
  });
});
