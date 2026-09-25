import type { Category, RuleInfo } from '@oppenly/engine';
import { CATEGORY_LABEL, Switch } from '@oppenly/ui';
import { useEffect, useState } from 'preact/hooks';
import { request } from '../../../shared/hooks';
import type { SectionProps } from './types';

const CATS: Category[] = ['correctness', 'clarity', 'engagement', 'delivery'];

/** "grammar.SpellCheck" → "Spell check" */
function humanize(rule: string): string {
  const name = rule.replace(/^(grammar|style|ai)\./, '');
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export function Rules({ settings, update }: SectionProps) {
  const [rules, setRules] = useState<RuleInfo[] | null>(null);
  useEffect(() => {
    void request<RuleInfo[]>({ t: 'rule-info' }).then(setRules, () => setRules([]));
  }, []);
  const known = new Set(rules?.map((r) => r.id));
  const offElsewhere = settings.disabledRules.filter((r) => !known.has(r));
  const toggle = (id: string, on: boolean) =>
    void update((s) => ({
      disabledRules: on
        ? s.disabledRules.filter((r) => r !== id)
        : [...new Set([...s.disabledRules, id])],
    }));

  return (
    <>
      <header class="os-title">
        <h1>Suggestions</h1>
        <p>
          Grammar and spelling come from Oppenly’s built-in grammar engine. Below are the style
          checks you can turn on or off individually.
        </p>
      </header>

      {offElsewhere.length > 0 && (
        <section class="os-panel">
          <div class="os-panel__head">
            <h3>Turned off from a suggestion card</h3>
            <p>You chose “Turn off suggestions like this” for these.</p>
          </div>
          {offElsewhere.map((id) => (
            <div key={id} class="os-row">
              <div class="os-row__text">
                <strong>{humanize(id)}</strong>
              </div>
              <button
                type="button"
                class="op-btn op-btn--secondary op-btn--sm"
                onClick={() => toggle(id, true)}
              >
                Turn back on
              </button>
            </div>
          ))}
        </section>
      )}

      {rules === null ? (
        <p class="op-muted">Loading…</p>
      ) : (
        CATS.map((c) => {
          const list = rules.filter((r) => r.category === c);
          if (!list.length) return null;
          return (
            <section key={c} class="os-panel">
              <div class="os-panel__head">
                <h3>
                  <span
                    class={`op-dot op-dot--${c}`}
                    style={{ marginRight: '8px', verticalAlign: '2px' }}
                  />
                  {CATEGORY_LABEL[c]}
                </h3>
              </div>
              {list.map((r) => (
                <div key={r.id} class="os-row">
                  <div class="os-row__text">
                    <strong>{r.name}</strong>
                    <span>{r.description}</span>
                  </div>
                  <Switch
                    label={r.name}
                    checked={!settings.disabledRules.includes(r.id)}
                    onChange={(on) => toggle(r.id, on)}
                  />
                </div>
              ))}
            </section>
          );
        })
      )}
    </>
  );
}
