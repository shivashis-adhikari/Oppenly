import { aiCompose } from '@oppenly/engine/ai';
import { diffWords, Icon } from '@oppenly/ui';
import { useState } from 'preact/hooks';
import type { DocSession } from '../editor/session';
import { ai, aiStatus } from '../lib/ai';
import { rewriteModes, type Source } from '../lib/rewrite';
import { go } from '../lib/router';
import { settings } from '../lib/settings';
import {
  applyRewrite,
  closeRewrite,
  retryRewrite,
  rewriteView,
  startRewrite,
} from './rewrite-state';

export const SOURCE_LABEL: Record<Source, string> = {
  local: 'Rewritten on this device',
  device: 'Rewritten by on-device AI',
  ai: 'Rewritten by AI',
};

/** The text a rewrite applies to: the selection, or else the paragraph at the cursor. */
function target(session: DocSession): { from: number; to: number; label: string } | null {
  const sel = session.selection.value;
  if (sel) {
    const words = sel.text.trim().split(/\s+/).length;
    return {
      from: sel.from,
      to: sel.to,
      label: `Selected text · ${words} ${words === 1 ? 'word' : 'words'}`,
    };
  }
  const { $from } = session.view.state.selection;
  const block = $from.parent;
  if (!block.isTextblock || !block.textContent.trim()) return null;
  return { from: $from.start(), to: $from.end(), label: 'The paragraph at your cursor' };
}

