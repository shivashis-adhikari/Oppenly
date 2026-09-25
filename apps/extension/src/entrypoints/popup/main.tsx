import '@oppenly/ui/app.css';
import './popup.css';
import { Icon, Select, Switch, Wordmark } from '@oppenly/ui';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useAiStatus, useSettings } from '../../shared/hooks';
import { DIALECTS } from '../../shared/settings';

const REPO = 'https://github.com/shivashis-adhikari/Oppenly';

function useActiveHost(): { host: string | null; loading: boolean } {
  const [state, setState] = useState<{ host: string | null; loading: boolean }>({
    host: null,
    loading: true,
  });
  useEffect(() => {
    (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) return setState({ host: null, loading: false });
      try {
        const reply = (await browser.tabs.sendMessage(tab.id, { t: 'get-host' }, { frameId: 0 })) as
          | { host?: string }
          | undefined;
        setState({ host: reply?.host ?? null, loading: false });
      } catch {
        setState({ host: null, loading: false });
      }
    })();
  }, []);
  return state;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Popup() {
  const [settings, update] = useSettings();
  const { host, loading } = useActiveHost();
  const ai = useAiStatus([settings?.ai.provider]);
  if (!settings) return null;

  const paused = settings.pausedUntil > Date.now();
  const siteOn = Boolean(host) && !settings.disabledSites.includes(host!);

  return (
    <div class="pp">
      <header class="pp-head">
        <Wordmark height={22} />
        <button
          type="button"
          class="op-icon-btn"
          aria-label="Settings"
          title="Settings"
          onClick={() => browser.runtime.openOptionsPage()}
        >
          <Icon name="gear" />
        </button>
      </header>

      {!settings.enabled ? (
        <section class="pp-card pp-card--muted">
          <div>
            <strong>Oppenly is off</strong>
            <p class="op-small op-muted">No text is checked on any site.</p>
          </div>
          <button
            type="button"
            class="op-btn op-btn--primary op-btn--sm"
            onClick={() => void update({ enabled: true })}
          >
            Turn on
          </button>
        </section>
      ) : paused ? (
        <section class="pp-card pp-card--muted">
          <div>
            <strong>Paused until {formatTime(settings.pausedUntil)}</strong>
            <p class="op-small op-muted">Checking resumes automatically.</p>
          </div>
          <button
            type="button"
            class="op-btn op-btn--primary op-btn--sm"
            onClick={() => void update({ pausedUntil: 0 })}
          >
            Resume
          </button>
        </section>
      ) : (
        <section class="pp-card">
          {loading ? (
            <p class="op-small op-muted">Checking this page…</p>
          ) : host ? (
            <>
              <div class="pp-site">
                <span class="pp-site__name" title={host}>
                  {host}
                </span>
                <span class="op-small op-muted">
                  {siteOn ? 'Checking your writing on this site' : 'Off on this site'}
                </span>
              </div>
              <Switch
                label={`Check writing on ${host}`}
                checked={siteOn}
                onChange={(on) =>
                  void update((s) => ({
                    disabledSites: on
                      ? s.disabledSites.filter((h) => h !== host)
                      : [...new Set([...s.disabledSites, host!])],
                  }))
                }
              />
            </>
          ) : (
            <p class="op-small op-muted">
              Oppenly can’t run on this page. Browser pages and the extension store are off-limits
              to all extensions.
            </p>
          )}
        </section>
      )}

      {settings.enabled && !paused && (
        <button
          type="button"
          class="pp-row"
          onClick={() => void update({ pausedUntil: Date.now() + 3_600_000 })}
        >
          <Icon name="pause" size={16} />
          Pause everywhere for 1 hour
        </button>
      )}

      <section class="pp-block">
        <div class="pp-status">
          <Icon name={ai?.ready && !ai.local ? 'globe' : 'lock'} size={16} />
          <div>
            <strong>
              {ai?.ready && !ai.local
                ? `Local checks + ${ai.provider}`
                : 'Everything runs on this device'}
            </strong>
            <p class="op-small op-muted">
              {ai?.ready && !ai.local
                ? `Text you check is also sent to ${ai.provider}, which you approved.`
                : 'Your writing never leaves your computer.'}
            </p>
          </div>
        </div>
      </section>

      <section class="pp-block pp-field">
        <label class="op-label" for="dialect">
          English variety
        </label>
        <Select
          id="dialect"
          value={settings.dialect}
          options={DIALECTS}
          onChange={(dialect) =>
            void update({ dialect, oxfordComma: dialect === 'american' || dialect === 'canadian' })
          }
        />
      </section>

      <footer class="pp-foot">
        <button type="button" class="pp-link" onClick={() => browser.runtime.openOptionsPage()}>
          Settings
        </button>
        <span aria-hidden="true">·</span>
        <a class="pp-link" href={`${REPO}/issues/new/choose`} target="_blank" rel="noreferrer">
          Report a problem
        </a>
        <span class="pp-spacer" />
        <div class="pp-master">
          <span class="op-small op-muted">On</span>
          <Switch
            label="Oppenly on everywhere"
            checked={settings.enabled}
            onChange={(enabled) => void update({ enabled })}
          />
        </div>
      </footer>
    </div>
  );
}

render(<Popup />, document.getElementById('app')!);
