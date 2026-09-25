import { signal } from '@preact/signals';
import type { AiStatus } from '../shared/messages';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import type { Rect } from './adapters';
import type { Session } from './session';

export type SidebarTab = 'suggestions' | 'rewrite' | 'insights';

/** UI state for the in-page layer. Everything here is local to this frame. */
export const sessions = signal<Session[]>([]);
export const activeId = signal<string | null>(null);
/** Bumped on scroll, resize and text changes so positioned UI re-measures. */
export const frame = signal(0);
export const card = signal<{
  session: string;
  suggestion: string;
  anchor: Rect;
  pinned: boolean;
} | null>(null);
export const hovered = signal<string | null>(null);
export const sidebar = signal<{ open: boolean; tab: SidebarTab }>({
  open: false,
  tab: 'suggestions',
});
export const selectionBar = signal<{
  session: string;
  start: number;
  end: number;
  anchor: Rect;
} | null>(null);
export const rewriteView = signal<{
  session: string;
  start: number;
  end: number;
  anchor: Rect;
  mode: string;
  label: string;
  custom: string;
  text: string;
  status: 'running' | 'done' | 'error';
  source?: 'local' | 'device' | 'ai';
  error?: string;
} | null>(null);
export const toast = signal<{ text: string; action?: { label: string; run: () => void } } | null>(
  null,
);
export const settings = signal<Settings>(DEFAULT_SETTINGS);
export const aiStatus = signal<AiStatus>({ ready: false, provider: null, local: true });
export const theme = signal<'light' | 'dark'>('light');
export const menuOpen = signal(false);

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(text: string, action?: { label: string; run: () => void }) {
  clearTimeout(toastTimer);
  toast.value = { text, action };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 4200);
}

export function activeSession(): Session | undefined {
  return sessions.value.find((s) => s.id === activeId.value);
}

export function sessionById(id: string): Session | undefined {
  return sessions.value.find((s) => s.id === id);
}
