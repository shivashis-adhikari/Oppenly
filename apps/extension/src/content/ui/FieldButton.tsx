import type { Category } from '@oppenly/engine';
import { Icon, Mark } from '@oppenly/ui';
import {
  closeSidebar,
  HOST,
  openSettings,
  openSidebar,
  pause,
  turnOffEverywhere,
  turnOffSite,
} from '../actions';
import { activeSession, frame, menuOpen, settings, sidebar } from '../store';
import { visibleBox } from './geometry';

const ORDER: Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];
const SIZE = 28;

export function FieldButton() {
  frame.value;
  const session = activeSession();
  if (!session || !settings.value.showButton) return null;
  const box = visibleBox(session.element);
  if (!box) return null;

  const suggestions = session.suggestions.value;
  const counts = session.counts();
  const worst = ORDER.find((c) => counts[c] > 0);
  const total = suggestions.length;
  const checking = session.checking.value;

  const single = box.height < 46;
  // Stay clear of a textarea's resize handle in the corner.
  const resizable =
    session.adapter.kind === 'textarea' && getComputedStyle(session.element).resize !== 'none';
  const inset = resizable ? 18 : 8;
  const left = Math.min(box.x + box.width - SIZE - inset, window.innerWidth - SIZE - 12);
  const top = single
    ? box.y + (box.height - SIZE) / 2
    : Math.min(box.y + box.height - SIZE - 8, window.innerHeight - SIZE - 12);
  const label = checking
    ? 'Oppenly is checking your text'
    : total
      ? `Oppenly: ${total} suggestion${total === 1 ? '' : 's'}`
      : 'Oppenly: no suggestions';

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keeps focus in the page's field; both children are buttons */}
      <div
        class="op-fab-wrap"
        style={{ left: `${left - 30}px`, top: `${top}px` }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <button
          type="button"
          class="op-mini"
          aria-label="Turn off or pause Oppenly"
          title="Turn off or pause"
          aria-expanded={menuOpen.value}
          onClick={() => {
            menuOpen.value = !menuOpen.value;
          }}
        >
          <Icon name="power" size={14} />
        </button>
        <button
          type="button"
          class="op-fab"
          data-state={checking ? 'checking' : 'ready'}
          aria-label={label}
          title={label}
          onClick={() => {
            menuOpen.value = false;
            if (sidebar.value.open) closeSidebar();
            else openSidebar('suggestions');
          }}
        >
          <Mark size={18} />
          {total > 0 && !checking && (
            <span class="op-fab__count" data-cat={worst}>
              {total > 99 ? '99+' : total}
            </span>
          )}
          {total === 0 && !checking && session.analysis.value && (
            <span class="op-fab__ok" aria-hidden="true">
              <Icon name="check" size={10} />
            </span>
          )}
        </button>
      </div>
      {menuOpen.value && <PowerMenu left={left} top={top} />}
    </>
  );
}

function PowerMenu({ left, top }: { left: number; top: number }) {
  const width = 236;
  const height = 188;
  const x = Math.max(8, Math.min(left + SIZE - width, window.innerWidth - width - 8));
  const y = top - height - 8 > 8 ? top - height - 8 : top + SIZE + 8;
  return (
    <div
      class="op-pop op-menu"
      role="menu"
      style={{ left: `${x}px`, top: `${y}px`, width: `${width}px` }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div class="op-menu__title">Oppenly on {HOST}</div>
      <button type="button" role="menuitem" class="op-menu__item" onClick={() => void pause(60)}>
        <Icon name="pause" size={16} />
        Pause for 1 hour
      </button>
      <button
        type="button"
        role="menuitem"
        class="op-menu__item"
        onClick={() => void turnOffSite()}
      >
        <Icon name="globe" size={16} />
        Turn off on this site
      </button>
      <button
        type="button"
        role="menuitem"
        class="op-menu__item"
        onClick={() => void turnOffEverywhere()}
      >
        <Icon name="power" size={16} />
        Turn off everywhere
      </button>
      <button type="button" role="menuitem" class="op-menu__item" onClick={openSettings}>
        <Icon name="gear" size={16} />
        Settings
      </button>
    </div>
  );
}
