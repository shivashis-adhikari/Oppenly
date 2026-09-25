import { type DOMOutputSpec, type MarkSpec, type NodeSpec, Schema } from 'prosemirror-model';

type NodeName =
  | 'doc'
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'horizontal_rule'
  | 'bullet_list'
  | 'ordered_list'
  | 'list_item'
  | 'text'
  | 'hard_break';
type MarkName = 'link' | 'strong' | 'em' | 'underline' | 'strike';

const nodes: Record<NodeName, NodeSpec> = {
  doc: { content: 'block+' },
  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM: (): DOMOutputSpec => ['p', 0],
  },
  heading: {
    attrs: { level: { default: 1 } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((n) => ({ tag: `h${n}`, attrs: { level: Math.min(n, 3) } })),
    toDOM: (node): DOMOutputSpec => [`h${node.attrs.level}`, 0],
  },
  blockquote: {
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: (): DOMOutputSpec => ['blockquote', 0],
  },
  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM: (): DOMOutputSpec => ['hr'],
  },
  bullet_list: {
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM: (): DOMOutputSpec => ['ul', 0],
  },
  ordered_list: {
    attrs: { order: { default: 1 } },
    content: 'list_item+',
    group: 'block',
    parseDOM: [
      {
        tag: 'ol',
        getAttrs: (dom) => ({ order: Number((dom as HTMLElement).getAttribute('start') ?? 1) }),
      },
    ],
    toDOM: (node): DOMOutputSpec =>
      node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0],
  },
  list_item: {
    content: 'paragraph block*',
    defining: true,
    parseDOM: [{ tag: 'li' }],
    toDOM: (): DOMOutputSpec => ['li', 0],
  },
  text: { group: 'inline' },
  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: (): DOMOutputSpec => ['br'],
  },
};

const marks: Record<MarkName, MarkSpec> = {
  link: {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => {
          const href = (dom as HTMLElement).getAttribute('href') ?? '';
          return safeHref(href) ? { href } : false;
        },
      },
    ],
    toDOM: (mark): DOMOutputSpec => [
      'a',
      { href: mark.attrs.href, rel: 'noopener noreferrer nofollow', target: '_blank' },
      0,
    ],
  },
  strong: {
    parseDOM: [
      { tag: 'strong' },
      // Google Docs wraps pasted text in <b style="font-weight:normal">.
      {
        tag: 'b',
        getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== 'normal' && null,
      },
      {
        style: 'font-weight',
        getAttrs: (value) => /^(bold(er)?|[6-9]\d{2})$/.test(value as string) && null,
      },
    ],
    toDOM: (): DOMOutputSpec => ['strong', 0],
  },
  em: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: (): DOMOutputSpec => ['em', 0],
  },
  underline: {
    parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
    toDOM: (): DOMOutputSpec => ['u', 0],
  },
  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { style: 'text-decoration=line-through' }],
    toDOM: (): DOMOutputSpec => ['s', 0],
  },
};

/** Only web and mail links. Blocks `javascript:` and other schemes in pasted or imported text. */
export function safeHref(href: string): boolean {
  try {
    const url = new URL(href, 'https://example.invalid');
    return ['http:', 'https:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export const schema = new Schema<NodeName, MarkName>({ nodes, marks });
