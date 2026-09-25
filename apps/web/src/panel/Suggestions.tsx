import { CATEGORIES, type Category } from '@oppenly/engine/types';
import { CATEGORY_LABEL, diffWords, Icon } from '@oppenly/ui';
import { useEffect, useRef, useState } from 'preact/hooks';
import { undo } from 'prosemirror-history';
import type { DocSession } from '../editor/session';
import type { Placed } from '../editor/suggestions';
import { aiStatus } from '../lib/ai';
import { toast } from '../lib/toast';

export function sourceLabel(s: Placed): string {
  if (s.source === 'ai') return aiStatus.value.provider ? `AI · ${aiStatus.value.provider}` : 'AI';
  if (s.source === 'device-ai') return 'On-device AI';
  return 'Checked on this device';
}

type Filter = 'all' | Category;

export function SuggestionsTab({ session }: { session: DocSession }) {
  const [filter, setFilter] = useState<Filter>('all');
  const all = session.suggestions.value;
  const active = session.active.value;
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c, all.filter((s) => s.category === c).length]),
  ) as Record<Category, number>;
  const list = filter === 'all' ? all : all.filter((s) => s.category === filter);
  const fixable = all.filter(
    (s) => s.category === 'correctness' && s.kind !== 'info' && s.replacements.length,
  );
  const analysed = session.analysis.value !== null;

  // Clicking an underline in the text opens its card here.
  useEffect(() => {
    if (!active) return;
    const s = all.find((x) => x.id === active);
    if (s && filter !== 'all' && s.category !== filter) setFilter('all');
  }, [active]);

  return (
    <div class="ox-sugg">
      <div class="ox-filters" role="tablist" aria-label="Suggestion categories">
        <FilterTab id="all" label="All" count={all.length} filter={filter} onPick={setFilter} />
        {CATEGORIES.map((c) => (
          <FilterTab
            key={c}
            id={c}
            label={CATEGORY_LABEL[c]}
            count={counts[c]}
            filter={filter}
            onPick={setFilter}
          />
        ))}
      </div>

      {fixable.length > 1 && (filter === 'all' || filter === 'correctness') && (
        <div class="ox-bulk">
          <span>
            <strong>{fixable.length}</strong> correctness fixes
          </span>
          <button
            type="button"
            class="op-btn op-btn--secondary op-btn--sm"
            onClick={() => {
              const n = session.acceptAll('correctness');
              if (n) toast(`Accepted ${n} fixes.`, { label: 'Undo', run: () => undoLast(session) });
            }}
          >
            Accept all
          </button>
        </div>
      )}

      <div class="ox-cards">
        {list.map((s) => (
          <Card key={s.id} session={session} s={s} open={s.id === active} />
        ))}
        {analysed && list.length === 0 && <Empty filter={filter} total={all.length} />}
        {!analysed && <p class="ox-quiet">Checking your writing…</p>}
      </div>
    </div>
  );
}

function undoLast(session: DocSession) {
  undo(session.view.state, session.view.dispatch);
  session.view.focus();
}

function FilterTab({
  id,
  label,
  count,
  filter,
  onPick,
}: {
  id: Filter;
  label: string;
  count: number;
  filter: Filter;
  onPick: (f: Filter) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      class="ox-filter"
      data-cat={id}
      aria-selected={filter === id}
      onClick={() => onPick(id)}
    >
      <span class="ox-filter__n">{count}</span>
      <span class="ox-filter__label">{label}</span>
    </button>
  );
}

function Empty({ filter, total }: { filter: Filter; total: number }) {
  if (filter !== 'all' && total > 0)
    return <p class="ox-quiet">No {CATEGORY_LABEL[filter].toLowerCase()} suggestions.</p>;
  return (
    <div class="ox-empty-state">
      <span class="ox-empty-state__icon">
        <Icon name="check" size={20} />
      </span>
      <strong>Nothing to fix right now</strong>
      <p>Keep writing. Suggestions appear here as you type.</p>
    </div>
  );
}

