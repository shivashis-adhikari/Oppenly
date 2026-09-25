import type { Node as PMNode } from 'prosemirror-model';

interface Segment {
  /** Offset of this run in the plain text. */
  text: number;
  /** Document position of the same character. */
  pos: number;
  length: number;
}

/**
 * The plain text the engine checks, plus a map between text offsets and editor positions.
 * Each text block (paragraph, heading, list item) becomes one line; line breaks inside a block
 * also become newlines.
 */
export class TextMap {
  readonly text: string;
  private readonly segments: Segment[];

  constructor(doc: PMNode) {
    const parts: string[] = [];
    const segments: Segment[] = [];
    let offset = 0;
    let first = true;
    doc.descendants((node, pos) => {
      if (!node.isTextblock) return true;
      if (!first) {
        parts.push('\n');
        offset += 1;
      }
      first = false;
      node.forEach((child, childOffset) => {
        const at = pos + 1 + childOffset;
        if (child.isText) {
          const value = child.text ?? '';
          segments.push({ text: offset, pos: at, length: value.length });
          parts.push(value);
          offset += value.length;
        } else if (child.type.name === 'hard_break') {
          parts.push('\n');
          offset += 1;
        }
      });
      return false;
    });
    this.text = parts.join('');
    this.segments = segments;
  }

  /** Editor position for a text offset. Offsets on a boundary resolve to the earlier run. */
  toPos(offset: number): number | null {
    const segs = this.segments;
    let lo = 0;
    let hi = segs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = segs[mid]!;
      if (offset < s.text) hi = mid - 1;
      else if (offset > s.text + s.length) lo = mid + 1;
      else return s.pos + (offset - s.text);
    }
    return null;
  }

  /** Editor range for a text range, or null if it does not map cleanly. */
  toRange(start: number, end: number): { from: number; to: number } | null {
    const from = this.toPos(start);
    const to = this.toPos(end);
    if (from === null || to === null || to < from) return null;
    return { from, to };
  }

  /** Text offset for an editor position, or null outside text. */
  toOffset(pos: number): number | null {
    for (const s of this.segments) {
      if (pos >= s.pos && pos <= s.pos + s.length) return s.text + (pos - s.pos);
    }
    return null;
  }
}
