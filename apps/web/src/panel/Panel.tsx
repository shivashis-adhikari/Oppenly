import { Icon, type IconName } from '@oppenly/ui';
import { effect, signal } from '@preact/signals';
import type { DocSession } from '../editor/session';
import { aiStatus } from '../lib/ai';
import { InsightsTab } from './InsightsTab';
import { RewriteTab } from './RewriteTab';
import { SuggestionsTab } from './Suggestions';

export type PanelTab = 'suggestions' | 'rewrite' | 'insights';

const KEY = 'oppenly.panel';

function initial(): { open: boolean; tab: PanelTab } {
  const wide = window.innerWidth >= 1100;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { open: boolean } | null;
    return { open: wide && (saved?.open ?? true), tab: 'suggestions' };
  } catch {
    return { open: wide, tab: 'suggestions' };
  }
}

export const panel = signal(initial());

effect(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ open: panel.value.open }));
  } catch {
    /* Not important enough to report. */
  }
});

const TABS: { id: PanelTab; label: string; icon: IconName }[] = [
  { id: 'suggestions', label: 'Suggestions', icon: 'list' },
  { id: 'rewrite', label: 'Rewrite', icon: 'pen' },
  { id: 'insights', label: 'Insights', icon: 'gauge' },
];

export function Panel({ session }: { session: DocSession }) {
  const { open, tab } = panel.value;
  if (!open) return null;
  const count = session.suggestions.value.length;
  const status = aiStatus.value;
  return (
    <aside class="ox-panel" aria-label="Writing assistant">
      <div class="ox-panel__tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            class="ox-panel__tab"
            aria-selected={tab === t.id}
            onClick={() => {
              panel.value = { open: true, tab: t.id };
            }}
          >
            <Icon name={t.icon} size={16} />
            {t.label}
            {t.id === 'suggestions' && count > 0 && <span class="ox-count">{count}</span>}
          </button>
        ))}
        <span class="ox-grow" />
        <button
          type="button"
          class="op-icon-btn"
          aria-label="Close assistant"
          title="Close assistant"
          onClick={() => {
            panel.value = { ...panel.value, open: false };
          }}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <div class="ox-panel__body" role="tabpanel">
        {tab === 'suggestions' && <SuggestionsTab session={session} />}
        {tab === 'rewrite' && <RewriteTab session={session} />}
        {tab === 'insights' && <InsightsTab session={session} />}
      </div>
      <div class="ox-panel__foot">
        <span class="ox-status" data-remote={status.ready && !status.local}>
          <Icon name={status.ready && !status.local ? 'globe' : 'lock'} size={13} />
          {status.ready
            ? status.local
              ? `On this computer · ${status.provider}`
              : `On this computer + ${status.provider}`
            : 'Everything runs on this computer'}
        </span>
        {session.aiChecking.value && <span class="ox-quiet">Checking with AI…</span>}
        {session.aiError.value && (
          <span class="ox-error-inline" title={session.aiError.value}>
            AI check failed
          </span>
        )}
      </div>
    </aside>
  );
}
