import { Icon, type IconName } from '@oppenly/ui';
import { type ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';

const CloseMenu = createContext<() => void>(() => undefined);

/** A button that opens a list of actions. Arrow keys move, Escape closes. */
export function Menu({
  label,
  trigger,
  children,
  align = 'right',
  class: className = 'op-icon-btn',
}: {
  label: string;
  trigger: ComponentChildren;
  children: ComponentChildren;
  align?: 'left' | 'right';
  class?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () =>
      Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === 'Tab') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="ox-menu-wrap" ref={root}>
      <button
        ref={button}
        type="button"
        class={className}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div class={`ox-menu ox-menu--${align}`} role="menu" aria-label={label}>
          <CloseMenu.Provider value={() => setOpen(false)}>{children}</CloseMenu.Provider>
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  danger,
  onClick,
  children,
}: {
  icon?: IconName;
  danger?: boolean;
  onClick: () => void;
  children: ComponentChildren;
}) {
  const close = useContext(CloseMenu);
  return (
    <button
      type="button"
      role="menuitem"
      class={`ox-menu__item${danger ? ' ox-menu__item--danger' : ''}`}
      onClick={() => {
        close();
        onClick();
      }}
    >
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <hr class="ox-menu__sep" />;
}
