import type { Category, Goals } from '@oppenly/engine';
import { CATEGORY_HINT, CATEGORY_LABEL, Select, Switch } from '@oppenly/ui';
import { DIALECTS } from '../../../shared/settings';
import type { SectionProps } from './types';

const CATS: Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];

const GOAL_OPTIONS: {
  key: keyof Goals;
  label: string;
  hint: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: 'audience',
    label: 'Audience',
    hint: 'Who will read your writing',
    options: [
      { value: 'general', label: 'General' },
      { value: 'knowledgeable', label: 'Knowledgeable' },
      { value: 'expert', label: 'Expert' },
    ],
  },
  {
    key: 'formality',
    label: 'Formality',
    hint: 'How formal your writing should sound',
    options: [
      { value: 'informal', label: 'Informal' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  {
    key: 'domain',
    label: 'Domain',
    hint: 'The kind of writing',
    options: [
      { value: 'general', label: 'General' },
      { value: 'academic', label: 'Academic' },
      { value: 'business', label: 'Business' },
      { value: 'technical', label: 'Technical' },
      { value: 'creative', label: 'Creative' },
      { value: 'casual', label: 'Casual' },
      { value: 'email', label: 'Email' },
    ],
  },
  {
    key: 'intent',
    label: 'Intent',
    hint: 'What you want to achieve',
    options: [
      { value: 'inform', label: 'Inform' },
      { value: 'describe', label: 'Describe' },
      { value: 'convince', label: 'Convince' },
      { value: 'tell-a-story', label: 'Tell a story' },
    ],
  },
];

export function Writing({ settings, update }: SectionProps) {
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
          <p>
            Used on every site unless you set site-specific goals from the assistant’s Insights tab.
          </p>
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