export function RewriteTab({ session }: { session: DocSession }) {
  session.tick.value;
  const view = rewriteView.value?.where === 'panel' ? rewriteView.value : null;
  const [custom, setCustom] = useState('');
  const t = target(session);
  const ready = aiStatus.value.ready;

  const run = (mode: string, label: string, instruction?: string) => {
    if (!t) return;
    const rect = session.view.coordsAtPos(t.from);
    startRewrite(session, {
      where: 'panel',
      from: t.from,
      to: t.to,
      mode,
      label,
      custom: instruction,
      anchor: { x: rect.left, y: rect.top, height: rect.bottom - rect.top },
    });
  };

  if (view) return <Result session={session} />;

  return (
    <div class="ox-rewrite">
      <section class="ox-block">
        <div class="ox-block__head">
          <h3>Rewrite</h3>
          <span class="ox-quiet">
            {t ? t.label : 'Select text or place your cursor in a paragraph.'}
          </span>
        </div>
        <div class="ox-chips">
          {rewriteModes().map((m) => (
            <button
              key={m.mode}
              type="button"
              class="ox-chip"
              disabled={!t}
              onClick={() => run(m.mode, m.label)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {ready && (
          <form
            class="ox-ask"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom.trim()) run('custom', custom.trim(), custom.trim());
            }}
          >
            <input
              class="op-input"
              value={custom}
              placeholder="Describe a change, e.g. “make it warmer”"
              aria-label="Custom rewrite instruction"
              onInput={(e) => setCustom((e.currentTarget as HTMLInputElement).value)}
            />
            <button type="submit" class="op-btn op-btn--primary" disabled={!t || !custom.trim()}>
              Rewrite
            </button>
          </form>
        )}
      </section>

      {ready ? <Compose session={session} /> : <AiNote />}
    </div>
  );
}

function Result({ session }: { session: DocSession }) {
  const view = rewriteView.value!;
  const done = view.status === 'done';
  return (
    <div class="ox-rewrite">
      <div class="ox-block">
        <div class="ox-block__head ox-block__head--row">
          <button type="button" class="op-icon-btn" aria-label="Back" onClick={closeRewrite}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <h3>{view.label}</h3>
        </div>
        <RewriteBody />
        <div class="ox-actions">
          <button
            type="button"
            class="op-btn op-btn--primary"
            disabled={!done || !view.text.trim() || view.text.trim() === view.original.trim()}
            onClick={() => applyRewrite(session, 'replace')}
          >
            Replace
          </button>
          <button
            type="button"
            class="op-btn op-btn--secondary"
            disabled={!done || !view.text.trim()}
            onClick={() => applyRewrite(session, 'insert')}
          >
            Insert below
          </button>
          <span class="ox-grow" />
          <CopyButton text={view.text} disabled={!done} />
          <button
            type="button"
            class="op-icon-btn"
            aria-label="Try again"
            title="Try again"
            disabled={view.status === 'running'}
            onClick={() => retryRewrite(session)}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** The streamed result with changes marked, or an error. Shared with the popover. */
export function RewriteBody() {
  const view = rewriteView.value!;
  if (view.status === 'error') return <p class="ox-error">{view.error}</p>;
  const showDiff = view.status === 'done' && view.text.length < 1200;
  return (
    <>
      <div class="ox-result" aria-live="polite" aria-busy={view.status === 'running'}>
        {showDiff
          ? diffWords(view.original, view.text).map((p, i) =>
              p.type === 'del' ? null : (
                <span key={i} class={p.type === 'ins' ? 'ox-mark' : undefined}>
                  {p.text}
                </span>
              ),
            )
          : view.text}
        {view.status === 'running' && <span class="ox-caret" />}
      </div>
      {view.error && <p class="ox-quiet">{view.error}</p>}
      {view.source && (
        <span class="ox-source">
          <Icon name={view.source === 'ai' ? 'globe' : 'lock'} size={12} />
          {view.source === 'ai' && aiStatus.value.provider
            ? `Rewritten by ${aiStatus.value.provider}`
            : SOURCE_LABEL[view.source]}
        </span>
      )}
    </>
  );
}

export function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class="op-icon-btn"
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied' : 'Copy'}
      disabled={disabled}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
    </button>
  );
}

function Compose({ session }: { session: DocSession }) {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    text: string;
  }>({ status: 'idle', text: '' });
  const [controller, setController] = useState<AbortController | null>(null);

  const generate = async () => {
    const config = await ai.config(settings.value.ai.provider);
    if (!config || !prompt.trim()) return;
    controller?.abort();
    const c = new AbortController();
    setController(c);
    setState({ status: 'running', text: '' });
    try {
      const text = await aiCompose(
        {
          config,
          goals: session.record.value.goals,
          dialect: settings.value.dialect,
          signal: c.signal,
        },
        prompt.trim(),
        session.text.slice(0, 4000),
        (t) => setState({ status: 'running', text: t }),
      );
      setState({ status: 'done', text });
    } catch (err) {
      if ((err as Error).name !== 'AbortError')
        setState({ status: 'error', text: (err as Error).message });
    }
  };

  const insert = () => {
    const { to } = session.view.state.selection;
    session.insertAfter(to, state.text);
    setState({ status: 'idle', text: '' });
    setPrompt('');
  };

  return (
    <section class="ox-block">
      <div class="ox-block__head">
        <h3>Write something new</h3>
        <span class="ox-quiet">
          Uses your document as context. The result goes below your cursor.
        </span>
      </div>
      <textarea
        class="op-textarea"
        rows={3}
        value={prompt}
        placeholder="e.g. “A two-sentence summary for my manager”"
        aria-label="What to write"
        onInput={(e) => setPrompt((e.currentTarget as HTMLTextAreaElement).value)}
      />
      <div class="ox-actions">
        <button
          type="button"
          class="op-btn op-btn--primary"
          disabled={!prompt.trim() || state.status === 'running'}
          onClick={() => void generate()}
        >
          {state.status === 'running' ? 'Writing…' : 'Write'}
        </button>
      </div>
      {state.status !== 'idle' && (
        <>
          {state.status === 'error' ? (
            <p class="ox-error">{state.text}</p>
          ) : (
            <div class="ox-result">
              {state.text}
              {state.status === 'running' && <span class="ox-caret" />}
            </div>
          )}
          {state.status === 'done' && (
            <div class="ox-actions">
              <button type="button" class="op-btn op-btn--primary" onClick={insert}>
                Insert
              </button>
              <CopyButton text={state.text} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AiNote() {
  return (
    <section class="ox-note">
      <Icon name="lock" size={16} />
      <div>
        <strong>These rewrites run on this computer.</strong>
        <p>
          Add an AI provider for more: improve, expand, persuasive tone, your own instructions, and
          writing from a prompt.
        </p>
        <button
          type="button"
          class="op-btn op-btn--secondary op-btn--sm"
          onClick={() => go({ name: 'settings', section: 'ai' })}
        >
          Set up AI
        </button>
      </div>
    </section>
  );
}
