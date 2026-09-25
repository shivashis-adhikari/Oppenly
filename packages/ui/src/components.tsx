import type { Category } from '@oppenly/engine';
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon, type IconName } from './icons';

export const CATEGORY_LABEL: Record<Category, string> = {
  correctness: 'Correctness',
  clarity: 'Clarity',
  engagement: 'Engagement',
  delivery: 'Delivery',
};

export const CATEGORY_HINT: Record<Category, string> = {
  correctness: 'Spelling, grammar and punctuation',
  clarity: 'Concise, easy-to-follow writing',
  engagement: 'Vivid, varied word choice',
  delivery: 'Tone, confidence and inclusive language',
};

type ButtonProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  disabled?: boolean;
  type?: 'button' | 'submit';
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  class: cls,
  type = 'button',
  ...rest
}: ButtonProps) {
  const sizeClass = size === 'md' ? '' : ` op-btn--${size}`;
  return (
    <button
      type={type}
      class={`op-btn op-btn--${variant}${sizeClass}${cls ? ` ${cls}` : ''}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  pressed,
  size = 18,
  ...rest
}: JSX.HTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  pressed?: boolean;
  size?: number;
}) {
  return (
    <button
      type="button"
      class="op-icon-btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      class="op-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <fieldset class="op-segmented" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      class="op-select"
      value={value}
      onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clicking outside closes; Escape and the Close button do the same
    <div
      class="op-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        class="op-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        style={width ? { width: `min(${width}px, 100%)` } : undefined}
      >
        <div class="op-modal__head">
          <h2>{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <div class="op-modal__body">{children}</div>
        {footer && <div class="op-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Circular score indicator, 0–100. */
export function ScoreRing({ score, size = 44 }: { score: number | null; size?: number }) {
  const stroke = size >= 56 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const color =
    score === null
      ? 'var(--op-ink-4)'
      : value >= 85
        ? 'var(--op-engagement)'
        : value >= 65
          ? 'var(--op-blue)'
          : 'var(--op-delivery)';
  return (
    <div
      class="op-score"
      style={{ width: `${size}px`, height: `${size}px` }}
      role="img"
      aria-label={score === null ? 'Score not available yet' : `Overall score ${score} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--op-line)"
          stroke-width={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          stroke-width={stroke}
          stroke-linecap="round"
          stroke-dasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 400ms var(--op-ease)' }}
        />
      </svg>
      <span style={{ fontSize: `${Math.round(size * 0.32)}px` }}>{score ?? '–'}</span>
    </div>
  );
}
