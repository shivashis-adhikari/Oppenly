import type { Analysis, Category, Goals, Suggestion } from '@oppenly/engine';
import { batch, type Signal, signal } from '@preact/signals';
import { Fragment, Node as PMNode, Slice } from 'prosemirror-model';
import {
  AllSelection,
  EditorState,
  Selection,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { Mapping } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';
import { ai, aiStatus } from '../lib/ai';
import { type DocRecord, putDoc } from '../lib/docs';
import { engine } from '../lib/engine';
import { settings, updateSettings } from '../lib/settings';
import { toast } from '../lib/toast';
import { schema } from './schema';
import { blockAt, editorPlugins, markActive } from './setup';
import { mapPlaced, type Placed, place, suggestionsKey } from './suggestions';
import { TextMap } from './text';

export interface Formatting {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link: boolean;
  block: string;
}

export interface SelectionInfo {
  from: number;
  to: number;
  text: string;
  /** Viewport rectangle around the selection's start. */
  rect: { x: number; y: number; width: number; height: number };
}

/** The selected text range, treating Select All as a range from the first to the last text. */
function textRange(selection: Selection, doc: PMNode): { from: number; to: number } | null {
  if (selection.empty) return null;
  if (selection instanceof AllSelection) {
    const from = Selection.atStart(doc).from;
    const to = Selection.atEnd(doc).to;
    return to > from ? { from, to } : null;
  }
  if (selection instanceof TextSelection) return { from: selection.from, to: selection.to };
  return null;
}

const LOCAL_DELAY = 220;
const AI_DELAY = 1400;
const SAVE_DELAY = 500;

/** One open document: the editor, its checks and saving. */
export class DocSession {
  readonly view: EditorView;
  readonly record: Signal<DocRecord>;
  readonly analysis = signal<Analysis | null>(null);
  readonly suggestions = signal<Placed[]>([]);
  readonly active = signal<string | null>(null);
  readonly checking = signal(false);
  readonly aiChecking = signal(false);
  readonly aiError = signal<string | null>(null);
  readonly saveState = signal<'saved' | 'saving' | 'error'>('saved');
  readonly formatting = signal<Formatting>({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    link: false,
    block: 'paragraph',
  });
  readonly selection = signal<SelectionInfo | null>(null);
  /** Bumped on every transaction, for views that depend on layout. */
  readonly tick = signal(0);

  private map: TextMap;
  private localTimer: ReturnType<typeof setTimeout> | undefined;
  private aiTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private aiAbort: AbortController | null = null;
  private run = 0;
  /** Edits made while a check was running, to move its results into place. */
  private pending: { run: number; mapping: Mapping } | null = null;
  private destroyed = false;
  /** Content, title or goals changed since the last save (moves the document to the top). */
  private edited = false;

  constructor(
    mount: HTMLElement,
    doc: DocRecord,
    opts: { onLink: () => void; placeholder: string },
  ) {
    this.record = signal(doc);
    const content = doc.content
      ? PMNode.fromJSON(schema, doc.content)
      : schema.node('doc', null, [schema.node('paragraph')]);
    const state = EditorState.create({
      doc: content,
      plugins: editorPlugins({ placeholder: opts.placeholder, onLink: opts.onLink }),
    });
    this.map = new TextMap(state.doc);
    this.view = new EditorView(mount, {
      state,
      attributes: {
        class: 'ox-prose',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'sentences',
        'aria-label': 'Document text',
        'aria-multiline': 'true',
        role: 'textbox',
      },
      dispatchTransaction: (tr) => this.dispatch(tr),
      handleDOMEvents: {
        click: (_view, event) => {
          const target = (event.target as HTMLElement).closest<HTMLElement>('[data-sid]');
          this.setActive(target?.dataset.sid ?? null);
          return false;
        },
      },
      handleClickOn: (_view, _pos, _node, _nodePos, event) => {
        // Ctrl/Cmd-click opens links; a plain click edits them.
        const link = (event.target as HTMLElement).closest('a');
        if (link && (event.metaKey || event.ctrlKey)) {
          window.open(link.href, '_blank', 'noopener,noreferrer');
          return true;
        }
        return false;
      },
    });
    this.syncUi();
    this.schedule(0);
  }

  get text(): string {
    return this.map.text;
  }

  private dispatch(tr: Transaction): void {
    if (this.destroyed) return;
    const state = this.view.state.apply(tr);
    this.view.updateState(state);
    if (tr.docChanged) {
      this.map = new TextMap(state.doc);
      if (this.pending) this.pending.mapping.appendMapping(tr.mapping);
      this.schedule(LOCAL_DELAY);
      this.queueSave(true);
    }
    this.syncUi();
  }

  private syncUi(): void {
    const state = this.view.state;
    const plugin = suggestionsKey.getState(state);
    batch(() => {
      this.suggestions.value = this.visible(plugin?.items ?? []);
      this.active.value = plugin?.active ?? null;
      this.formatting.value = {
        bold: markActive(state, schema.marks.strong),
        italic: markActive(state, schema.marks.em),
        underline: markActive(state, schema.marks.underline),
        strike: markActive(state, schema.marks.strike),
        link: markActive(state, schema.marks.link),
        block: blockAt(state),
      };
      const range = textRange(state.selection, state.doc);
      if (!range) this.selection.value = null;
      else {
        const start = this.view.coordsAtPos(range.from);
        const text = state.doc.textBetween(range.from, range.to, '\n');
        this.selection.value = text.trim()
          ? {
              ...range,
              text,
              rect: { x: start.left, y: start.top, width: 1, height: start.bottom - start.top },
            }
          : null;
      }
      this.tick.value++;
    });
  }

  private visible(items: Placed[]): Placed[] {
    const dismissed = new Set(this.record.value.dismissed ?? []);
    return items.filter((s) => !dismissed.has(s.id)).sort((a, b) => a.from - b.from);
  }

  /** Check again after `delay` ms. */
  schedule(delay: number): void {
    clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => void this.check(), delay);
  }

  private async aiConfig() {
    const s = settings.value;
    if (!s.ai.liveCheck || !aiStatus.value.ready) return null;
    return ai.config(s.ai.provider);
  }

  private async check(): Promise<void> {
    const run = ++this.run;
    const config = await this.aiConfig();
    if (run !== this.run || this.destroyed) return;
    const doc = this.view.state.doc;
    const text = this.map.text;
    const goals = this.record.value.goals;
    const known = config ? ai.cached(text, config, goals, settings.value.dialect) : [];
    this.pending = { run, mapping: new Mapping() };
    this.checking.value = true;
    try {
      const analysis = await engine.analyze(text, goals, known);
      if (run !== this.run || this.destroyed) return;
      this.show(analysis, doc);
    } catch (err) {
      console.error('Oppenly: check failed', err);
    } finally {
      if (run === this.run) this.checking.value = false;
    }
    if (config) {
      clearTimeout(this.aiTimer);
      this.aiTimer = setTimeout(() => void this.checkWithAi(run), AI_DELAY);
    }
  }

  private async checkWithAi(run: number): Promise<void> {
    if (run !== this.run || this.destroyed) return;
    const config = await this.aiConfig();
    if (!config || run !== this.run) return;
    this.aiAbort?.abort();
    const controller = new AbortController();
    this.aiAbort = controller;
    const doc = this.view.state.doc;
    const text = this.map.text;
    const goals = this.record.value.goals;
    this.aiChecking.value = true;
    this.pending = { run, mapping: new Mapping() };
    try {
      const extra = await ai.check(text, config, goals, settings.value.dialect, controller.signal);
      if (run !== this.run || controller.signal.aborted) return;
      const analysis = await engine.analyze(text, goals, extra);
      if (run !== this.run) return;
      this.aiError.value = null;
      this.show(analysis, doc);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') this.aiError.value = (err as Error).message;
    } finally {
      this.aiChecking.value = false;
    }
  }

  /** Puts an analysis of `checked` into the current document, moving it past later edits. */
  private show(analysis: Analysis, checked: PMNode): void {
    const map = new TextMap(checked);
    let placed = place(checked, analysis.suggestions, (a, b) => map.toRange(a, b));
    const current = this.view.state.doc;
    if (current !== checked && this.pending) {
      placed = mapPlaced(placed, this.pending.mapping, current);
    }
    this.analysis.value = analysis;
    const tr = this.view.state.tr.setMeta(suggestionsKey, { items: placed });
    tr.setMeta('addToHistory', false);
    this.view.dispatch(tr);
    const record = this.record.value;
    if (analysis.score !== record.score || analysis.stats.words !== record.words) this.queueSave();
  }

  setActive(id: string | null): void {
    const tr = this.view.state.tr.setMeta(suggestionsKey, { active: id });
    this.view.dispatch(tr);
  }

  find(id: string): Placed | undefined {
    return this.suggestions.value.find((s) => s.id === id);
  }

  /** Applies a suggestion's replacement. Keeps the formatting of the replaced text. */
  accept(s: Placed, replacement = s.replacements[0] ?? ''): boolean {
    const state = this.view.state;
    if (state.doc.textBetween(s.from, s.to, '\n') !== s.original) return false;
    let from = s.from;
    const to = s.to;
    // Removing a word: also remove one adjoining space so no double space is left behind.
    if (replacement === '') {
      const before = state.doc.textBetween(Math.max(0, from - 1), from);
      const after = state.doc.textBetween(to, Math.min(state.doc.content.size, to + 1));
      if (before === ' ' && (after === ' ' || /[.,;:!?]/.test(after))) from -= 1;
    }
    const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to)) ?? undefined;
    let tr = replacement
      ? state.tr.replaceWith(from, to, schema.text(replacement, marks))
      : state.tr.delete(from, to);
    // Put the cursor after the fix so writing can continue from there.
    tr = tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(to)));
    this.view.dispatch(tr.scrollIntoView());
    this.view.focus();
    return true;
  }

  /** Accepts every fixable suggestion in `category`, as one undo step. */
  acceptAll(category: Category): number {
    const list = this.suggestions.value
      .filter((s) => s.category === category && s.kind !== 'info' && s.replacements.length)
      .sort((a, b) => b.from - a.from);
    if (!list.length) return 0;
    let tr = this.view.state.tr;
    let count = 0;
    for (const s of list) {
      if (tr.doc.textBetween(s.from, s.to, '\n') !== s.original) continue;
      const replacement = s.replacements[0] ?? '';
      const marks = tr.doc.resolve(s.from).marksAcross(tr.doc.resolve(s.to)) ?? undefined;
      tr = replacement
        ? tr.replaceWith(s.from, s.to, schema.text(replacement, marks))
        : tr.delete(s.from, s.to);
      count++;
    }
    this.view.dispatch(tr);
    return count;
  }

  dismiss(s: Suggestion): void {
    this.patch({ dismissed: [...new Set([...(this.record.value.dismissed ?? []), s.id])] }, false);
    this.syncUi();
  }

  async addToDictionary(word: string): Promise<void> {
    await updateSettings((cur) => ({ dictionary: [...new Set([...cur.dictionary, word.trim()])] }));
    toast(`Added “${word.trim()}” to your dictionary.`);
  }

  async disableRule(s: Suggestion): Promise<void> {
    await updateSettings((cur) => ({
      disabledRules: [...new Set([...cur.disabledRules, s.rule])],
    }));
    toast('Turned off. You can turn it back on in Settings.');
  }

  setGoals(goals: Goals): void {
    this.patch({ goals });
    this.schedule(0);
  }

  setTitle(title: string): void {
    this.patch({ title });
  }

  /** Replaces the text between `from` and `to` with `text`; newlines start new paragraphs. */
  replaceRange(from: number, to: number, text: string): void {
    const state = this.view.state;
    const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to)) ?? undefined;
    const lines = text.replace(/\r\n?/g, '\n').split(/\n+/);
    const paragraphs = lines.map((line) =>
      schema.node('paragraph', null, line ? [schema.text(line, marks)] : []),
    );
    // Open on both sides: the first line joins the text before, the last joins the text after.
    const slice = new Slice(Fragment.from(paragraphs), 1, 1);
    this.view.dispatch(state.tr.replace(from, to, slice).scrollIntoView());
    this.view.focus();
  }

  /** Inserts `text` as new paragraphs after the block that contains `pos`. */
  insertAfter(pos: number, text: string): void {
    const state = this.view.state;
    const $pos = state.doc.resolve(pos);
    const after = $pos.after(1);
    const paragraphs = text
      .replace(/\r\n?/g, '\n')
      .split(/\n+/)
      .filter((l) => l.trim())
      .map((l) => schema.node('paragraph', null, [schema.text(l)]));
    if (!paragraphs.length) return;
    this.view.dispatch(state.tr.insert(after, paragraphs).scrollIntoView());
    this.view.focus();
  }

  /** Replaces the whole document (used after importing or restoring). */
  setContent(doc: PMNode): void {
    const state = this.view.state;
    this.view.dispatch(state.tr.replaceWith(0, state.doc.content.size, doc.content));
  }

  private patch(change: Partial<DocRecord>, edit = true): void {
    this.record.value = { ...this.record.value, ...change };
    this.queueSave(edit);
  }

  private queueSave(edit = false): void {
    if (edit) this.edited = true;
    this.saveState.value = 'saving';
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY);
  }

  async save(): Promise<void> {
    clearTimeout(this.saveTimer);
    const analysis = this.analysis.value;
    const record: DocRecord = {
      ...this.record.value,
      content: this.view.state.doc.toJSON(),
      text: this.map.text,
      words: analysis?.stats.words ?? this.record.value.words,
      score: analysis?.score ?? null,
      updatedAt: this.edited ? Date.now() : this.record.value.updatedAt,
    };
    this.edited = false;
    try {
      await putDoc(record);
      this.record.value = record;
      this.saveState.value = 'saved';
    } catch (err) {
      console.error('Oppenly: could not save', err);
      this.saveState.value = 'error';
    }
  }

  /** Saves any unsaved change and tears the editor down. */
  async close(): Promise<void> {
    clearTimeout(this.localTimer);
    clearTimeout(this.aiTimer);
    this.aiAbort?.abort();
    if (this.saveState.value !== 'saved') await this.save();
    this.destroyed = true;
    this.view.destroy();
  }
}
