import type { Mark, Node as PMNode } from 'prosemirror-model';
import { safeHref, schema } from '../editor/schema';

/** A run of text with the same formatting. */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  href?: string;
  /** A line break instead of text. */
  br?: boolean;
}

/** A paragraph-level piece of an imported document. */
export interface Block {
  kind: 'paragraph' | 'heading' | 'quote' | 'hr' | 'item';
  /** Heading level 1-3. */
  level?: number;
  /** For list items. */
  list?: 'bullet' | 'ordered';
  /** List nesting, 0 = top level. */
  depth?: number;
  /** First number of an ordered list. */
  start?: number;
  runs: Run[];
}

function marksFor(run: Run): Mark[] {
  const m: Mark[] = [];
  if (run.href && safeHref(run.href)) m.push(schema.marks.link.create({ href: run.href }));
  if (run.bold) m.push(schema.marks.strong.create());
  if (run.italic) m.push(schema.marks.em.create());
  if (run.underline) m.push(schema.marks.underline.create());
  if (run.strike) m.push(schema.marks.strike.create());
  return m;
}

function inline(runs: Run[]): PMNode[] {
  const out: PMNode[] = [];
  for (const run of runs) {
    if (run.br) out.push(schema.nodes.hard_break.create());
    else if (run.text) out.push(schema.text(run.text, marksFor(run)));
  }
  // Trim a trailing line break, which Word and others often leave at the end of a paragraph.
  while (out.length && out[out.length - 1]!.type === schema.nodes.hard_break) out.pop();
  return out;
}

function listNode(items: Block[], index: number, depth: number): [PMNode, number] {
  const kind = items[index]!.list ?? 'bullet';
  const children: PMNode[] = [];
  let i = index;
  while (i < items.length) {
    const item = items[i]!;
    const d = item.depth ?? 0;
    if (d < depth) break;
    if (d === depth && (item.list ?? 'bullet') !== kind && children.length) break;
    if (d > depth) {
      // A deeper item with no parent at this level: attach to the previous item.
      const [nested, next] = listNode(items, i, d);
      const last = children.pop();
      if (last)
        children.push(last.type.create(last.attrs, last.content.append(schemaFragment(nested))));
      else
        children.push(
          schema.nodes.list_item.create(null, [schema.nodes.paragraph.create(), nested]),
        );
      i = next;
      continue;
    }
    const para = schema.nodes.paragraph.create(null, inline(item.runs));
    children.push(schema.nodes.list_item.create(null, [para]));
    i++;
  }
  const type = kind === 'ordered' ? schema.nodes.ordered_list : schema.nodes.bullet_list;
  const attrs = kind === 'ordered' ? { order: items[index]!.start ?? 1 } : null;
  return [type.create(attrs, children), i];
}

function schemaFragment(node: PMNode) {
  return schema.nodes.doc.create(null, [node]).content;
}

/** Builds an editor document from blocks. Always returns a valid document. */
export function buildDoc(blocks: Block[]): PMNode {
  const out: PMNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i]!;
    if (b.kind === 'item') {
      const [list, next] = listNode(blocks, i, b.depth ?? 0);
      out.push(list);
      i = next;
      continue;
    }
    if (b.kind === 'hr') out.push(schema.nodes.horizontal_rule.create());
    else if (b.kind === 'heading')
      out.push(
        schema.nodes.heading.create(
          { level: Math.min(3, Math.max(1, b.level ?? 1)) },
          inline(b.runs),
        ),
      );
    else if (b.kind === 'quote') {
      const para = schema.nodes.paragraph.create(null, inline(b.runs));
      const prev = out[out.length - 1];
      // Merge consecutive quote paragraphs into one quote.
      if (prev?.type === schema.nodes.blockquote && blocks[i - 1]?.kind === 'quote')
        out[out.length - 1] = prev.type.create(null, prev.content.addToEnd(para));
      else out.push(schema.nodes.blockquote.create(null, [para]));
    } else out.push(schema.nodes.paragraph.create(null, inline(b.runs)));
    i++;
  }
  if (!out.length) out.push(schema.nodes.paragraph.create());
  return schema.nodes.doc.create(null, out);
}

/**
 * Plain text to blocks. Blank lines separate paragraphs and single newlines become line breaks;
 * text without blank lines gets one paragraph per line.
 */
export function textToBlocks(text: string): Block[] {
  const clean = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!/\n[ \t]*\n/.test(clean))
    return clean.split('\n').map((line) => ({ kind: 'paragraph', runs: [{ text: line }] }));
  return clean.split(/\n[ \t]*\n+/).map((para) => ({
    kind: 'paragraph',
    runs: para
      .split('\n')
      .flatMap((line, i) => (i ? [{ text: '', br: true }, { text: line }] : [{ text: line }])),
  }));
}
