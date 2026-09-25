import { clearVault } from '@oppenly/engine/vault';
import { Icon, Modal } from '@oppenly/ui';
import { useState } from 'preact/hooks';
import { DEFAULT_SETTINGS } from '../../../shared/settings';
import type { SectionProps } from './types';

const POLICY = 'https://shivashis-adhikari.github.io/Oppenly/privacy.html';

export function Privacy({ settings, update }: SectionProps) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const exportSettings = () => {
    const data = JSON.stringify(
      {
        app: 'Oppenly',
        version: browser.runtime.getManifest().version,
        exportedAt: new Date().toISOString(),
        settings,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oppenly-settings.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importSettings = async (file: File) => {
    const parsed = JSON.parse(await file.text()) as { settings?: Record<string, unknown> };
    if (!parsed.settings || typeof parsed.settings !== 'object') return;
    const allowed = Object.keys(DEFAULT_SETTINGS);
    const clean = Object.fromEntries(
      Object.entries(parsed.settings).filter(([k]) => allowed.includes(k)),
    );
    await update(clean);
  };

  const wipe = async () => {
    await clearVault();
    await browser.storage.local.clear();
    const granted = await browser.permissions.getAll();
    const optional = (granted.origins ?? []).filter((o) => o !== '<all_urls>');
    if (optional.length) await browser.permissions.remove({ origins: optional }).catch(() => false);
    setConfirming(false);
    setDone(true);
  };

  return (
    <>
      <header class="os-title">
        <h1>Privacy & data</h1>
        <p>Oppenly has no servers, no accounts and no analytics.</p>
      </header>

      <div class="os-callout">
        <Icon name="shield" size={20} />
        <div>
          <strong>Your writing stays on this computer.</strong> Grammar, style, tone and statistics
          all run inside your browser. Text leaves your computer only if you turn on a cloud AI
          provider, and then only the text you check or rewrite goes to that provider.
        </div>
      </div>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>What is stored, and where</h3>
        </div>
        <div class="os-body">
          <ul class="os-list">
            <li>
              Your settings, dictionary and site preferences: in this browser’s extension storage.
            </li>
            <li>
              AI provider settings and API keys: in the extension’s private database, with keys
              encrypted.
            </li>
            <li>
              The text you write: nowhere. It is checked in memory and never saved by Oppenly.
            </li>
          </ul>
          <a href={POLICY} target="_blank" rel="noreferrer">
            Read the privacy policy
          </a>
        </div>
      </section>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>Export settings</strong>
            <span>
              Settings, dictionary and site preferences as a file. API keys are never exported.
            </span>
          </div>
          <div class="os-actions">
            <label class="op-btn op-btn--secondary op-btn--sm">
              <Icon name="upload" size={16} />
              Import
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) void importSettings(f);
                }}
              />
            </label>
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              onClick={exportSettings}
            >
              <Icon name="download" size={16} />
              Export
            </button>
          </div>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Delete all Oppenly data</strong>
            <span>
              Removes settings, dictionary, AI providers and keys, and any site access you granted
              to providers.
            </span>
          </div>
          <button
            type="button"
            class="op-btn op-btn--danger op-btn--sm"
            onClick={() => setConfirming(true)}
          >
            Delete everything
          </button>
        </div>
        {done && <p class="os-empty">All Oppenly data was deleted.</p>}
      </section>

      {confirming && (
        <Modal
          title="Delete all Oppenly data?"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <button
                type="button"
                class="op-btn op-btn--secondary"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                class="op-btn op-btn--primary"
                style={{ background: 'var(--op-danger)' }}
                onClick={() => void wipe()}
              >
                Delete everything
              </button>
            </>
          }
        >
          <p class="op-muted">
            This can’t be undone. Oppenly will go back to its default settings.
          </p>
        </Modal>
      )}
    </>
  );
}
