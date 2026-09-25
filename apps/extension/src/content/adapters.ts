import type { FieldKind } from './fields';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A uniform view of any editable field. Offsets are UTF-16 indexes into `getText()`. */
export interface FieldAdapter {
  readonly el: HTMLElement;
  readonly kind: FieldKind;
  getText(): string;
  /** Viewport rectangles covering [start, end), one per line fragment. */
  rects(start: number, end: number): Rect[];
  /** Replace [start, end) with `text` the way a user would type it. Resolves false if it failed. */
  replace(start: number, end: number, text: string): Promise<boolean>;
  /** Current selection inside the field, or null. */
  selection(): { start: number; end: number } | null;
  /** Select [start, end) so the user can see it. */
  select(start: number, end: number): void;
  destroy(): void;
}

const MIRROR_PROPS = [
  'direction',
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'fontFeatureSettings',
  'fontKerning',
  'fontVariantLigatures',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'wordBreak',
  'overflowWrap',
  'hyphens',
] as const;

function toRect(r: DOMRect): Rect {
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

/** Wait one frame so framework editors can process a selection change. */
function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

/** `<textarea>` and `<input>`: measured through an invisible mirror with identical layout. */
export class TextFieldAdapter implements FieldAdapter {
  readonly kind: FieldKind;
  private mirror: HTMLDivElement;
  private textNode: Text;
  private mirroredText = '';

  constructor(
    readonly el: HTMLTextAreaElement | HTMLInputElement,
    mirrorParent: Node,
  ) {
    this.kind = el instanceof HTMLTextAreaElement ? 'textarea' : 'input';
    this.mirror = document.createElement('div');
    this.mirror.setAttribute('aria-hidden', 'true');
    this.textNode = document.createTextNode('');
    this.mirror.append(this.textNode);
    mirrorParent.appendChild(this.mirror);
  }

  getText(): string {
    return this.el.value;
  }

  private sync(): DOMRect {
    const cs = getComputedStyle(this.el);
    const st = this.mirror.style;
    for (const p of MIRROR_PROPS) (st as unknown as Record<string, string>)[p] = cs[p];
    const fieldRect = this.el.getBoundingClientRect();
    st.position = 'fixed';
    st.visibility = 'hidden';
    st.pointerEvents = 'none';
    st.top = `${fieldRect.top}px`;
    st.left = `${fieldRect.left}px`;
    st.height = `${fieldRect.height}px`;
    st.margin = '0';
    st.overflow = 'hidden';
    if (this.kind === 'textarea') {
      st.whiteSpace = 'pre-wrap';
      // Match the wrap width when the textarea shows a vertical scrollbar.
      st.overflowY = this.el.scrollHeight > this.el.clientHeight ? 'scroll' : 'hidden';
    } else {
      st.whiteSpace = 'pre';
      const inner =
        this.el.clientHeight -
        Number.parseFloat(cs.paddingTop) -
        Number.parseFloat(cs.paddingBottom);
      st.lineHeight = `${Math.max(inner, 0)}px`;
    }
    const value =
      this.el.value + (this.kind === 'textarea' && this.el.value.endsWith('\n') ? ' ' : '');
    if (value !== this.mirroredText) {
      this.textNode.data = value;
      this.mirroredText = value;
    }
    return fieldRect;
  }

  rects(start: number, end: number): Rect[] {
    const fieldRect = this.sync();
    const len = this.textNode.data.length;
    const range = document.createRange();
    range.setStart(this.textNode, Math.min(start, len));
    range.setEnd(this.textNode, Math.min(end, len));
    const mirrorRect = this.mirror.getBoundingClientRect();
    const dx = fieldRect.left - mirrorRect.left - this.el.scrollLeft;
    const dy = fieldRect.top - mirrorRect.top - this.el.scrollTop;
    return Array.from(range.getClientRects())
      .filter((r) => r.width > 0.5)
      .map((r) => ({ x: r.x + dx, y: r.y + dy, width: r.width, height: r.height }));
  }

  async replace(start: number, end: number, text: string): Promise<boolean> {
    const before = this.el.value;
    const expected = before.slice(0, start) + text + before.slice(end);
    this.el.focus();
    this.el.setSelectionRange(start, end);
    // execCommand creates a trusted input event, keeps undo history and works with React.
    const ok = text
      ? document.execCommand('insertText', false, text)
      : document.execCommand('delete');
    if (!ok || this.el.value !== expected) {
      if (this.el.value === before) {
        this.el.setRangeText(text, start, end, 'end');
        this.el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertReplacementText',
            data: text,
          }),
        );
      }
    }
    return this.el.value === expected;
  }

  selection() {
    const { selectionStart: s, selectionEnd: e } = this.el;
    if (s === null || e === null || s === e) return null;
    return { start: s, end: e };
  }

  select(start: number, end: number): void {
    this.el.focus();
    this.el.setSelectionRange(start, end);
  }

  destroy(): void {
    this.mirror.remove();
  }
}

interface Segment {
  node: Text;
  start: number;
  end: number;
}

const BLOCK = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
  'UL',
]);

/** Parts of a document we never check: code, quoted email replies, signatures. */
const SKIP =
  'script, style, noscript, template, pre, code, .gmail_quote, .gmail_signature, .gmail_extra, [data-oppenly="false"]';

