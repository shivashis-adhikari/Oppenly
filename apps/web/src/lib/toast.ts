import { signal } from '@preact/signals';

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export const toasts = signal<Toast[]>([]);
let next = 1;

/** Shows a short message at the bottom of the screen, optionally with one action (e.g. Undo). */
export function toast(text: string, action?: Toast['action'], ms = 5000): void {
  const id = next++;
  toasts.value = [...toasts.value.slice(-2), { id, text, action }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, ms);
}

export function closeToast(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}
