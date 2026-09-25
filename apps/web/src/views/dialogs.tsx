import type { Goals } from '@oppenly/engine';
import { formatDuration, readabilityLabel, readingLevel } from '@oppenly/engine/labels';
import { DEFAULT_GOALS } from '@oppenly/engine/types';
import { Modal, ScoreRing } from '@oppenly/ui';
import { GOAL_OPTIONS } from '@oppenly/ui/settings-model';
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { safeHref, schema } from '../editor/schema';
import type { DocSession } from '../editor/session';
import { settings, updateSettings } from '../lib/settings';
import { scoreText } from '../panel/InsightsTab';

export type Dialog =
  | { kind: 'goals' }
  | { kind: 'performance' }
  | { kind: 'link' }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirm: string;
      danger?: boolean;
      resolve: (ok: boolean) => void;
    };

export const dialog = signal<Dialog | null>(null);

export function openDialog(d: Dialog): void {
  dialog.value = d;
}

export function closeDialog(): void {
  const d = dialog.value;
  if (d?.kind === 'confirm') d.resolve(false);
  dialog.value = null;
}

/** Asks a yes/no question. Resolves true when the user confirms. */
export function confirmDialog(opts: {
  title: string;
  message: string;
  confirm: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.value = { kind: 'confirm', ...opts, resolve };
  });
}

/** Renders whichever dialog is open. `session` is the open document, if any. */
export function Dialogs({ session }: { session: DocSession | null }) {
  const d = dialog.value;
  if (!d) return null;
  if (d.kind === 'confirm') return <ConfirmDialog d={d} />;
  if (!session) return null;
  if (d.kind === 'goals') return <GoalsDialog session={session} />;
  if (d.kind === 'performance') return <PerformanceDialog session={session} />;
  return <LinkDialog session={session} />;
}

function ConfirmDialog({ d }: { d: Extract<Dialog, { kind: 'confirm' }> }) {
  const finish = (ok: boolean) => {
    dialog.value = null;
    d.resolve(ok);
  };
  return (
    <Modal title={d.title} onClose={() => finish(false)} width={440}>
      <p class="ox-dialog-text">{d.message}</p>
      <div class="op-modal__foot">
        <button type="button" class="op-btn op-btn--secondary" onClick={() => finish(false)}>
          Cancel
        </button>
        <button
          type="button"
          class={`op-btn ${d.danger ? 'op-btn--danger-solid' : 'op-btn--primary'}`}
          onClick={() => finish(true)}
        >
          {d.confirm}
        </button>
      </div>
    </Modal>
  );
}

