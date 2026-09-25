// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { schema } from '../editor/schema';
import { buildDoc, textToBlocks } from './blocks';
import { docToDocx, docxToBlocks } from './docx';
import { docToMarkdown, markdownToBlocks } from './markdown';
import { rtfToBlocks } from './rtf';

const md = `# Launch plan

We ship on **Friday**, with *careful* testing and a [checklist](https://example.com).

- Write the notes
- Review them
  - Twice

1. First
2. Second

> A quote worth keeping.
`;

describe('markdown', () => {
  test('round-trips headings, lists, quotes and inline formatting', () => {
    const doc = buildDoc(markdownToBlocks(md));
    const names: string[] = [];
    doc.forEach((n) => {
      names.push(n.type.name);
    });
    expect(names).toEqual(['heading', 'paragraph', 'bullet_list', 'ordered_list', 'blockquote']);
    const out = docToMarkdown(doc);
    expect(out).toContain('# Launch plan');
    expect(out).toContain('**Friday**');
    expect(out).toContain('*careful*');
    expect(out).toContain('[checklist](https://example.com)');
    expect(out).toContain('  - Twice');
    expect(out).toContain('2. Second');
    expect(out).toContain('> A quote worth keeping.');
  });

  test('keeps parentheses inside link addresses', () => {
    const doc = buildDoc(markdownToBlocks('[Ada](https://en.wikipedia.org/wiki/Ada_(language))'));
    expect(doc.textContent).toBe('Ada');
    expect(JSON.stringify(doc.toJSON())).toContain('Ada_(language)');
  });

  test('drops unsafe links', () => {
    const doc = buildDoc(markdownToBlocks('[click](javascript:alert(1))'));
    expect(JSON.stringify(doc.toJSON())).not.toContain('javascript');
    expect(doc.textContent).toBe('click');
  });
});

describe('docx', () => {
  test('round-trips text, formatting, headings, lists and links', () => {
    const source = buildDoc(markdownToBlocks(md));
    const bytes = docToDocx(source, 'Launch plan');
    const { blocks, title } = docxToBlocks(bytes);
    expect(title).toBe('Launch plan');
    const doc = buildDoc(blocks);
    expect(doc.textContent).toBe(source.textContent);
    const names: string[] = [];
    doc.forEach((n) => {
      names.push(n.type.name);
    });
    expect(names).toEqual(['heading', 'paragraph', 'bullet_list', 'ordered_list', 'blockquote']);
    const para = doc.child(1);
    const bold = para.content.content.find((n) => n.text === 'Friday');
    expect(bold?.marks.map((m) => m.type.name)).toContain('strong');
    const link = para.content.content.find((n) => n.text === 'checklist');
    expect(link?.marks.find((m) => m.type.name === 'link')?.attrs.href).toBe('https://example.com');
  });

  test('escapes XML special characters', () => {
    const doc = buildDoc(textToBlocks('Fish & chips <3 "quotes"'));
    const { blocks } = docxToBlocks(docToDocx(doc, 'A & B'));
    expect(buildDoc(blocks).textContent).toBe('Fish & chips <3 "quotes"');
  });
});

describe('rtf', () => {
  test('reads paragraphs, formatting, escapes and unicode', () => {
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Hello \\b bold\\b0  and \\i italic\\i0 .\\par Caf\\'e9 \\u8212? done\\par}";
    const doc = buildDoc(rtfToBlocks(rtf));
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).textContent).toBe('Hello bold and italic.');
    expect(doc.child(1).textContent).toBe('Café — done');
    const bold = doc.child(0).content.content.find((n) => n.text === 'bold');
    expect(bold?.marks[0]?.type).toBe(schema.marks.strong);
  });
});

describe('plain text', () => {
  test('blank lines separate paragraphs; single newlines are line breaks', () => {
    const doc = buildDoc(textToBlocks('One\nstill one\n\nTwo'));
    expect(doc.childCount).toBe(2);
    expect(doc.child(0).childCount).toBe(3);
  });

  test('text without blank lines gets a paragraph per line', () => {
    expect(buildDoc(textToBlocks('a\nb\nc')).childCount).toBe(3);
  });
});
