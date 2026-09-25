import { signal } from '@preact/signals';
import type { DocSession } from '../editor/session';
import { rewrite, type Source } from '../lib/rewrite';
import { toast } from '../lib/toast';

export interface RewriteView {
  /** Where the result appears: next to the selection, or in the side panel. */
  where: 'popover' | 'panel';
  from: number;
  to: number;
  original: string;
  mode: string;
  label: string;
  custom: string;
  status: 'running' | 'done' | 'error';
  text: string;
  source: Source | null;
  error: string | null;
  /** Viewport position of the selection, for the popover. */
  anchor: { x: number; y: number; height: number };
}

export const rewriteView = signal<RewriteView | null>(null);
let controller: AbortController | null = null;

export function startRewrite(
  session: DocSession,
  init: Pick<RewriteView, 'where' | 'from' | 'to' | 'mode' | 'label' | 'anchor'> & {
    custom?: string;
  },
): void {
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  const original = session.view.state.doc.textBetween(init.from, init.to, '\n');
  rewriteView.value = {
    ...init,
    custom: init.custom ?? '',
    original,
    status: 'running',
    text: '',
    source: null,
    error: null,
  };
  const update = (patch: Partial<RewriteView>) => {
    if (signal.aborted || !rewriteView.value) return;
    rewriteView.value = { ...rewriteView.value, ...patch };
  };
  rewrite(original, init.mode, session.record.value.goals, {
    custom: init.custom,
    signal,
    onText: (text) => update({ text }),
  }).then(
    (result) => {
      const same = result.text.trim() === original.trim();
      update({
        status: 'done',
        text: result.text,
        source: result.source,
        error: same ? 'No changes needed. This text already reads well for this option.' : null,
      });
    },
    (err: Error) => {
      if (err.name === 'AbortError') return;
      update({ status: 'error', error: err.message });
    },
  );
}

export function retryRewrite(session: DocSession): void {
  const view = rewriteView.value;
  if (view) startRewrite(session, view);
}

export function closeRewrite(): void {
  controller?.abort();
  controller = null;
  rewriteView.value = null;
}

/** Puts the result into the document, replacing the original or below it. */
export function applyRewrite(session: DocSession, how: 'replace' | 'insert'): void {
  const view = rewriteView.value;
  if (view?.status !== 'done' || !view.text.trim()) return;
  const doc = session.view.state.doc;
  const current = view.to <= doc.content.size ? doc.textBetween(view.from, view.to, '\n') : null;
  if (current !== view.original) {
    toast('The text changed while rewriting. Select it and try again.');
    return;
  }
  if (how === 'replace') session.replaceRange(view.from, view.to, view.text.trim());
  else session.insertAfter(view.to, view.text.trim());
  closeRewrite();
}
