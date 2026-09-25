import type { TabCommand } from '../shared/messages';
import { getSettings, isActiveOn, onSettingsChanged } from '../shared/settings';
import { closeSidebar, currentSelectionTarget, HOST, openSidebar } from './actions';
import { createAdapter } from './adapters';
import { onDisconnect, onServerMessage, send } from './channel';
import { fieldFor, kindOf, prefersDark } from './fields';
import { Session } from './session';
import {
  activeId,
  aiStatus,
  card,
  frame,
  hovered,
  menuOpen,
  rewriteView,
  selectionBar,
  sessionById,
  sessions,
  settings,
  sidebar,
  theme,
} from './store';
import { contains } from './ui/geometry';
import { hitBoxes } from './ui/Underlines';

const MAX_SESSIONS = 6;

/**
 * Wires the page to Oppenly: attaches to text fields on focus, keeps the overlay positioned,
 * and routes hover, click and selection to the UI.
 */
export class Controller {
  private readonly cleanups: (() => void)[] = [];
  private raf = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private selectionTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly mirrorParent: Node,
    private readonly host: HTMLElement,
  ) {}

  async start() {
    settings.value = await getSettings();
    this.cleanups.push(
      onSettingsChanged((s) => {
        const wasActive = isActiveOn(settings.value, HOST);
        settings.value = s;
        const active = isActiveOn(s, HOST);
        if (!active) this.detachAll();
        else if (!wasActive) this.attachFocused();
        else for (const session of sessions.value) session.schedule(0);
        send({ t: 'status' });
      }),
    );
    this.cleanups.push(
      onServerMessage((m) => {
        if (m.t === 'analysis') sessionById(m.field)?.receive(m);
        if (m.t === 'status') aiStatus.value = m.ai;
      }),
      onDisconnect(() => {
        for (const s of sessions.value) s.resendIfPending();
      }),
    );
    send({ t: 'status' });

    this.listen(document, 'focusin', (e) => this.onFocus(e as FocusEvent), true);
    this.listen(window, 'scroll', () => this.bump(), true);
    this.listen(window, 'resize', () => this.bump());
    this.listen(document, 'mousemove', (e) => this.onMouseMove(e as MouseEvent), { passive: true });
    this.listen(document, 'mousedown', (e) => this.onMouseDown(e as MouseEvent), true);
    this.listen(document, 'click', (e) => this.onClick(e as MouseEvent), true);
    this.listen(document, 'selectionchange', () => this.onSelectionChange());
    this.listen(document, 'keydown', (e) => this.onKey(e as KeyboardEvent), true);

    const onCommand = (raw: unknown, _sender: unknown, reply: (r: unknown) => void) => {
      const cmd = raw as TabCommand;
      if (cmd.t === 'get-host') {
        if (window.top === window) reply({ host: HOST });
        return;
      }
      if (cmd.t === 'open-assistant') {
        this.attachFocused();
        openSidebar(cmd.tab ?? 'suggestions');
      }
      if (cmd.t === 'rewrite-selection') {
        this.attachFocused();
        openSidebar('rewrite');
      }
    };
    browser.runtime.onMessage.addListener(onCommand);
    this.cleanups.push(() => browser.runtime.onMessage.removeListener(onCommand));

    this.attachFocused();
  }

  private listen(
    target: EventTarget,
    type: string,
    fn: EventListener,
    options?: boolean | AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn, options);
    this.cleanups.push(() => target.removeEventListener(type, fn, options));
  }

  private bump() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      frame.value++;
      if (card.value && !card.value.pinned) card.value = null;
      if (selectionBar.value) selectionBar.value = null;
    });
  }

  private attachFocused() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) this.attach(el);
  }

  private onFocus(e: FocusEvent) {
    const target = e.composedPath()[0] ?? e.target;
    if (target instanceof Node && this.host.contains(target)) return;
    this.attach(target as EventTarget);
  }

  private attach(target: EventTarget | null) {
    if (!isActiveOn(settings.value, HOST)) return;
    const el = fieldFor(target);
    if (!el) {
      if (target instanceof HTMLElement && !this.host.contains(target) && !kindOf(target)) {
        // Focus moved elsewhere on the page: hide the button but keep underlines.
        if (!sidebar.value.open) activeId.value = null;
      }
      return;
    }
    let session = sessions.value.find((s) => s.element === el);
    if (!session) {
      const kind = kindOf(el);
      if (!kind) return;
      session = new Session(createAdapter(el, kind, this.mirrorParent), HOST);
      const next = [...sessions.value.filter((s) => s.element.isConnected), session];
      while (next.length > MAX_SESSIONS) next.shift()?.destroy();
      sessions.value = next;
    }
    activeId.value = session.id;
    theme.value = prefersDark(el) ? 'dark' : 'light';
    this.host.setAttribute('data-theme', theme.value);
    frame.value++;
  }

  private detachAll() {
    for (const s of sessions.value) s.destroy();
    sessions.value = [];
    activeId.value = null;
    card.value = null;
    selectionBar.value = null;
    rewriteView.value = null;
    closeSidebar();
  }

  private hit(x: number, y: number) {
    for (const b of hitBoxes) if (contains(b.rect, x, y, 2)) return b;
    return null;
  }

  private inCard(e: MouseEvent): boolean {
    return e
      .composedPath()
      .some((n) => n instanceof HTMLElement && n.hasAttribute('data-oppenly-card'));
  }

  private onMouseMove(e: MouseEvent) {
    if (this.inCard(e)) {
      clearTimeout(this.closeTimer);
      return;
    }
    const box = this.hit(e.clientX, e.clientY);
    const id = box?.suggestion ?? null;
    if (hovered.value !== id && !sidebar.value.open) hovered.value = id;
    clearTimeout(this.hoverTimer);
    if (box) {
      clearTimeout(this.closeTimer);
      if (card.value?.suggestion === box.suggestion) return;
      this.hoverTimer = setTimeout(() => {
        card.value = {
          session: box.session,
          suggestion: box.suggestion,
          anchor: box.rect,
          pinned: false,
        };
        menuOpen.value = false;
      }, 220);
    } else if (card.value && !card.value.pinned) {
      this.closeTimer = setTimeout(() => {
        if (card.value && !card.value.pinned) card.value = null;
      }, 320);
    }
  }

  private onMouseDown(e: MouseEvent) {
    const path = e.composedPath();
    if (path.includes(this.host)) return;
    menuOpen.value = false;
    if (rewriteView.value && rewriteView.value.status !== 'running') rewriteView.value = null;
    if (card.value && !this.hit(e.clientX, e.clientY)) card.value = null;
  }

  private onClick(e: MouseEvent) {
    if (e.composedPath().includes(this.host)) return;
    const box = this.hit(e.clientX, e.clientY);
    if (box)
      card.value = {
        session: box.session,
        suggestion: box.suggestion,
        anchor: box.rect,
        pinned: true,
      };
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (card.value || menuOpen.value || rewriteView.value || selectionBar.value) {
        card.value = null;
        menuOpen.value = false;
        selectionBar.value = null;
        rewriteView.value = null;
        return;
      }
      if (sidebar.value.open && e.composedPath().includes(this.host)) closeSidebar();
      return;
    }
    // Typing closes transient UI.
    if (!e.composedPath().includes(this.host) && e.key.length === 1) {
      if (card.value) card.value = null;
      if (selectionBar.value) selectionBar.value = null;
    }
  }

  private onSelectionChange() {
    clearTimeout(this.selectionTimer);
    this.selectionTimer = setTimeout(() => {
      const target = currentSelectionTarget();
      const session = target ? sessionById(target.session) : undefined;
      const sel = session?.adapter.selection();
      if (!session || !sel || !target) {
        selectionBar.value = null;
        return;
      }
      const text = session.adapter.getText().slice(sel.start, sel.end);
      if (text.trim().split(/\s+/).length < 2 || text.length < 8) {
        selectionBar.value = null;
        return;
      }
      const rects = session.adapter.rects(sel.start, sel.end);
      const first = rects[0];
      if (!first) return;
      selectionBar.value = { session: session.id, start: sel.start, end: sel.end, anchor: first };
    }, 280);
  }

  stop() {
    for (const c of this.cleanups) c();
    this.detachAll();
  }
}
