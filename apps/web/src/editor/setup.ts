import {
  baseKeymap,
  chainCommands,
  exitCode,
  setBlockType,
  toggleMark,
  wrapIn,
} from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import type { MarkType, NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { type Command, type EditorState, Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { schema } from './schema';
import { suggestionsPlugin } from './suggestions';

const { nodes, marks } = schema;

/** Is `type` applied across the current selection (or stored for the next typed text)? */
export function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return Boolean(type.isInSet(state.storedMarks ?? $from.marks()));
  return state.doc.rangeHasMark(from, to, type);
}

/** The block type at the cursor, e.g. "paragraph", "heading1", "bullet_list". */
export function blockAt(state: EditorState): string {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type === nodes.bullet_list || node.type === nodes.ordered_list) return node.type.name;
  }
  const parent = $from.parent;
  return parent.type === nodes.heading ? `heading${parent.attrs.level}` : parent.type.name;
}

export const toggleHeading =
  (level: number): Command =>
  (state, dispatch) => {
    const isOn = blockAt(state) === `heading${level}`;
    return setBlockType(isOn ? nodes.paragraph : nodes.heading, isOn ? {} : { level })(
      state,
      dispatch,
    );
  };

export const toggleList =
  (type: NodeType): Command =>
  (state, dispatch) => {
    const current = blockAt(state);
    if (current === type.name) return liftListItem(nodes.list_item)(state, dispatch);
    if (current === 'bullet_list' || current === 'ordered_list') {
      // Switch list kind in place.
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d);
        if (node.type === nodes.bullet_list || node.type === nodes.ordered_list) {
          if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(d), type));
          return true;
        }
      }
    }
    return wrapInList(type)(state, dispatch);
  };

/** Removes character formatting and turns headings back into paragraphs. */
export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) {
    if (dispatch) dispatch(state.tr.setStoredMarks([]));
    return true;
  }
  if (dispatch) {
    const tr = state.tr;
    for (const mark of Object.values(marks)) tr.removeMark(from, to, mark);
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type === nodes.heading) tr.setNodeMarkup(pos, nodes.paragraph);
    });
    dispatch(tr);
  }
  return true;
};

export const toggleBold = toggleMark(marks.strong);
export const toggleItalic = toggleMark(marks.em);
export const toggleUnderline = toggleMark(marks.underline);
export const toggleStrike = toggleMark(marks.strike);

const insertBreak: Command = chainCommands(exitCode, (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(nodes.hard_break.create()).scrollIntoView());
  return true;
});

function rules() {
  return inputRules({
    rules: [
      wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
      wrappingInputRule(/^\s*([-+*])\s$/, nodes.bullet_list),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        nodes.ordered_list,
        (m) => ({ order: Number(m[1]) }),
        (m, node) => node.childCount + node.attrs.order === Number(m[1]),
      ),
      textblockTypeInputRule(/^(#{1,3})\s$/, nodes.heading, (m) => ({ level: m[1]!.length })),
      new InputRule(/^---$/, (state, _m, start, end) =>
        state.tr.replaceRangeWith(start - 1, end, nodes.horizontal_rule.create()),
      ),
    ],
  });
}

/** Shows `text` in an empty document. */
function placeholder(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const doc = state.doc;
        const only = doc.childCount === 1 ? doc.firstChild : null;
        if (!only?.isTextblock || only.content.size > 0) return null;
        return DecorationSet.create(doc, [
          Decoration.node(0, only.nodeSize, { class: 'ox-empty', 'data-placeholder': text }),
        ]);
      },
    },
  });
}

export function editorPlugins(opts: { placeholder: string; onLink: () => void }): Plugin[] {
  const onLink: Command = () => {
    opts.onLink();
    return true;
  };
  return [
    rules(),
    keymap({
      'Mod-z': undo,
      'Shift-Mod-z': redo,
      'Mod-y': redo,
      Backspace: undoInputRule,
      'Mod-b': toggleBold,
      'Mod-i': toggleItalic,
      'Mod-u': toggleUnderline,
      'Mod-Shift-x': toggleStrike,
      'Mod-k': onLink,
      'Mod-Alt-0': setBlockType(nodes.paragraph),
      'Mod-Alt-1': toggleHeading(1),
      'Mod-Alt-2': toggleHeading(2),
      'Mod-Alt-3': toggleHeading(3),
      'Mod-Shift-7': toggleList(nodes.ordered_list),
      'Mod-Shift-8': toggleList(nodes.bullet_list),
      'Mod-Shift-9': wrapIn(nodes.blockquote),
      'Mod-\\': clearFormatting,
      'Shift-Enter': insertBreak,
      Enter: splitListItem(nodes.list_item),
      Tab: sinkListItem(nodes.list_item),
      'Shift-Tab': liftListItem(nodes.list_item),
    }),
    keymap(baseKeymap),
    history(),
    dropCursor({ color: 'var(--op-blue)', width: 2 }),
    gapCursor(),
    placeholder(opts.placeholder),
    suggestionsPlugin(),
  ];
}
