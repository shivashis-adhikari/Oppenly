import { Icon, Mark } from '@oppenly/ui';
import { applyRewrite, cancelRewrite, openSettings, openSidebar, startRewrite } from '../actions';
import { aiStatus, rewriteView, selectionBar } from '../store';
import { place } from './geometry';

const QUICK_AI = [
  { mode: 'improve', label: 'Improve' },
  { mode: 'shorten', label: 'Shorten' },
  { mode: 'professional', label: 'Professional' },
] as const;

const QUICK_LOCAL = [
  { mode: 'shorten', label: 'Shorten' },
  { mode: 'formal', label: 'Formal' },
  { mode: 'friendly', label: 'Friendly' },
] as const;

export function SelectionBar() {
  const bar = selectionBar.value;
  if (!bar || rewriteView.value) return null;
  const quick = aiStatus.value.ready ? QUICK_AI : QUICK_LOCAL;
  const width = aiStatus.value.ready ? 340 : 300;
  const left = Math.max(8, Math.min(bar.anchor.x, window.innerWidth - width - 8));
  const top = bar.anchor.y - 48 > 8 ? bar.anchor.y - 48 : bar.anchor.y + bar.anchor.height + 8;
  return (
    <div
      class="op-pop op-selbar"
      role="toolbar"
      aria-label="Rewrite selection"
      style={{ left: `${left}px`, top: `${top}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span style={{ display: 'grid', placeItems: 'center', width: '28px' }}>
        <Mark size={16} />
      </span>
      {quick.map((q) => (
        <button
          key={q.mode}
          type="button"
          class="op-selbar__btn"
          onClick={() => startRewrite(bar.session, bar.start, bar.end, q.mode, q.label, bar.anchor)}
        >
          {q.label}
        </button>
      ))}
      <span class="op-selbar__sep" />
      <button type="button" class="op-selbar__btn" onClick={() => openSidebar('rewrite')}>
        More
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  );
}

const SOURCE_LABEL = { local: 'On this device', device: 'On-device AI', ai: 'AI' } as const;

export function RewritePopover() {
  const view = rewriteView.value;
  if (!view) return null;
  const width = 380;
  const pos = place(view.anchor, { width, height: 280 }, 10);
  const close = () => {
    cancelRewrite();
    rewriteView.value = null;
  };
  const provider = aiStatus.value.provider;
  return (
    <div
      class="op-pop op-rewrite"
      role="dialog"
      aria-label={view.label}
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('textarea, input')) e.preventDefault();
      }}
    >
      <div class="op-rewrite__head">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Mark size={16} />
          {view.label}
        </span>
        <button type="button" class="op-icon" aria-label="Close" onClick={close}>
          <Icon name="close" size={16} />
        </button>
      </div>
      {view.status === 'error' ? (
        <div class="op-note">
          {view.error}{' '}
          {/provider/i.test(view.error ?? '') && (
            <button
              type="button"
              class="op-link-btn"
              style={{ padding: 0, display: 'inline' }}
              onClick={openSettings}
            >
              Open settings
            </button>
          )}
        </div>
      ) : (
        <div class="op-result" aria-live="polite">
          {view.text || (view.status === 'running' ? '' : 'No changes needed.')}
          {view.status === 'running' && <span class="op-caret" />}
        </div>
      )}
      <div class="op-rewrite__actions">
        <button
          type="button"
          class="op-btn op-btn--primary"
          disabled={view.status !== 'done' || !view.text.trim()}
          onClick={() => void applyRewrite('replace')}
        >
          Replace
        </button>
        <button
          type="button"
          class="op-btn"
          disabled={view.status !== 'done' || !view.text.trim()}
          onClick={() => void applyRewrite('insert')}
        >
          Insert below
        </button>
        <button
          type="button"
          class="op-icon"
          aria-label="Copy"
          title="Copy"
          disabled={view.status !== 'done'}
          onClick={() => void navigator.clipboard?.writeText(view.text)}
        >
          <Icon name="copy" size={16} />
        </button>
        <button
          type="button"
          class="op-icon"
          aria-label="Try again"
          title="Try again"
          disabled={view.status === 'running'}
          onClick={() =>
            startRewrite(
              view.session,
              view.start,
              view.end,
              view.mode as never,
              view.label,
              view.anchor,
              view.custom,
            )
          }
        >
          <Icon name="refresh" size={16} />
        </button>
        <span style={{ flex: 1 }} />
        {view.source && (
          <span class="op-source">
            <Icon name={view.source === 'ai' ? 'globe' : 'lock'} size={12} />
            {view.source === 'ai' && provider ? provider : SOURCE_LABEL[view.source]}
          </span>
        )}
      </div>
    </div>
  );
}
