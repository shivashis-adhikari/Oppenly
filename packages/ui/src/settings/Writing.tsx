import type { Category } from '@oppenly/engine';
import { CATEGORY_HINT, CATEGORY_LABEL, Select, Switch } from '../components';
import { DIALECTS, GOAL_OPTIONS, type SectionProps } from './model';

const CATS: Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];

export function Writing({
  settings,
  update,
  goalsHint = 'Used on every site unless you set site-specific goals from the assistant’s Insights tab.',
}: SectionProps & { goalsHint?: string }) {
  return (
    <>
      <header class="os-title">
        <h1>Writing</h1>
        <p>
          Set the English variety you write in and the goals Oppenly uses to tailor suggestions.
        </p>
      </header>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>English variety</strong>
            <span>Spelling and usage follow this variety.</span>
          </div>
          <Select
            value={settings.dialect}
            options={DIALECTS}
            onChange={(dialect) =>
              void update({
                dialect,
                oxfordComma:
                  dialect === 'american' || dialect === 'canadian' ? settings.oxfordComma : false,
              })
            }
          />
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Oxford comma</strong>
            <span>
              Suggest a comma before “and” in lists of three or more (“red, white, and blue”).
            </span>
          </div>
          <Switch
            label="Oxford comma"
            checked={settings.oxfordComma}
            onChange={(oxfordComma) => void update({ oxfordComma })}
          />
        </div>
      </section>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Default goals</h3>
          <p>{goalsHint}</p>
        </div>
        {GOAL_OPTIONS.map((g) => (
          <div key={g.key} class="os-row">
            <div class="os-row__text">
              <strong>{g.label}</strong>
              <span>{g.hint}</span>
            </div>
            <Select
              value={settings.goals[g.key]}
              options={g.options}
              onChange={(v) => void update((s) => ({ goals: { ...s.goals, [g.key]: v } }))}
            />
          </div>
        ))}
      </section>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Suggestion categories</h3>
          <p>Turn off a whole category if you don’t want those suggestions.</p>
        </div>
        {CATS.map((c) => {
          const on = !settings.disabledCategories.includes(c);
          return (
            <div key={c} class="os-row">
              <div class="os-row__text">
                <strong>
                  <span class={`op-dot op-dot--${c}`} style={{ marginRight: '8px' }} />
                  {CATEGORY_LABEL[c]}
                </strong>
                <span>{CATEGORY_HINT[c]}</span>
              </div>
              <Switch
                label={CATEGORY_LABEL[c]}
                checked={on}
                onChange={(v) =>
                  void update((s) => ({
                    disabledCategories: v
                      ? s.disabledCategories.filter((x) => x !== c)
                      : [...s.disabledCategories, c],
                  }))
                }
              />
            </div>
          );
        })}
      </section>
    </>
  );
}
