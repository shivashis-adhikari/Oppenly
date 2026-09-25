import type { Suggestion } from '@oppenly/engine';
import type { RewriteRequestMode, ServerMessage } from '../shared/messages';
import { updateSettings } from '../shared/settings';
import type { Rect } from './adapters';
import { onServerMessage, send } from './channel';
import {
  activeSession,
  card,
  menuOpen,
  rewriteView,
  type SidebarTab,
  selectionBar,
  sessionById,
  showToast,
  sidebar,
} from './store';

export const HOST = location.hostname;

export function openSidebar(tab: SidebarTab = 'suggestions') {
  card.value = null;
  menuOpen.value = false;
  sidebar.value = { open: true, tab };
}

export function closeSidebar() {
  sidebar.value = { ...sidebar.value, open: false };
}

export async function turnOffSite() {
  menuOpen.value = false;
  await updateSettings((s) => ({ disabledSites: [...new Set([...s.disabledSites, HOST])] }));
  showToast(`Oppenly is off on ${HOST}.`, {
    label: 'Undo',
    run: () =>
      void updateSettings((s) => ({ disabledSites: s.disabledSites.filter((h) => h !== HOST) })),
  });
}

export async function pause(minutes: number) {
  menuOpen.value = false;
  await updateSettings({ pausedUntil: Date.now() + minutes * 60_000 });
  showToast(`Paused for ${minutes === 60 ? 'an hour' : `${minutes} minutes`}.`, {
    label: 'Resume',
    run: () => void updateSettings({ pausedUntil: 0 }),
  });
}

export async function turnOffEverywhere() {
  menuOpen.value = false;
  await updateSettings({ enabled: false });
  showToast('Oppenly is off everywhere.', {
    label: 'Undo',
    run: () => void updateSettings({ enabled: true }),
  });
}

export async function addToDictionary(word: string) {
  card.value = null;
  await updateSettings((s) => ({ dictionary: [...new Set([...s.dictionary, word])] }));
  showToast(`Added “${word}” to your dictionary.`);
}

export async function disableRule(s: Suggestion) {
  card.value = null;
  await updateSettings((cur) => ({ disabledRules: [...new Set([...cur.disabledRules, s.rule])] }));
  showToast('You won’t see suggestions like this again.', {
    label: 'Undo',
    run: () =>
      void updateSettings((cur) => ({
        disabledRules: cur.disabledRules.filter((r) => r !== s.rule),
      })),
  });
}

export function openSettings() {
  menuOpen.value = false;
  void browser.runtime.sendMessage({ t: 'open-options' });
}

/* ---------- Rewrites ---------- */

let seq = 0;
const pending = new Map<string, (m: ServerMessage) => void>();

onServerMessage((m) => {
  if (m.t === 'rewrite-progress' || m.t === 'rewrite-done' || m.t === 'rewrite-error')
    pending.get(m.req)?.(m);
});

/** Rewrite [start, end) of a session's text. Streams progress into `rewriteView`. */
export function startRewrite(
  sessionId: string,
  start: number,
  end: number,
  mode: RewriteRequestMode,
  label: string,
  anchor: Rect,
  custom = '',
) {
  const session = sessionById(sessionId);
  if (!session) return;
  const text = session.adapter.getText().slice(start, end);
  if (!text.trim()) return;
  cancelRewrite();
  const req = `r${++seq}`;
  selectionBar.value = null;
  // Open below the whole selection, not just its first line.
  const rects = session.adapter.rects(start, end);
  const first = rects[0];
  const last = rects[rects.length - 1];
  const around =
    first && last
      ? { x: first.x, y: first.y, width: first.width, height: last.y + last.height - first.y }
      : anchor;
  rewriteView.value = {
    session: sessionId,
    start,
    end,
    anchor: around,
    mode,
    label,
    custom,
    text: '',
    status: 'running',
  };
  pending.set(req, (m) => {
    const view = rewriteView.value;
    if (!view) return;
    if (m.t === 'rewrite-progress') rewriteView.value = { ...view, text: m.text };
    if (m.t === 'rewrite-done') {
      rewriteView.value = { ...view, text: m.text, status: 'done', source: m.source };
      pending.delete(req);
    }
    if (m.t === 'rewrite-error') {
      rewriteView.value = { ...view, status: 'error', error: m.message };
      pending.delete(req);
    }
  });
  currentReq = req;
  send({ t: 'rewrite', req, text, mode, custom, host: HOST });
}

let currentReq: string | null = null;

export function cancelRewrite() {
  if (currentReq && pending.has(currentReq)) send({ t: 'cancel', req: currentReq });
  if (currentReq) pending.delete(currentReq);
  currentReq = null;
}

export async function applyRewrite(mode: 'replace' | 'insert') {
  const view = rewriteView.value;
  if (view?.status !== 'done') return;
  const session = sessionById(view.session);
  if (!session) return;
  const current = session.adapter.getText();
  const original = current.slice(view.start, view.end);
  const result = view.text.trim();
  const ok =
    mode === 'replace'
      ? await session.adapter.replace(view.start, view.end, result)
      : await session.adapter.replace(
          view.end,
          view.end,
          `${original.endsWith('\n') ? '' : '\n\n'}${result}`,
        );
  rewriteView.value = null;
  if (!ok) {
    showToast('This page did not accept the change.', {
      label: 'Copy text',
      run: () => void navigator.clipboard?.writeText(result),
    });
    return;
  }
  session.schedule(150);
}

export function currentSelectionTarget(): { session: string; start: number; end: number } | null {
  const session = activeSession();
  if (!session) return null;
  const sel = session.adapter.selection();
  if (sel) return { session: session.id, ...sel };
  const text = session.adapter.getText();
  return text.trim() ? { session: session.id, start: 0, end: text.length } : null;
}
