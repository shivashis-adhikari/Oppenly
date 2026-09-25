import { Switch } from '@oppenly/ui';
import type { SectionProps } from './types';

export function General({ settings, update }: SectionProps) {
  const paused = settings.pausedUntil > Date.now();
  return (
    <>
      <header class="os-title">
        <h1>General</h1>
        <p>
          Oppenly checks your writing in text fields on the sites you visit. All checks run on this
          computer.
        </p>
      </header>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>Check my writing</strong>
            <span>Turn Oppenly on or off on every site.</span>
          </div>
          <Switch
            label="Check my writing"
            checked={settings.enabled}
            onChange={(enabled) => void update({ enabled })}
          />
        </div>
        {paused && (
          <div class="os-row">
            <div class="os-row__text">
              <strong>Paused</strong>
              <span>
                Until{' '}
                {new Date(settings.pausedUntil).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              onClick={() => void update({ pausedUntil: 0 })}
            >
              Resume now
            </button>
          </div>
        )}
        <div class="os-row">
          <div class="os-row__text">
            <strong>Show the Oppenly button in text fields</strong>
            <span>The button shows how many suggestions there are and opens the assistant.</span>
          </div>
          <Switch
            label="Show the Oppenly button"
            checked={settings.showButton}
            onChange={(showButton) => void update({ showButton })}
          />
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Tell categories apart by underline shape</strong>
            <span>Adds dashed, dotted and wavy underlines so you don’t have to rely on color.</span>
          </div>
          <Switch
            label="Underline shapes"
            checked={settings.underlineShapes}
            onChange={(underlineShapes) => void update({ underlineShapes })}
          />
        </div>
      </section>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Keyboard shortcuts</h3>
          <p>Change them on your browser’s extension shortcuts page.</p>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Open the assistant</strong>
            <span>For the text field you are typing in.</span>
          </div>
          <span>
            <kbd class="op-kbd">Alt</kbd> + <kbd class="op-kbd">Shift</kbd> +{' '}
            <kbd class="op-kbd">O</kbd>
          </span>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Turn Oppenly on or off for this site</strong>
          </div>
          <span>
            <kbd class="op-kbd">Alt</kbd> + <kbd class="op-kbd">Shift</kbd> +{' '}
            <kbd class="op-kbd">P</kbd>
          </span>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Customize shortcuts</strong>
          </div>
          <button
            type="button"
            class="op-btn op-btn--secondary op-btn--sm"
            onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            Open shortcuts page
          </button>
        </div>
      </section>
    </>
  );
}
