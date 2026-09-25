import type { Suggestion } from '@oppenly/engine';
import { CATEGORY_LABEL, diffWords, Icon } from '@oppenly/ui';
import { useState } from 'preact/hooks';
import { addToDictionary, disableRule, openSidebar } from '../actions';
import type { Session } from '../session';
import { aiStatus, card, frame, sessionById } from '../store';
import { place } from './geometry';

const WIDTH = 320;

export function sourceLabel(s: Suggestion, provider: string | null): string {
  if (s.source === 'ai') return provider ? `AI · ${provider}` : 'AI';
  if (s.source === 'device-ai') return 'On-device AI';
  return 'On this device';
}

export function Fixes({
  session,
  s,
  onDone,
}: {
  session: Session;
  s: Suggestion;
  onDone?: () => void;
}) {
  if (s.kind === 'info' || s.replacements.length === 0) return null;
  const long =
    s.kind === 'rewrite' || s.original.length > 28 || (s.replacements[0] ?? '').length > 28;
  if (long) {
    const parts = diffWords(s.original, s.replacements[0] ?? '');
    return (
      <>
        <div class="op-diff">
          {parts.map((p, i) => (
            <span
              key={i}
              class={p.type === 'del' ? 'op-del' : p.type === 'ins' ? 'op-ins' : undefined}
            >
              {p.text}
            </span>
          ))}
        </div>
        <div class="op-card__fixes">
          <button
            type="button"
            class="op-fix"
            onClick={async () => {
              await session.accept(s);
              onDone?.();
            }}
          >
            Accept
          </button>
        </div>
      </>
    );
  }
  return (
    <div class="op-card__fixes">
      {s.replacements.slice(0, 4).map((r, i) => (
        <button
          key={r + i}
          type="button"
          class={`op-fix${r === '' ? ' op-fix--remove' : i > 0 ? ' op-fix--alt' : ''}`}
          onClick={async () => {
            await session.accept(s, r);
            onDone?.();
          }}
        >
          {r === '' ? (
            <>
              <Icon name="trash" size={14} />
              Remove “{s.original.trim()}”
            </>
          ) : (
            r
          )}
        </button>
      ))}
    </div>
  );
}

export function MoreActions({ s, onClose }: { s: Suggestion; onClose: () => void }) {
  const isSpelling = /SpellCheck|spelling/i.test(s.rule) && /^[\p{L}'’-]+$/u.test(s.original);
  return (
    <div
      class="op-pop op-menu"
      role="menu"
      style={{ position: 'absolute', right: '0', bottom: '38px', left: 'auto', top: 'auto' }}
    >
      {isSpelling && (
        <button
          type="button"
          role="menuitem"
          class="op-menu__item"
          onClick={() => void addToDictionary(s.original)}
        >
          <Icon name="book" size={16} />
          Add “{s.original}” to dictionary
        </button>
      )}
      {!s.rule.startsWith('ai.') && (
        <button
          type="button"
          role="menuitem"
          class="op-menu__item"
          onClick={() => void disableRule(s)}
        >
          <Icon name="close" size={16} />
          Turn off suggestions like this
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        class="op-menu__item"
        onClick={() => {
          onClose();
          openSidebar('suggestions');
        }}
      >
        <Icon name="sidebar" size={16} />
        See all suggestions
      </button>
    </div>
  );
}

export function Card() {
  frame.value;
  const c = card.value;
  const [more, setMore] = useState(false);
  if (!c) return null;
  const session = sessionById(c.session);
  const s = session?.suggestions.value.find((x) => x.id === c.suggestion);
  if (!session || !s) return null;
  const pos = place(c.anchor, { width: WIDTH, height: s.kind === 'rewrite' ? 250 : 190 });
  const close = () => {
    card.value = null;
    setMore(false);
  };

  return (
    <div
      class="op-pop op-card"
      role="dialog"
      aria-label={s.title}
      data-oppenly-card
      style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
      onMouseDown={(e) => {
        // Keep focus and selection in the page's text field.
        if (!(e.target as HTMLElement).closest('textarea, input, select')) e.preventDefault();
      }}
    >
      <div class="op-card__head">
        <span class="op-dot" data-cat={s.category} />
        {CATEGORY_LABEL[s.category]}
      </div>
      <div class="op-card__title">{s.title}</div>
      <Fixes session={session} s={s} onDone={close} />
      <p class="op-card__msg">{s.message}</p>
      <div class="op-card__foot" style={{ position: 'relative' }}>
        <span class="op-source">
          <Icon name={s.source === 'ai' ? 'globe' : 'lock'} size={12} />
          {sourceLabel(s, aiStatus.value.provider)}
        </span>
        <span style={{ display: 'flex', gap: '2px' }}>
          <button
            type="button"
            class="op-link-btn"
            onClick={() => {
              session.dismiss(s.id);
              close();
            }}
          >
            <Icon name="trash" size={14} />
            Dismiss
          </button>
          <button
            type="button"
            class="op-icon"
            aria-label="More actions"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            <Icon name="more" size={16} />
          </button>
        </span>
        {more && <MoreActions s={s} onClose={close} />}
      </div>
    </div>
  );
}