/** `contenteditable` editors (Gmail, LinkedIn, Notion, ProseMirror, Lexical, Slate, Quill, …). */
export class ContentEditableAdapter implements FieldAdapter {
  readonly kind: FieldKind = 'contenteditable';
  private text = '';
  private segments: Segment[] = [];

  constructor(readonly el: HTMLElement) {}

  getText(): string {
    const parts: string[] = [];
    const segments: Segment[] = [];
    let length = 0;
    const push = (s: string) => {
      parts.push(s);
      length += s.length;
    };
    const newline = () => {
      if (length > 0 && parts[parts.length - 1] !== '\n') push('\n');
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const data = (node as Text).data;
        if (!data) return;
        segments.push({ node: node as Text, start: length, end: length + data.length });
        push(data);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        push('\n');
        return;
      }
      if (el.matches(SKIP)) {
        newline();
        return;
      }
      if (el !== this.el && el.getAttribute('contenteditable') === 'false') {
        // Mentions, chips and embeds: keep word boundaries without checking their text.
        push(' ');
        return;
      }
      const block = BLOCK.has(el.tagName);
      if (block) newline();
      for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
      if (block) newline();
    };
    walk(this.el);
    // Non-breaking spaces behave like spaces for checking.
    this.text = parts.join('').replace(/ /g, ' ');
    this.segments = segments;
    return this.text;
  }

  /**
   * Map a text offset to a DOM position. At a boundary between two text nodes, `preferEnd`
   * picks the end of the earlier node (for range ends) instead of the start of the next.
   */
  private position(offset: number, preferEnd: boolean): { node: Text; offset: number } | null {
    const segs = this.segments;
    const n = segs.length;
    if (n === 0) return null;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (segs[mid]!.end < offset) lo = mid + 1;
      else hi = mid;
    }
    let idx = Math.min(lo, n - 1);
    let seg = segs[idx]!;
    if (offset < seg.start) {
      // The offset sits in a line break between blocks.
      if (preferEnd && idx > 0) {
        seg = segs[idx - 1]!;
        return { node: seg.node, offset: seg.node.data.length };
      }
      return { node: seg.node, offset: 0 };
    }
    if (!preferEnd && offset === seg.end && idx + 1 < n && segs[idx + 1]!.start === offset) {
      idx += 1;
      seg = segs[idx]!;
    }
    return {
      node: seg.node,
      offset: Math.max(0, Math.min(offset - seg.start, seg.node.data.length)),
    };
  }

  private range(start: number, end: number): Range | null {
    const a = this.position(start, false);
    const b = this.position(end, true);
    if (!a || !b || !a.node.isConnected || !b.node.isConnected) return null;
    const range = document.createRange();
    try {
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
    } catch {
      return null;
    }
    return range;
  }

  rects(start: number, end: number): Rect[] {
    const range = this.range(start, end);
    if (!range) return [];
    return Array.from(range.getClientRects())
      .filter((r) => r.width > 0.5 && r.height > 0)
      .map(toRect);
  }

  async replace(start: number, end: number, text: string): Promise<boolean> {
    const before = this.getText();
    const expected = before.slice(0, start) + text + before.slice(end);
    const range = this.range(start, end);
    if (!range) return false;
    this.el.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return false;
    selection.removeAllRanges();
    selection.addRange(range);
    // Let framework editors (Draft.js, Slate, Lexical) observe the new selection first.
    await nextFrame();
    const ok = text
      ? document.execCommand('insertText', false, text)
      : document.execCommand('delete');
    await nextFrame();
    const after = this.getText();
    if (ok && after === expected) return true;
    // Some editors normalise whitespace; accept when only whitespace differs.
    if (after.replace(/\s+/g, ' ') === expected.replace(/\s+/g, ' ')) return true;
    if (after !== before) document.execCommand('undo');
    return false;
  }

  selection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    if (!this.el.contains(r.startContainer) || !this.el.contains(r.endContainer)) return null;
    this.getText();
    const offsetOf = (node: Node, offset: number): number | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const seg = this.segments.find((s) => s.node === node);
        return seg ? seg.start + offset : null;
      }
      // Element container: use the first text segment inside the child at `offset`.
      const child = node.childNodes[offset];
      const seg = child
        ? this.segments.find((s) => child === s.node || child.contains(s.node))
        : undefined;
      return seg ? seg.start : null;
    };
    const start = offsetOf(r.startContainer, r.startOffset);
    const end = offsetOf(r.endContainer, r.endOffset);
    if (start === null || end === null || end <= start) return null;
    return { start, end };
  }

  select(start: number, end: number): void {
    const range = this.range(start, end);
    const sel = window.getSelection();
    if (!range || !sel) return;
    this.el.focus({ preventScroll: true });
    sel.removeAllRanges();
    sel.addRange(range);
  }

  destroy(): void {
    this.segments = [];
  }
}

export function createAdapter(el: HTMLElement, kind: FieldKind, mirrorParent: Node): FieldAdapter {
  if (kind === 'contenteditable') return new ContentEditableAdapter(el);
  return new TextFieldAdapter(el as HTMLTextAreaElement | HTMLInputElement, mirrorParent);
}
