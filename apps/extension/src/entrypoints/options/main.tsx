import '@oppenly/ui/app.css';
import '@oppenly/ui/settings.css';
import './options.css';
import type { RuleInfo } from '@oppenly/engine';
import { onDeviceAvailability } from '@oppenly/engine/ai';
import { deleteProvider, getProvider, listProviders, saveProvider } from '@oppenly/engine/vault';
import { Icon, type IconName, Wordmark } from '@oppenly/ui';
import { Dictionary, type ProviderBackend, Providers, Rules, Writing } from '@oppenly/ui/settings';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { request, useSettings } from '../../shared/hooks';
import { About } from './sections/About';
import { General } from './sections/General';
import { Privacy } from './sections/Privacy';
import { Sites } from './sections/Sites';

/** Provider keys live in the extension's IndexedDB; network calls run in the background worker. */
const backend: ProviderBackend = {
  list: listProviders,
  get: getProvider,
  save: saveProvider,
  remove: deleteProvider,
  requestAccess: (pattern) => browser.permissions.request({ origins: [pattern] }),
  releaseAccess: async (pattern) => {
    await browser.permissions.remove({ origins: [pattern] });
  },
  test: (presetId) => request<{ ms: number }>({ t: 'test-provider', presetId }),
  listModels: async (presetId) =>
    (await request<{ models: string[] }>({ t: 'list-models', presetId })).models,
  onDeviceAvailability,
};

const loadRules = () => request<RuleInfo[]>({ t: 'rule-info' });

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'sliders' },
  { id: 'writing', label: 'Writing', icon: 'target' },
  { id: 'rules', label: 'Suggestions', icon: 'list' },
  { id: 'dictionary', label: 'Dictionary', icon: 'book' },
  { id: 'sites', label: 'Sites', icon: 'globe' },
  { id: 'ai', label: 'AI providers', icon: 'key' },
  { id: 'privacy', label: 'Privacy & data', icon: 'shield' },
  { id: 'about', label: 'About', icon: 'info' },
];

function useHash(): [string, (id: string) => void] {
  const read = () => location.hash.slice(1) || 'general';
  const [hash, setHash] = useState(read);
  useEffect(() => {
    const on = () => setHash(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [hash, (id) => (location.hash = id)];
}

function Options() {
  const [settings, update] = useSettings();
  const [section, go] = useHash();
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  if (!settings) return null;
  const props = { settings, update };
  return (
    <div class="os">
      <nav class="os-nav" aria-label="Settings sections">
        <div class="os-brand">
          <Wordmark height={24} />
        </div>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            class="os-nav__item"
            aria-current={s.id === current.id ? 'page' : undefined}
            onClick={() => go(s.id)}
          >
            <Icon name={s.icon} size={18} />
            {s.label}
          </a>
        ))}
      </nav>
      <main class="os-main">
        <div class="os-content">
          {current.id === 'general' && <General {...props} />}
          {current.id === 'writing' && <Writing {...props} />}
          {current.id === 'rules' && <Rules {...props} loadRules={loadRules} />}
          {current.id === 'dictionary' && <Dictionary {...props} />}
          {current.id === 'sites' && <Sites {...props} />}
          {current.id === 'ai' && <Providers {...props} backend={backend} />}
          {current.id === 'privacy' && <Privacy {...props} />}
          {current.id === 'about' && <About />}
        </div>
      </main>
    </div>
  );
}

render(<Options />, document.getElementById('app')!);
