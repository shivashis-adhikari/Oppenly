import { aiInsight, INSIGHT_INSTRUCTIONS, type InsightMode } from '@oppenly/engine/ai';
import { formatDuration, readabilityLabel } from '@oppenly/engine/labels';
import { Icon, ScoreRing } from '@oppenly/ui';
import { GOAL_OPTIONS } from '@oppenly/ui/settings-model';
import { useState } from 'preact/hooks';
import type { DocSession } from '../editor/session';
import { ai, aiStatus } from '../lib/ai';
import { settings } from '../lib/settings';
import { openDialog } from '../views/dialogs';
import { AiNote, CopyButton } from './RewriteTab';

export function scoreText(score: number | null): string {
  if (score === null) return 'Write a little more to get a score.';
  if (score >= 90) return 'Excellent. Your writing is clear, correct and engaging.';
  if (score >= 75) return 'Good. A few suggestions will make it stronger.';
  if (score >= 55) return 'Fair. Work through the suggestions to lift it.';
  return 'Needs work. Start with the correctness suggestions.';
}

export function InsightsTab({ session }: { session: DocSession }) {
  const analysis = session.analysis.value;
  const goals = session.record.value.goals;
  if (!analysis) return <p class="ox-quiet ox-pad">Checking your writing…</p>;
  const { stats, tones, score } = analysis;
  const shownTones = tones.filter((t) => t.id !== 'neutral').slice(0, 4);

  return (
    <div class="ox-insights">
      <section class="ox-block ox-score-block">
        <ScoreRing score={score} size={64} />
        <div>
          <h3>Overall score</h3>
          <p class="ox-quiet">{scoreText(score)}</p>
          <button type="button" class="ox-link" onClick={() => openDialog({ kind: 'performance' })}>
            See performance
          </button>
        </div>
      </section>

      <section class="ox-block">
        <div class="ox-block__head">
          <h3>How it sounds</h3>
          <span class="ox-quiet">Tone detected from word choice and phrasing, on this device.</span>
        </div>
        {stats.words < 12 || shownTones.length === 0 ? (
          <p class="ox-quiet">Write a few sentences to see the tone.</p>
        ) : (
          <ul class="ox-tones">
            {shownTones.map((t) => (
              <li key={t.id}>
                <span>{t.label}</span>
                <span class="ox-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(Math.max(0.08, t.strength) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="ox-block">
        <div class="ox-block__head ox-block__head--row">
          <h3>Goals</h3>
          <button type="button" class="ox-link" onClick={() => openDialog({ kind: 'goals' })}>
            Adjust
          </button>
        </div>
        <dl class="ox-facts">
          {GOAL_OPTIONS.map((g) => (
            <div key={g.key}>
              <dt>{g.label}</dt>
              <dd>{g.options.find((o) => o.value === goals[g.key])?.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section class="ox-block">
        <div class="ox-block__head ox-block__head--row">
          <h3>At a glance</h3>
          <button type="button" class="ox-link" onClick={() => openDialog({ kind: 'performance' })}>
            All stats
          </button>
        </div>
        <dl class="ox-facts">
          <div>
            <dt>Words</dt>
            <dd>{stats.words.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Reading time</dt>
            <dd>{formatDuration(stats.readingTime)}</dd>
          </div>
          <div>
            <dt>Readability</dt>
            <dd>{stats.words >= 30 ? readabilityLabel(stats.readability) : 'Not enough text'}</dd>
          </div>
        </dl>
      </section>

      {aiStatus.value.ready ? <Feedback session={session} /> : <AiNote />}
    </div>
  );
}

const MODES: InsightMode[] = ['reader-reactions', 'gaps', 'summary', 'grade'];

function Feedback({ session }: { session: DocSession }) {
  const [mode, setMode] = useState<InsightMode | null>(null);
  const [extra, setExtra] = useState('');
  const [state, setState] = useState<{ status: 'running' | 'done' | 'error'; text: string } | null>(
    null,
  );

  const run = async (m: InsightMode) => {
    const config = await ai.config(settings.value.ai.provider);
    if (!config) return;
    setState({ status: 'running', text: '' });
    try {
      const text = await aiInsight(
        { config, goals: session.record.value.goals, dialect: settings.value.dialect },
        session.text.slice(0, 12000),
        m,
        extra.trim(),
        (t) => setState({ status: 'running', text: t }),
      );
      setState({ status: 'done', text });
    } catch (err) {
      setState({ status: 'error', text: (err as Error).message });
    }
  };

  const needsInput = mode === 'reader-reactions' || mode === 'grade';
  return (
    <section class="ox-block">
      <div class="ox-block__head">
        <h3>Feedback</h3>
        <span class="ox-quiet">Sent to {aiStatus.value.provider} when you choose an option.</span>
      </div>
      <div class="ox-chips">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            class="ox-chip"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setState(null);
              if (m !== 'reader-reactions' && m !== 'grade') void run(m);
            }}
          >
            {INSIGHT_INSTRUCTIONS[m].label}
          </button>
        ))}
      </div>
      {mode && needsInput && (
        <form
          class="ox-ask ox-ask--stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(mode);
          }}
        >
          {mode === 'grade' ? (
            <textarea
              class="op-textarea"
              rows={3}
              value={extra}
              placeholder="Paste a rubric, or leave empty for clarity, structure, evidence, style and correctness."
              aria-label="Rubric"
              onInput={(e) => setExtra((e.currentTarget as HTMLTextAreaElement).value)}
            />
          ) : (
            <input
              class="op-input"
              value={extra}
              placeholder="Who is reading? e.g. “a busy hiring manager”"
              aria-label="Reader"
              onInput={(e) => setExtra((e.currentTarget as HTMLInputElement).value)}
            />
          )}
          <button
            type="submit"
            class="op-btn op-btn--primary"
            disabled={state?.status === 'running'}
          >
            {mode === 'grade' ? 'Grade' : 'Predict'}
          </button>
        </form>
      )}
      {state &&
        (state.status === 'error' ? (
          <p class="ox-error">{state.text}</p>
        ) : (
          <>
            <div class="ox-result ox-result--list">
              {state.text}
              {state.status === 'running' && <span class="ox-caret" />}
            </div>
            {state.status === 'done' && (
              <div class="ox-actions">
                <span class="ox-source">
                  <Icon name="globe" size={12} />
                  From {aiStatus.value.provider}
                </span>
                <span class="ox-grow" />
                <CopyButton text={state.text} />
              </div>
            )}
          </>
        ))}
    </section>
  );
}
