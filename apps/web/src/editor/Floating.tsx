import { Icon, Mark } from '@oppenly/ui';
import { useEffect, useRef } from 'preact/hooks';
import { quickModes } from '../lib/rewrite';
import { panel } from '../panel/Panel';
import { CopyButton, RewriteBody } from '../panel/RewriteTab';
import {
  applyRewrite,
  closeRewrite,
  retryRewrite,
  rewriteView,
  startRewrite,
} from '../panel/rewrite-state';
import type { DocSession } from './session';

const BAR_WIDTH = 318;

/** Quick rewrite actions above a text selection. */
export function SelectionBar({ session }: { session: DocSession }) {
  const sel = session.selection.value;
  if (!sel || rewriteView.value || sel.text.trim().length < 3) return null;
  const left = Math.max(12, Math.min(sel.rect.x - 12, window.innerWidth - BAR_WIDTH - 12));
  const top = sel.rect.y - 50 > 60 ? sel.rect.y - 50 : sel.rect.y + sel.rect.height + 10;
  const run = (mode: string, label: string) =>
    startRewrite(session, {
      where: 'popover',
      from: sel.from,
      to: sel.to,
      mode,
      label,
      anchor: { x: sel.rect.x, y: sel.rect.y, height: sel.rect.height },
    });
  return (
    <div
      class="ox-selbar"
      role="toolbar"
      aria-label="Rewrite selection"
      style={{ left: `${left}px`, top: `${top}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span class="ox-selbar__mark">
        <Mark size={16} />
      </span>
      {quickModes().map((m) => (
        <button
          key={m.mode}
          type="button"
          class="ox-selbar__btn"
          onClick={() => run(m.mode, m.label)}
        >
          {m.label}
        </button>
      ))}
      <span class="ox-selbar__sep" />
      <button
        type="button"
        class="ox-selbar__btn"
        onClick={() => {
          panel.value = { open: true, tab: 'rewrite' };
        }}
      >
        More
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );
}

const POP_WIDTH = 400;

/** The result of a quick rewrite, shown under the selection. */
export function RewritePopover({ session }: { session: DocSession }) {
  const view = rewriteView.value;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (view?.where !== 'popover') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRewrite();
        session.view.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRewrite();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [view?.where]);
  if (view?.where !== 'popover') return null;

  const left = Math.max(12, Math.min(view.anchor.x - 12, window.innerWidth - POP_WIDTH - 12));
  const below = view.anchor.y + view.anchor.height + 10;
  const top = below + 260 < window.innerHeight ? below : Math.max(12, view.anchor.y - 280);
  const done = view.status === 'done';
  return (
    <div
      ref={ref}
      class="ox-pop"
      role="dialog"
      aria-label={view.label}
      style={{ left: `${left}px`, top: `${top}px`, width: `${POP_WIDTH}px` }}
    >
      <div class="ox-pop__head">
        <Mark size={16} />
        <strong>{view.label}</strong>
        <span class="ox-grow" />
        <button type="button" class="op-icon-btn" aria-label="Close" onClick={closeRewrite}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <RewriteBody />
      <div class="ox-actions">
        <button
          type="button"
          class="op-btn op-btn--primary op-btn--sm"
          disabled={!done || !view.text.trim() || view.text.trim() === view.original.trim()}
          onClick={() => applyRewrite(session, 'replace')}
        >
          Replace
        </button>
        <button
          type="button"
          class="op-btn op-btn--secondary op-btn--sm"
          disabled={!done || !view.text.trim()}
          onClick={() => applyRewrite(session, 'insert')}
        >
          Insert below
        </button>
        <span class="ox-grow" />
        <CopyButton text={view.text} disabled={!done} />
        <button
          type="button"
          class="op-icon-btn"
          aria-label="Try again"
          title="Try again"
          disabled={view.status === 'running'}
          onClick={() => retryRewrite(session)}
        >
          <Icon name="refresh" size={16} />
        </button>
      </div>
    </div>
  );
}
