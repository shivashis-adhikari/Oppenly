import type { Analysis, Category, Suggestion } from '@oppenly/engine';
import { signal } from '@preact/signals';
import type { AiState, ServerMessage } from '../shared/messages';
import type { FieldAdapter } from './adapters';
import { send } from './channel';
import { remap } from './remap';
import { frame, showToast } from './store';

const CHECK_DELAY_MS = 380;

let counter = 0;

/** One text field Oppenly is watching: its text, analysis and the suggestions on screen. */
export class Session {
  readonly id = `f${++counter}-${Math.random().toString(36).slice(2, 7)}`;
  readonly analysis = signal<Analysis | null>(null);
  /** Suggestions aligned with the field's current text. */
  readonly suggestions = signal<Suggestion[]>([]);
  readonly checking = signal(false);
  readonly ai = signal<AiState>('off');
  readonly aiError = signal<string | undefined>(undefined);

  private rev = 0;
  private baseText = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private composing = false;
  private readonly dismissed = new Set<string>();
  private readonly observer: MutationObserver | null = null;
  private readonly listeners: [string, EventListener][] = [];

  constructor(
    readonly adapter: FieldAdapter,
    private readonly host: string,
  ) {
    const el = adapter.el;
    const on = (type: string, fn: EventListener) => {
      el.addEventListener(type, fn);
      this.listeners.push([type, fn]);
    };
    on('input', () => this.onEdit());
    on('compositionstart', () => {
      this.composing = true;
    });
    on('compositionend', () => {
      this.composing = false;
      this.onEdit();
    });
    on('scroll', () => {
      frame.value++;
    });
    if (adapter.kind === 'contenteditable') {
      // Some editors change content without firing input events (undo, paste handlers, sync).
      this.observer = new MutationObserver(() => this.onEdit());
      this.observer.observe(el, { characterData: true, childList: true, subtree: true });
    }
    this.schedule(0);
  }

  get element(): HTMLElement {
    return this.adapter.el;
  }

  private onEdit() {
    const text = this.adapter.getText();
    if (text === this.baseText && !this.checking.value) return;
    this.suggestions.value = remap(this.suggestions.value, this.baseText, text);
    this.baseText = text;
    frame.value++;
    if (!this.composing) this.schedule(CHECK_DELAY_MS);
  }

  schedule(delay = CHECK_DELAY_MS) {
    clearTimeout(this.timer);
    this.checking.value = true;
    this.timer = setTimeout(() => this.request(), delay);
  }

  private request() {
    const text = this.adapter.getText();
    this.rev++;
    if (!text.trim()) {
      this.analysis.value = null;
      this.suggestions.value = [];
      this.baseText = text;
      this.checking.value = false;
      frame.value++;
      return;
    }
    send({ t: 'analyze', field: this.id, rev: this.rev, text, host: this.host });
  }

  /** The background was restarted; ask again if we were waiting. */
  resendIfPending() {
    if (this.checking.value) this.schedule(0);
  }

  receive(msg: Extract<ServerMessage, { t: 'analysis' }>) {
    if (msg.rev !== this.rev) return;
    const current = this.adapter.getText();
    const visible = msg.analysis.suggestions.filter((s) => !this.dismissed.has(s.id));
    this.analysis.value = msg.analysis;
    this.suggestions.value = remap(visible, msg.analysis.text, current);
    this.baseText = current;
    this.ai.value = msg.ai;
    this.aiError.value = msg.aiError;
    this.checking.value = current !== msg.analysis.text;
    frame.value++;
  }

  counts(): Record<Category, number> {
    const c: Record<Category, number> = { correctness: 0, clarity: 0, engagement: 0, delivery: 0 };
    for (const s of this.suggestions.value) c[s.category]++;
    return c;
  }

  dismiss(id: string) {
    this.dismissed.add(id);
    this.suggestions.value = this.suggestions.value.filter((s) => s.id !== id);
    frame.value++;
  }

  /** Apply a fix. Returns false (and tells the user) if the page would not accept the change. */
  async accept(s: Suggestion, replacement = s.replacements[0] ?? ''): Promise<boolean> {
    const before = this.adapter.getText();
    if (before.slice(s.start, s.end) !== s.original) {
      this.schedule(0);
      return false;
    }
    const ok = await this.adapter.replace(s.start, s.end, replacement);
    const after = this.adapter.getText();
    if (!ok) {
      showToast('This page did not accept the change.', {
        label: 'Copy fix',
        run: () => void navigator.clipboard?.writeText(replacement),
      });
      this.schedule(0);
      return false;
    }
    this.dismissed.add(s.id);
    this.suggestions.value = remap(
      this.suggestions.value.filter((x) => x.id !== s.id),
      before,
      after,
    );
    this.baseText = after;
    frame.value++;
    this.schedule(200);
    return true;
  }

  /** Apply every suggestion in `list`, last first so earlier offsets stay valid. */
  async acceptAll(list: Suggestion[]): Promise<number> {
    const ordered = [...list]
      .filter((s) => s.kind !== 'info' && s.replacements.length > 0)
      .sort((a, b) => b.start - a.start);
    let applied = 0;
    let limit = Number.POSITIVE_INFINITY;
    for (const s of ordered) {
      if (s.end > limit) continue;
      const current = this.suggestions.value.find((x) => x.id === s.id);
      if (!current) continue;
      if (await this.accept(current)) {
        applied++;
        limit = current.start;
      }
    }
    return applied;
  }

  destroy() {
    clearTimeout(this.timer);
    this.observer?.disconnect();
    for (const [type, fn] of this.listeners) this.adapter.el.removeEventListener(type, fn);
    this.adapter.destroy();
  }
}
