import {
  getPreset,
  onDeviceAvailability,
  PROVIDERS,
  type ProviderPreset,
  rankModelsForChecking,
} from '@oppenly/engine/ai';
import { Icon, Switch } from '@oppenly/ui';
import { useEffect, useState } from 'preact/hooks';
import { request } from '../../../shared/hooks';
import {
  deleteProvider,
  getProvider,
  listProviders,
  type ProviderSummary,
  saveProvider,
} from '../../../shared/vault';
import type { SectionProps } from './types';

const LOCAL_IDS = ['on-device', 'ollama', 'lmstudio', 'llamacpp'];
const CUSTOM_IDS = ['custom-openai', 'custom-anthropic', 'custom-gemini'];

/** Host-permission pattern for a provider URL. Localhost ports share one pattern. */
function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return `http://${u.hostname}/*`;
    if (u.protocol !== 'https:') return null;
    return `https://${u.hostname}/*`;
  } catch {
    return null;
  }
}

export function Providers({ settings, update }: SectionProps) {
  const [saved, setSaved] = useState<ProviderSummary[]>([]);
  const [selected, setSelected] = useState<string>(settings.ai.provider ?? 'on-device');
  const reload = () => void listProviders().then(setSaved);
  useEffect(reload, []);
  const active = settings.ai.provider ? getPreset(settings.ai.provider) : undefined;

  const subtitle = (p: ProviderPreset): string | null => {
    if (settings.ai.provider === p.id) return 'In use';
    if (saved.some((s) => s.presetId === p.id)) return 'Saved';
    if (p.id === 'on-device') return 'Gemini Nano';
    if (CUSTOM_IDS.includes(p.id)) return 'Any address';
    return null;
  };

  const group = (title: string, ids: string[] | null) => {
    const list = ids
      ? PROVIDERS.filter((p) => ids.includes(p.id))
      : PROVIDERS.filter((p) => !LOCAL_IDS.includes(p.id) && !CUSTOM_IDS.includes(p.id));
    return (
      <>
        <div class="os-panel__head" style={{ borderBottom: 0, paddingBottom: 0 }}>
          <h3>{title}</h3>
        </div>
        <div class="os-providers">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              class="os-provider"
              aria-pressed={selected === p.id}
              onClick={() => setSelected(p.id)}
            >
              {settings.ai.provider === p.id && <span class="os-provider__active" title="In use" />}
              <strong>{p.name}</strong>
              {subtitle(p) && <span>{subtitle(p)}</span>}
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <>
      <header class="os-title">
        <h1>AI providers</h1>
        <p>
          Optional. Oppenly already checks grammar, clarity, engagement and tone on this computer.
          An AI provider adds context-aware suggestions and full rewrites, using your own account.
        </p>
      </header>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>{active ? `Using ${active.name}` : 'No AI provider'}</strong>
            <span>
              {active
                ? active.local
                  ? 'Runs on this computer.'
                  : `Text you check is sent to ${active.name}.`
                : 'Everything runs on this computer.'}
            </span>
          </div>
          {active && (
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              onClick={() => void update((s) => ({ ai: { ...s.ai, provider: null } }))}
            >
              Stop using AI
            </button>
          )}
        </div>
        {active && (
          <div class="os-row">
            <div class="os-row__text">
              <strong>Suggest while I type</strong>
              <span>
                Ask {active.name} for suggestions as you write, in addition to on-device checks.
                Rewrites work either way.
              </span>
            </div>
            <Switch
              label="Suggest while I type"
              checked={settings.ai.liveCheck}
              onChange={(liveCheck) => void update((s) => ({ ai: { ...s.ai, liveCheck } }))}
            />
          </div>
        )}
      </section>

      <section class="os-panel">
        {group('On your computer', LOCAL_IDS)}
        {group('Cloud providers', null)}
        {group('Any other provider', CUSTOM_IDS)}
      </section>

      {selected === 'on-device' ? (
        <OnDevice
          active={settings.ai.provider === 'on-device'}
          onUse={() => void update((s) => ({ ai: { ...s.ai, provider: 'on-device' } }))}
        />
      ) : (
        <ProviderForm
          key={selected}
          preset={getPreset(selected)!}
          summary={saved.find((s) => s.presetId === selected)}
          active={settings.ai.provider === selected}
          onSaved={async (use) => {
            reload();
            if (use) await update((s) => ({ ai: { ...s.ai, provider: selected } }));
          }}
          onRemoved={async () => {
            reload();
            if (settings.ai.provider === selected)
              await update((s) => ({ ai: { ...s.ai, provider: null } }));
          }}
        />
      )}
    </>
  );
}

function OnDevice({ active, onUse }: { active: boolean; onUse: () => void }) {
  const [status, setStatus] = useState<string>('checking');
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    void onDeviceAvailability().then(setStatus);
  }, []);
  const download = async () => {
    const lm = (
      globalThis as unknown as {
        LanguageModel?: { create(o: unknown): Promise<{ destroy(): void }> };
      }
    ).LanguageModel;
    if (!lm) return;
    setProgress(0);
    const session = await lm.create({
      monitor(m: EventTarget) {
        m.addEventListener('downloadprogress', (e) =>
          setProgress((e as unknown as { loaded: number }).loaded),
        );
      },
    });
    session.destroy();
    setProgress(null);
    setStatus(await onDeviceAvailability());
  };
  const label: Record<string, string> = {
    checking: 'Checking…',
    available: 'Ready on this device',
    downloadable: 'Needs a one-time download from Google',
    downloading: 'Downloading',
    unavailable: 'Not supported by this browser or device',
  };
  return (
    <section class="os-panel">
      <div class="os-panel__head">
        <h3>Chrome built-in AI</h3>
        <p>
          Chrome includes a small AI model (Gemini Nano) that runs on your computer. Your text never
          leaves the device.
        </p>
      </div>
      <div class="os-body">
        <div class="os-row" style={{ padding: 0 }}>
          <div class="os-row__text">
            <strong>{label[status] ?? status}</strong>
            <span>Works in recent Chrome on computers with enough memory and storage.</span>
          </div>
          {status === 'downloadable' && (
            <button
              type="button"
              class="op-btn op-btn--secondary"
              onClick={() => void download()}
              disabled={progress !== null}
            >
              {progress === null ? 'Download model' : `Downloading ${Math.round(progress * 100)}%`}
            </button>
          )}
        </div>
        <div class="os-actions">
          <button
            type="button"
            class="op-btn op-btn--primary"
            disabled={status !== 'available' || active}
            onClick={onUse}
          >
            {active ? 'In use' : 'Use on-device AI'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ProviderForm({
  preset,
  summary,
  active,
  onSaved,
  onRemoved,
}: {
  preset: ProviderPreset;
  summary: ProviderSummary | undefined;
  active: boolean;
  onSaved: (use: boolean) => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const [baseUrl, setBaseUrl] = useState(summary?.baseUrl ?? preset.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [checkModel, setCheckModel] = useState(summary?.checkModel ?? '');
  const [writeModel, setWriteModel] = useState(summary?.writeModel ?? '');
  const [consent, setConsent] = useState(Boolean(summary?.consentedAt) || preset.local);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const origin = (() => {
    try {
      return new URL(baseUrl).origin;
    } catch {
      return '';
    }
  })();
  const needsKey = preset.keyRequired && !summary?.hasKey;
  const valid =
    Boolean(origin) &&
    (!needsKey || apiKey.trim()) &&
    consent &&
    (checkModel.trim() || preset.listsModels);

  /** Write the current form to the vault. Keeps a previously saved key when the field is empty. */
  const persist = async (models: { check: string; write: string }) => {
    const existing = await getProvider(preset.id);
    await saveProvider({
      presetId: preset.id,
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim() || existing?.apiKey || '',
      checkModel: models.check,
      writeModel: models.write || models.check,
      consentedAt: preset.local ? null : (existing?.consentedAt ?? Date.now()),
    });
  };

  const save = async (use: boolean) => {
    setStatus(null);
    const pattern = originPattern(baseUrl);
    if (!pattern) {
      setStatus({
        kind: 'err',
        text: 'Use an https address (or http://localhost for providers on your computer).',
      });
      return;
    }
    // Ask the browser for access to this one address. Must run first, inside the click.
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) {
      setStatus({
        kind: 'err',
        text: 'Oppenly needs permission to reach this address. Nothing was saved.',
      });
      return;
    }
    setBusy(true);
    try {
      await persist({ check: checkModel.trim(), write: writeModel.trim() });
      setApiKey('');
      await onSaved(use);
      if (!checkModel.trim() && preset.listsModels) {
        await loadModels();
        return;
      }
      setStatus({ kind: 'ok', text: use ? `Saved. Oppenly now uses ${preset.name}.` : 'Saved.' });
    } catch (err) {
      setStatus({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { ms } = await request<{ ms: number }>({ t: 'test-provider', presetId: preset.id });
      setStatus({ kind: 'ok', text: `Connected. Replied in ${ms} ms.` });
    } catch (err) {
      setStatus({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const loadModels = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const { models: list } = await request<{ models: string[] }>({
        t: 'list-models',
        presetId: preset.id,
      });
      const ranked = rankModelsForChecking(list);
      setModels(ranked);
      if (!checkModel.trim() && ranked[0]) {
        // Preselect the fastest-looking model so the provider works right away.
        setCheckModel(ranked[0]);
        setWriteModel(writeModel || ranked[0]);
        await persist({ check: ranked[0], write: writeModel.trim() || ranked[0] });
        setStatus({
          kind: 'ok',
          text: `Saved. Using ${ranked[0]} (${list.length} models available).`,
        });
      } else {
        setStatus({ kind: 'ok', text: `${list.length} models available. Pick one and save.` });
      }
    } catch (err) {
      setStatus({ kind: 'err', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await deleteProvider(preset.id);
    const pattern = originPattern(baseUrl);
    if (pattern && !pattern.startsWith('http://'))
      await browser.permissions.remove({ origins: [pattern] }).catch(() => false);
    await onRemoved();
    setCheckModel('');
    setWriteModel('');
    setConsent(preset.local);
    setStatus({ kind: 'ok', text: 'Removed. Your key was deleted from this computer.' });
  };

  const listId = `models-${preset.id}`;
  return (
    <section class="os-panel">
      <div class="os-panel__head">
        <h3>{preset.name}</h3>
        {preset.note && <p>{preset.note}</p>}
      </div>
      <form
        class="os-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) void save(true);
        }}
      >
        <div class="op-field">
          <label class="op-label" for="base-url">
            API address
          </label>
          <input
            id="base-url"
            class="op-input"
            value={baseUrl}
            spellcheck={false}
            onInput={(e) => setBaseUrl((e.currentTarget as HTMLInputElement).value)}
          />
        </div>

        {(preset.keyRequired || !preset.local) && (
          <div class="op-field">
            <label class="op-label" for="api-key">
              API key
            </label>
            <div class="os-key">
              <input
                id="api-key"
                class="op-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                autocomplete="off"
                spellcheck={false}
                placeholder={
                  summary?.hasKey ? 'Saved. Enter a new key to replace it.' : 'Paste your key'
                }
                onInput={(e) => setApiKey((e.currentTarget as HTMLInputElement).value)}
              />
              <button type="button" onClick={() => setShowKey(!showKey)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span class="op-hint">
              Stored encrypted on this computer and sent only to {origin || 'this address'}.{' '}
              {preset.keyUrl && (
                <a href={preset.keyUrl} target="_blank" rel="noreferrer">
                  Get a key
                </a>
              )}
            </span>
          </div>
        )}

        <div class="os-grid-2">
          <div class="op-field">
            <label class="op-label" for="check-model">
              Model for suggestions
            </label>
            <input
              id="check-model"
              class="op-input"
              list={listId}
              value={checkModel}
              spellcheck={false}
              placeholder={preset.id === 'azure' ? 'Deployment name' : 'A fast, low-cost model'}
              onInput={(e) => setCheckModel((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <div class="op-field">
            <label class="op-label" for="write-model">
              Model for rewrites
            </label>
            <input
              id="write-model"
              class="op-input"
              list={listId}
              value={writeModel}
              spellcheck={false}
              placeholder="Same as suggestions"
              onInput={(e) => setWriteModel((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <datalist id={listId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {!preset.local && (
          <label class="os-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent((e.currentTarget as HTMLInputElement).checked)}
            />
            <span>
              <strong>Send my text to {preset.name}.</strong> When AI features run, the text you
              check or rewrite goes directly from your browser to {preset.name}
              {origin ? ` (${origin})` : ''} with your API key, and {preset.name}’s terms and{' '}
              {preset.privacyUrl ? (
                <a href={preset.privacyUrl} target="_blank" rel="noreferrer">
                  privacy policy
                </a>
              ) : (
                'privacy policy'
              )}{' '}
              apply. Oppenly’s developers never receive your text or your key. Remove this provider
              at any time to stop.
            </span>
          </label>
        )}

        <div class="os-actions">
          <button type="submit" class="op-btn op-btn--primary" disabled={!valid || busy}>
            {active ? 'Save changes' : 'Save and use'}
          </button>
          {summary && (
            <>
              <button
                type="button"
                class="op-btn op-btn--secondary"
                disabled={busy}
                onClick={() => void test()}
              >
                Test connection
              </button>
              {preset.listsModels && (
                <button
                  type="button"
                  class="op-btn op-btn--secondary"
                  disabled={busy}
                  onClick={() => void loadModels()}
                >
                  Load models
                </button>
              )}
              <button
                type="button"
                class="op-btn op-btn--danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                <Icon name="trash" size={16} />
                Remove
              </button>
            </>
          )}
          {status && <span class={`os-result os-result--${status.kind}`}>{status.text}</span>}
        </div>
        {!summary && preset.listsModels && (
          <p class="op-hint">
            Leave the models empty and Oppenly will load your available models after saving.
          </p>
        )}
      </form>
    </section>
  );
}