function Card({ session, s, open }: { session: DocSession; s: Placed; open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else setMenu(false);
  }, [open]);

  const replacement = s.replacements[0];
  const toggle = () => {
    session.setActive(open ? null : s.id);
    if (!open) scrollTextIntoView(session, s);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only mirrors the highlight in the text; the row is a button
    <div
      ref={ref}
      class="ox-card"
      data-cat={s.category}
      data-open={open}
      onMouseEnter={() => highlight(session, s.id, true)}
      onMouseLeave={() => highlight(session, s.id, false)}
    >
      <button type="button" class="ox-card__row" aria-expanded={open} onClick={toggle}>
        <span class="op-dot" data-cat={s.category} />
        {open ? (
          <span class="ox-card__cat">{CATEGORY_LABEL[s.category]}</span>
        ) : (
          <span class="ox-card__summary">
            <Preview s={s} replacement={replacement} />
            <span class="ox-card__title">{s.title}</span>
          </span>
        )}
      </button>
      {open && (
        <div class="ox-card__body">
          <h3 class="ox-card__heading">{s.title}</h3>
          <Fixes session={session} s={s} />
          <p class="ox-card__msg">{s.message}</p>
          <div class="ox-card__foot">
            <span class="ox-source">
              <Icon name={s.source === 'ai' ? 'globe' : 'lock'} size={12} />
              {sourceLabel(s)}
            </span>
            <span class="ox-card__actions">
              <button
                type="button"
                class="op-btn op-btn--ghost op-btn--sm"
                onClick={() => session.dismiss(s)}
              >
                <Icon name="trash" size={15} />
                Dismiss
              </button>
              <button
                type="button"
                class="op-icon-btn"
                aria-label="More actions"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Icon name="more" size={16} />
              </button>
              {menu && (
                <div class="ox-menu ox-menu--up" role="menu">
                  {s.rule === 'grammar.SpellCheck' && (
                    <button
                      type="button"
                      role="menuitem"
                      class="ox-menu__item"
                      onClick={() => void session.addToDictionary(s.original)}
                    >
                      <Icon name="book" size={16} />
                      Add “{s.original}” to dictionary
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    class="ox-menu__item"
                    onClick={() => void session.disableRule(s)}
                  >
                    <Icon name="close" size={16} />
                    Turn off suggestions like this
                  </button>
                </div>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({ s, replacement }: { s: Placed; replacement: string | undefined }) {
  if (s.kind === 'info' || replacement === undefined)
    return <span class="ox-card__word">{clip(s.original)}</span>;
  if (replacement === '') return <span class="ox-del">{clip(s.original.trim())}</span>;
  if (s.kind === 'rewrite' || s.original.length > 24)
    return <span class="ox-card__word">{clip(s.original)}</span>;
  return (
    <span class="ox-card__word">
      <span class="ox-del">{s.original}</span>
      <Icon name="arrowRight" size={12} class="ox-arrow" />
      <span class="ox-ins">{replacement}</span>
    </span>
  );
}

function clip(text: string, max = 32): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** The fix buttons: one per replacement, or a word diff and Accept for long rewrites. */
export function Fixes({ session, s }: { session: DocSession; s: Placed }) {
  if (s.kind === 'info' || !s.replacements.length) return null;
  const first = s.replacements[0] ?? '';
  const long = s.kind === 'rewrite' || s.original.length > 28 || first.length > 28;
  if (long) {
    return (
      <>
        <p class="ox-diff">
          {diffWords(s.original, first).map((p, i) => (
            <span
              key={i}
              class={p.type === 'del' ? 'ox-del' : p.type === 'ins' ? 'ox-ins' : undefined}
            >
              {p.text}
            </span>
          ))}
        </p>
        <div class="ox-fixes">
          <button type="button" class="ox-fix" onClick={() => session.accept(s)}>
            Accept
          </button>
        </div>
      </>
    );
  }
  return (
    <div class="ox-fixes">
      {s.replacements.slice(0, 4).map((r, i) => (
        <button
          key={r}
          type="button"
          class={i === 0 ? 'ox-fix' : 'ox-fix ox-fix--alt'}
          onClick={() => session.accept(s, r)}
        >
          {r === '' ? <span class="ox-del">{s.original.trim()}</span> : r}
        </button>
      ))}
    </div>
  );
}

function highlight(session: DocSession, id: string, on: boolean) {
  const el = session.view.dom.querySelectorAll<HTMLElement>(`[data-sid="${CSS.escape(id)}"]`);
  for (const node of el) node.classList.toggle('is-hover', on);
}

function scrollTextIntoView(session: DocSession, s: Placed) {
  const el = session.view.dom.querySelector<HTMLElement>(`[data-sid="${CSS.escape(s.id)}"]`);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
