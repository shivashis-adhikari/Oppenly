import type { Category, Goals, Suggestion } from '@oppenly/engine';
import { CATEGORY_LABEL, Icon, Mark, ScoreRing } from '@oppenly/ui';
import { useEffect, useState } from 'preact/hooks';
import { goalsFor, updateSettings } from '../../shared/settings';
import { closeSidebar, currentSelectionTarget, HOST, openSettings, startRewrite } from '../actions';
import type { Session } from '../session';
import {
  activeSession,
  aiStatus,
  card,
  frame,
  hovered,
  rewriteView,
  type SidebarTab,
  settings,
  sidebar,
} from '../store';
import { Fixes, MoreActions, sourceLabel } from './Card';

const CATS: Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];

export function Sidebar() {
  frame.value;
  const sb = sidebar.value;
  if (!sb.open) return null;
  const session = activeSession();
  const setTab = (tab: SidebarTab) => {
    sidebar.value = { open: true, tab };
  };
  const tabs: { id: SidebarTab; label: string }[] = [
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'rewrite', label: 'Rewrite' },
    { id: 'insights', label: 'Insights' },
  ];
  const ai = aiStatus.value;
  return (
    <aside
      class="op-sidebar"
      aria-label="Oppenly assistant"
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('textarea, input, select')) e.preventDefault();
      }}
    >
      <div class="op-sb__head">
        <div class="op-sb__brand">
          <Mark size={20} />
          Oppenly
        </div>
        <div class="op-sb__spacer" />
        {session?.analysis.value && <ScoreRing score={session.analysis.value.score} size={34} />}
        <button
          type="button"
          class="op-icon"
          aria-label="Settings"
          title="Settings"
          onClick={openSettings}
        >
          <Icon name="gear" size={18} />
        </button>
        <button
          type="button"
          class="op-icon"
          aria-label="Close assistant"
          title="Close"
          onClick={closeSidebar}
        >
          <Icon name="close" size={18} />
        </button>
      </div>
      <div class="op-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            class="op-tab"
            aria-selected={sb.tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div class="op-sb__body" role="tabpanel">
        {!session ? (
          <div class="op-empty">
            <strong>Click into a text field</strong>
            Oppenly checks the field you are typing in.
          </div>
        ) : sb.tab === 'suggestions' ? (
          <SuggestionsTab session={session} />
        ) : sb.tab === 'rewrite' ? (
          <RewriteTab session={session} />
        ) : (
          <InsightsTab session={session} />
        )}
      </div>
      <div class="op-sb__foot">
        <span class="op-status">
          <span
            class="op-status__dot"
            style={ai.ready && !ai.local ? { background: 'var(--op-blue)' } : undefined}
          />
          {ai.ready
            ? ai.local
              ? `Checking on this device · ${ai.provider}`
              : `On-device checks + ${ai.provider}`
            : 'Checking on this device'}
        </span>
        {session?.ai.value === 'pending' && <span>AI checking…</span>}
        {session?.ai.value === 'error' && <span title={session.aiError.value}>AI unavailable</span>}
      </div>
    </aside>
  );
}

function SuggestionsTab({ session }: { session: Session }) {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const all = session.suggestions.value;
  const counts = session.counts();
  const list = filter === 'all' ? all : all.filter((s) => s.category === filter);
  const fixable = all.filter(
    (s) => s.category === 'correctness' && s.kind !== 'info' && s.replacements.length > 0,
  );

  if (all.length === 0) {
    return (
      <div class="op-empty">
        <Mark size={28} />
        <strong>{session.checking.value ? 'Checking…' : 'No suggestions'}</strong>
        {session.checking.value
          ? 'Reading your text.'
          : session.analysis.value
            ? 'Your text looks good.'
            : 'Start typing to get suggestions.'}
      </div>
    );
  }

  return (
    <>
      <fieldset class="op-filters" aria-label="Filter by category">
        <button
          type="button"
          class="op-filter"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All <span class="op-filter__n">{all.length}</span>
        </button>
        {CATS.filter((c) => counts[c] > 0).map((c) => (
          <button
            key={c}
            type="button"
            class="op-filter"
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
          >
            <span class="op-dot" data-cat={c} />
            {CATEGORY_LABEL[c]} <span class="op-filter__n">{counts[c]}</span>
          </button>
        ))}
      </fieldset>
      {fixable.length > 1 && (filter === 'all' || filter === 'correctness') && (
        <div class="op-bulk">
          {fixable.length} correctness fixes
          <button
            type="button"
            class="op-btn op-btn--primary"
            onClick={() => void session.acceptAll(fixable)}
          >
            Accept all
          </button>
        </div>
      )}
      <div class="op-list">
        {list.map((s) => (
          <Item
            key={s.id}
            session={session}
            s={s}
            open={open === s.id}
            onToggle={() => {
              setOpen(open === s.id ? null : s.id);
              setMenu(null);
              if (open !== s.id) scrollIntoView(session, s);
            }}
            menu={menu === s.id}
            onMenu={() => setMenu(menu === s.id ? null : s.id)}
          />
        ))}
      </div>
    </>
  );
}

