import type { Suggestion } from '@oppenly/engine';
import type { Node as PMNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import type { Mapping } from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';

/** An engine suggestion placed in the editor document. */
export interface Placed extends Suggestion {
  from: number;
  to: number;
  /** The characters just before and after the span when it was placed. */
  contextBefore: string;
  contextAfter: string;
}

interface State {
  items: Placed[];
  active: string | null;
  decorations: DecorationSet;
}

type Meta = { items: Placed[] } | { active: string | null };

export const suggestionsKey = new PluginKey<State>('oppenly-suggestions');

const WORD = /[\p{L}\p{N}'’]/u;

/**
 * Moves suggestions through edits. A suggestion survives only if its text is unchanged and no
 * letters were typed directly against it ("seen" -> "seenx" drops it; "seen," keeps it).
 */
export function mapPlaced(items: Placed[], mapping: Mapping, doc: PMNode): Placed[] {
  const out: Placed[] = [];
  for (const s of items) {
    const from = mapping.map(s.from, 1);
    const to = mapping.map(s.to, -1);
    if (to < from || to > doc.content.size) continue;
    if (doc.textBetween(from, to, '\n') !== s.original) continue;
    const before = from > 0 ? doc.textBetween(Math.max(0, from - 1), from, '\n') : '';
    const after = to < doc.content.size ? doc.textBetween(to, to + 1, '\n') : '';
    const startsWord = WORD.test(s.original[0] ?? '');
    const endsWord = WORD.test(s.original[s.original.length - 1] ?? '');
    if (startsWord && WORD.test(before) && before !== s.contextBefore) continue;
    if (endsWord && WORD.test(after) && after !== s.contextAfter) continue;
    out.push({ ...s, from, to, contextBefore: before, contextAfter: after });
  }
  return out;
}

function decorate(doc: PMNode, items: Placed[], active: string | null): DecorationSet {
  const decos: Decoration[] = [];
  for (const s of items) {
    if (s.to <= s.from) continue;
    decos.push(
      Decoration.inline(
        s.from,
        s.to,
        {
          class: `ox-ul${s.id === active ? ' is-active' : ''}${s.kind === 'info' ? ' is-info' : ''}`,
          'data-cat': s.category,
          'data-sid': s.id,
        },
        { id: s.id },
      ),
    );
  }
  return DecorationSet.create(doc, decos);
}

export function suggestionsPlugin(): Plugin<State> {
  return new Plugin<State>({
    key: suggestionsKey,
    state: {
      init: (_, state) => ({
        items: [],
        active: null,
        decorations: DecorationSet.create(state.doc, []),
      }),
      apply(tr: Transaction, value: State, _old, next): State {
        const meta = tr.getMeta(suggestionsKey) as Meta | undefined;
        let { items, active } = value;
        let changed = false;
        if (tr.docChanged) {
          items = mapPlaced(items, tr.mapping, next.doc);
          changed = true;
        }
        if (meta && 'items' in meta) {
          items = meta.items;
          changed = true;
        }
        if (meta && 'active' in meta) {
          active = meta.active;
          changed = true;
        }
        if (active && !items.some((s) => s.id === active)) active = null;
        if (!changed) return value;
        return { items, active, decorations: decorate(next.doc, items, active) };
      },
    },
    props: {
      decorations: (state) => suggestionsKey.getState(state)?.decorations,
    },
  });
}

/** Places engine suggestions (text offsets) into the document with the given offset mapper. */
export function place(
  doc: PMNode,
  suggestions: Suggestion[],
  toRange: (start: number, end: number) => { from: number; to: number } | null,
): Placed[] {
  const out: Placed[] = [];
  for (const s of suggestions) {
    const range = toRange(s.start, s.end);
    if (!range) continue;
    if (doc.textBetween(range.from, range.to, '\n') !== s.original) continue;
    const before =
      range.from > 0 ? doc.textBetween(Math.max(0, range.from - 1), range.from, '\n') : '';
    const after = range.to < doc.content.size ? doc.textBetween(range.to, range.to + 1, '\n') : '';
    out.push({ ...s, ...range, contextBefore: before, contextAfter: after });
  }
  return out;
}
