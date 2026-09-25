import { Icon } from '@oppenly/ui';
import { useState } from 'preact/hooks';
import type { SectionProps } from './types';

function hostFrom(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname;
  } catch {
    return null;
  }
}

export function Sites({ settings, update }: SectionProps) {
  const [site, setSite] = useState('');
  const host = hostFrom(site);
  const siteGoals = Object.keys(settings.siteGoals).sort();

  return (
    <>
      <header class="os-title">
        <h1>Sites</h1>
        <p>Oppenly works on every site unless you turn it off here or from the Oppenly button.</p>
      </header>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Turned off on</h3>
        </div>
        <form
          class="os-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!host) return;
            void update((s) => ({ disabledSites: [...new Set([...s.disabledSites, host])] }));
            setSite('');
          }}
        >
          <div class="os-inline">
            <input
              class="op-input"
              placeholder="example.com"
              value={site}
              onInput={(e) => setSite((e.currentTarget as HTMLInputElement).value)}
            />
            <button type="submit" class="op-btn op-btn--secondary" disabled={!host}>
              Turn off
            </button>
          </div>
          {settings.disabledSites.length === 0 ? (
            <p class="op-small op-subtle">Oppenly is on for every site.</p>
          ) : (
            <div class="os-tags">
              {settings.disabledSites.map((h) => (
                <span key={h} class="os-tag">
                  {h}
                  <button
                    type="button"
                    aria-label={`Turn Oppenly back on for ${h}`}
                    onClick={() =>
                      void update((s) => ({
                        disabledSites: s.disabledSites.filter((x) => x !== h),
                      }))
                    }
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>
      </section>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Site-specific goals</h3>
          <p>Set from the Insights tab of the assistant on each site.</p>
        </div>
        {siteGoals.length === 0 ? (
          <p class="os-empty">No site-specific goals yet. Every site uses your default goals.</p>
        ) : (
          siteGoals.map((h) => {
            const g = settings.siteGoals[h]!;
            return (
              <div key={h} class="os-row">
                <div class="os-row__text">
                  <strong>{h}</strong>
                  <span>
                    {g.audience} audience · {g.formality} · {g.domain} ·{' '}
                    {g.intent.replace(/-/g, ' ')}
                  </span>
                </div>
                <button
                  type="button"
                  class="op-btn op-btn--secondary op-btn--sm"
                  onClick={() =>
                    void update((s) => {
                      const next = { ...s.siteGoals };
                      delete next[h];
                      return { siteGoals: next };
                    })
                  }
                >
                  Use defaults
                </button>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