function scrollIntoView(session: Session, s: Suggestion) {
  const rect = session.adapter.rects(s.start, s.end)[0];
  if (!rect) return;
  if (rect.y < 60 || rect.y > window.innerHeight - 80)
    window.scrollBy({ top: rect.y - window.innerHeight / 3, behavior: 'smooth' });
}

function Item({
  session,
  s,
  open,
  onToggle,
  menu,
  onMenu,
}: {
  session: Session;
  s: Suggestion;
  open: boolean;
  onToggle: () => void;
  menu: boolean;
  onMenu: () => void;
}) {
  const replacement = s.replacements[0];
  const preview =
    s.kind === 'info' ? (
      s.original
    ) : replacement === '' ? (
      <span class="op-del">{s.original.trim()}</span>
    ) : (
      <>
        <span class="op-del">{s.original}</span> <span class="op-ins">{replacement}</span>
      </>
    );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only mirrors the highlight in the text; the row is a button
    <div
      class="op-item"
      data-open={open}
      data-hover={hovered.value === s.id}
      onMouseEnter={() => {
        hovered.value = s.id;
      }}
      onMouseLeave={() => {
        if (hovered.value === s.id) hovered.value = null;
      }}
    >
      <button type="button" class="op-item__row" aria-expanded={open} onClick={onToggle}>
        <span class="op-dot" data-cat={s.category} />
        <span class="op-item__title">{s.title}</span>
        {!open && <span class="op-item__preview">{preview}</span>}
      </button>
      {open && (
        <div class="op-item__body">
          <Fixes session={session} s={s} />
          <p class="op-card__msg">{s.message}</p>
          <div class="op-card__foot" style={{ position: 'relative' }}>
            <span class="op-source">
              <Icon name={s.source === 'ai' ? 'globe' : 'lock'} size={12} />
              {sourceLabel(s, aiStatus.value.provider)}
            </span>
            <span style={{ display: 'flex', gap: '2px' }}>
              <button type="button" class="op-link-btn" onClick={() => session.dismiss(s.id)}>
                <Icon name="trash" size={14} />
                Dismiss
              </button>
              <button
                type="button"
                class="op-icon"
                aria-label="More actions"
                aria-expanded={menu}
                onClick={onMenu}
              >
                <Icon name="more" size={16} />
              </button>
            </span>
            {menu && <MoreActions s={s} onClose={onMenu} />}
          </div>
        </div>
      )}
    </div>
  );
}

const LOCAL_MODES = [
  { mode: 'shorten', label: 'Shorten it' },
  { mode: 'formal', label: 'Sound formal' },
  { mode: 'friendly', label: 'Sound friendly' },
  { mode: 'confident', label: 'Sound confident' },
  { mode: 'simplify', label: 'Simplify it' },
] as const;

const AI_MODES = [
  { mode: 'improve', label: 'Improve it' },
  { mode: 'shorten', label: 'Shorten it' },
  { mode: 'expand', label: 'More detailed' },
  { mode: 'simplify', label: 'Simplify it' },
  { mode: 'professional', label: 'Sound professional' },
  { mode: 'friendly', label: 'Sound friendly' },
  { mode: 'confident', label: 'Sound confident' },
  { mode: 'persuasive', label: 'More persuasive' },
  { mode: 'fix', label: 'Fix grammar only' },
] as const;