function GoalsDialog({ session }: { session: DocSession }) {
  const [goals, setGoals] = useState<Goals>(session.record.value.goals);
  const done = () => {
    session.setGoals(goals);
    dialog.value = null;
  };
  return (
    <Modal title="Set goals" onClose={done} width={640}>
      <p class="ox-dialog-text">
        Tell Oppenly about this document and it will tailor suggestions to your audience and
        purpose.
      </p>
      <div class="ox-goals">
        {GOAL_OPTIONS.map((g) => {
          const current = g.options.find((o) => o.value === goals[g.key]);
          return (
            <fieldset key={g.key} class="ox-goal">
              <legend>{g.label}</legend>
              <div class="ox-goal__options">
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    class="ox-goal__opt"
                    aria-pressed={goals[g.key] === o.value}
                    onClick={() => setGoals({ ...goals, [g.key]: o.value })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p class="ox-goal__hint">{current?.hint ?? g.hint}</p>
            </fieldset>
          );
        })}
      </div>
      <div class="op-modal__foot ox-goals__foot">
        <label class="ox-check">
          <input
            type="checkbox"
            checked={settings.value.goalsOnNew}
            onChange={(e) =>
              void updateSettings({ goalsOnNew: (e.currentTarget as HTMLInputElement).checked })
            }
          />
          Show this when I start a new document
        </label>
        <span class="ox-grow" />
        <button type="button" class="op-btn op-btn--ghost" onClick={() => setGoals(DEFAULT_GOALS)}>
          Reset to defaults
        </button>
        <button type="button" class="op-btn op-btn--primary" onClick={done}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function PerformanceDialog({ session }: { session: DocSession }) {
  const analysis = session.analysis.value;
  if (!analysis) return null;
  const { stats, score } = analysis;
  const enough = stats.words >= 30;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <Modal title="Performance" onClose={() => (dialog.value = null)} width={600}>
      <div class="ox-perf">
        <section class="ox-perf__score">
          <ScoreRing score={score} size={72} />
          <div>
            <h3>Overall score {score ?? '–'}</h3>
            <p>
              {scoreText(score)} The score reflects the suggestions in this document, weighted by
              category and length.
            </p>
          </div>
        </section>

        <section>
          <h4>Word count</h4>
          <dl class="ox-grid-stats">
            <Stat label="Characters" value={stats.characters.toLocaleString()} />
            <Stat label="Words" value={stats.words.toLocaleString()} />
            <Stat label="Sentences" value={stats.sentences.toLocaleString()} />
            <Stat label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
            <Stat label="Reading time" value={formatDuration(stats.readingTime)} />
            <Stat label="Speaking time" value={formatDuration(stats.speakingTime)} />
          </dl>
        </section>

        <section>
          <h4>Readability</h4>
          <dl class="ox-grid-stats">
            <Stat
              label="Word length"
              value={stats.averageWordLength.toFixed(1)}
              hint="letters on average"
            />
            <Stat
              label="Sentence length"
              value={stats.averageSentenceLength.toFixed(1)}
              hint="words on average"
            />
            <Stat
              label="Readability score"
              value={enough ? String(Math.round(stats.readability)) : '–'}
              hint={enough ? readabilityLabel(stats.readability) : 'Needs 30 words'}
            />
          </dl>
          {enough && (
            <p class="ox-perf__note">
              Likely to be understood by {readingLevel(stats.readability)}. Based on the Flesch
              reading-ease test: shorter words and sentences score higher.
            </p>
          )}
        </section>

        <section>
          <h4>Vocabulary</h4>
          <dl class="ox-grid-stats">
            <Stat
              label="Unique words"
              value={enough ? pct(stats.uniqueWords) : '–'}
              hint="Distinct words, a measure of variety"
            />
            <Stat
              label="Rare words"
              value={enough ? pct(stats.rareWords) : '–'}
              hint="Words outside everyday English"
            />
          </dl>
        </section>
      </div>
    </Modal>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div class="ox-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {hint && <span>{hint}</span>}
    </div>
  );
}

function LinkDialog({ session }: { session: DocSession }) {
  const state = session.view.state;
  const { from, to, empty } = state.selection;
  const linkType = schema.marks.link;
  let existing = '';
  state.doc.nodesBetween(from, empty ? from + 1 : to, (node) => {
    const mark = linkType.isInSet(node.marks);
    if (mark) existing = mark.attrs.href as string;
  });
  const [href, setHref] = useState(existing);
  const [error, setError] = useState('');
  const close = () => {
    dialog.value = null;
    session.view.focus();
  };

  const save = (e: Event) => {
    e.preventDefault();
    let url = href.trim();
    if (!url) return;
    if (!/^[a-z]+:/i.test(url)) url = url.includes('@') ? `mailto:${url}` : `https://${url}`;
    if (!safeHref(url)) {
      setError('Use a web address (https://…) or an email address.');
      return;
    }
    const mark = linkType.create({ href: url });
    let tr = session.view.state.tr;
    if (empty) {
      tr = tr.replaceSelectionWith(schema.text(url, [mark]), false);
    } else {
      tr = tr.removeMark(from, to, linkType).addMark(from, to, mark);
    }
    session.view.dispatch(tr);
    close();
  };

  const remove = () => {
    const { from: a, to: b } = session.view.state.selection;
    session.view.dispatch(session.view.state.tr.removeMark(a, b, linkType));
    close();
  };

  return (
    <Modal title={existing ? 'Edit link' : 'Add link'} onClose={close} width={460}>
      <form onSubmit={save} class="ox-link-form">
        <label class="op-label" for="link-url">
          Web address
        </label>
        <input
          id="link-url"
          class="op-input"
          value={href}
          placeholder="https://example.com"
          autoFocus
          spellcheck={false}
          onInput={(e) => {
            setHref((e.currentTarget as HTMLInputElement).value);
            setError('');
          }}
        />
        {error && <p class="ox-error">{error}</p>}
        <div class="op-modal__foot">
          {existing && (
            <button type="button" class="op-btn op-btn--ghost" onClick={remove}>
              Remove link
            </button>
          )}
          <span class="ox-grow" />
          <button type="button" class="op-btn op-btn--secondary" onClick={close}>
            Cancel
          </button>
          <button type="submit" class="op-btn op-btn--primary" disabled={!href.trim()}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
