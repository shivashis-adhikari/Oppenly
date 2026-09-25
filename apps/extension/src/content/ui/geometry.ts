import type { Rect } from '../adapters';

/** The part of an element's content box that is currently on screen, or null if hidden. */
export function visibleBox(el: HTMLElement): Rect | null {
  if (!el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const left = r.left + el.clientLeft;
  const top = r.top + el.clientTop;
  const width = el.clientWidth || r.width;
  const height = el.clientHeight || r.height;
  const x1 = Math.max(left, 0);
  const y1 = Math.max(top, 0);
  const x2 = Math.min(left + width, window.innerWidth);
  const y2 = Math.min(top + height, window.innerHeight);
  if (x2 - x1 < 4 || y2 - y1 < 4) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function contains(r: Rect, x: number, y: number, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad;
}

/**
 * Place a popover of `size` next to `anchor`: below if it fits, otherwise above; always inside
 * the viewport with an 8px margin.
 */
export function place(
  anchor: Rect,
  size: { width: number; height: number },
  gap = 8,
): { left: number; top: number } {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = anchor.y + anchor.height + gap;
  if (top + size.height > vh - margin && anchor.y - gap - size.height > margin)
    top = anchor.y - gap - size.height;
  top = Math.max(margin, Math.min(top, vh - size.height - margin));
  const left = Math.max(margin, Math.min(anchor.x, vw - size.width - margin));
  return { left, top };
}