function RewriteTab({ session }: { session: Session }) {
  const [custom, setCustom] = useState('');
  const ai = aiStatus.value;
  const target = currentSelectionTarget();
  const scope =
    target && (target.start > 0 || target.end < session.adapter.getText().length)
      ? 'selection'
      : 'text';
  const run = (mode: string, label: string, instruction = '') => {
    if (!target) return;
    const rects = session.adapter.rects(target.start, Math.min(target.end, target.start + 1));
    const anchor = rects[0] ?? { x: window.innerWidth / 2 - 190, y: 120, width: 1, height: 1 };
    card.value = null;
    startRewrite(
      target.session,
      target.start,
      target.end,
      mode as never,
      label,
      anchor,
      instruction,
    );
  };
  const modes = ai.ready ? AI_MODES : LOCAL_MODES;
  return (
    <>
      <div class="op-section">
        <h4>Rewrite {scope === 'selection' ? 'the selected text' : 'the whole text'}</h4>
        <div class="op-chips">
          {modes.map((m) => (
            <button
              key={m.mode}
              type="button"
              class="op-chip"
              disabled={!target}
              onClick={() => run(m.mode, m.label)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {!ai.ready && (
          <div class="op-note">
            These rewrites run on your device and only change wording. For full rewrites, add an AI
            provider in{' '}
            <button
              type="button"
              class="op-link-btn"
              style={{ padding: 0, display: 'inline' }}
              onClick={openSettings}
            >
              settings
            </button>
            .
          </div>
        )}
      </div>
      {ai.ready && (
        <div class="op-section">
          <h4>Custom instruction</h4>
          <textarea
            class="op-textarea"
            placeholder="For example: make it sound warmer and add a clear next step"
            value={custom}
            onInput={(e) => setCustom((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <div>
            <button
              type="button"
              class="op-btn op-btn--primary"
              disabled={!custom.trim() || !target}
              onClick={() => run('custom', 'Custom rewrite', custom.trim())}
            >
              <Icon name="pen" size={16} />
              Rewrite
            </button>
          </div>
        </div>
      )}
      {rewriteView.value && <p class="op-card__msg">The result opens next to your text.</p>}
    </>
  );
}

const AUDIENCE: { value: Goals['audience']; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'knowledgeable', label: 'Knowledgeable' },
  { value: 'expert', label: 'Expert' },
];
const FORMALITY: { value: Goals['formality']; label: string }[] = [
  { value: 'informal', label: 'Informal' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
];
const DOMAIN: { value: Goals['domain']; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'business', label: 'Business' },
  { value: 'technical', label: 'Technical' },
  { value: 'creative', label: 'Creative' },
  { value: 'casual', label: 'Casual' },
  { value: 'email', label: 'Email' },
];
const INTENT: { value: Goals['intent']; label: string }[] = [
  { value: 'inform', label: 'Inform' },
  { value: 'describe', label: 'Describe' },
  { value: 'convince', label: 'Convince' },
  { value: 'tell-a-story', label: 'Tell a story' },
];

function GoalSelect<K extends keyof Goals>({
  k,
  label,
  options,
}: {
  k: K;
  label: string;
  options: { value: Goals[K]; label: string }[];
}) {
  const goals = goalsFor(settings.value, HOST);
  return (
    <div class="op-goal">
      <label for={`op-goal-${k}`}>{label}</label>
      <select
        id={`op-goal-${k}`}
        class="op-select"
        value={goals[k]}
        onChange={(e) => {
          const value = (e.currentTarget as HTMLSelectElement).value as Goals[K];
          void updateSettings((s) => ({
            siteGoals: { ...s.siteGoals, [HOST]: { ...goalsFor(s, HOST), [k]: value } },
          }));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

function readabilityWord(score: number): string {
  if (score >= 70) return 'Easy to read';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

function InsightsTab({ session }: { session: Session }) {
  const a = session.analysis.value;
  useEffect(() => {
    // Goals changes re-run the check for this field.
    session.schedule(0);
  }, [JSON.stringify(goalsFor(settings.value, HOST))]);
  return (
    <>
      <div class="op-section">
        <h4>Goals for {HOST}</h4>
        <GoalSelect k="audience" label="Audience" options={AUDIENCE} />
        <GoalSelect k="formality" label="Formality" options={FORMALITY} />
        <GoalSelect k="domain" label="Domain" options={DOMAIN} />
        <GoalSelect k="intent" label="Intent" options={INTENT} />
      </div>
      <div class="op-section">
        <h4>Tone</h4>
        {a && a.tones.length > 0 ? (
          a.tones.map((t) => (
            <div key={t.id} class="op-tone">
              {t.label}
              <div class="op-bar">
                <i style={{ width: `${Math.max(12, t.strength * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p class="op-card__msg" style={{ margin: 0 }}>
            Write a little more (about two sentences) to detect the tone.
          </p>
        )}
      </div>
      {a && (
        <div class="op-section">
          <h4>Performance</h4>
          <div class="op-stat-grid">
            <div class="op-stat">
              <b>{a.stats.words}</b>
              <span>Words</span>
            </div>
            <div class="op-stat">
              <b>{a.stats.characters}</b>
              <span>Characters</span>
            </div>
            <div class="op-stat">
              <b>{formatTime(a.stats.readingTime)}</b>
              <span>Reading time</span>
            </div>
            <div class="op-stat">
              <b>{formatTime(a.stats.speakingTime)}</b>
              <span>Speaking time</span>
            </div>
            <div class="op-stat" title={readabilityWord(a.stats.readability)}>
              <b>{a.stats.readability}</b>
              <span>Readability</span>
            </div>
            <div class="op-stat">
              <b>{Math.round(a.stats.averageSentenceLength * 10) / 10}</b>
              <span>Words per sentence</span>
            </div>
            <div class="op-stat">
              <b>{Math.round(a.stats.uniqueWords * 100)}%</b>
              <span>Unique words</span>
            </div>
            <div class="op-stat">
              <b>{Math.round(a.stats.rareWords * 100)}%</b>
              <span>Rare words</span>
            </div>
          </div>
          <p class="op-readability">
            Readability {a.stats.readability}: {readabilityWord(a.stats.readability).toLowerCase()}.
            Scores of 60 and above are easy for most people to read.
          </p>
        </div>
      )}
    </>
  );
}
