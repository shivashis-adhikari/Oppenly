import '@oppenly/ui/app.css';
import './options.css';
import { Icon, type IconName, Wordmark } from '@oppenly/ui';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useSettings } from '../../shared/hooks';
import { About } from './sections/About';
import { Dictionary } from './sections/Dictionary';
import { General } from './sections/General';
import { Privacy } from './sections/Privacy';
import { Providers } from './sections/Providers';
import { Rules } from './sections/Rules';
import { Sites } from './sections/Sites';
import { Writing } from './sections/Writing';

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
          {current.id === 'rules' && <Rules {...props} />}
          {current.id === 'dictionary' && <Dictionary {...props} />}
          {current.id === 'sites' && <Sites {...props} />}
          {current.id === 'ai' && <Providers {...props} />}
          {current.id === 'privacy' && <Privacy {...props} />}
          {current.id === 'about' && <About />}
        </div>
      </main>
    </div>
  );
}

render(<Options />, document.getElementById('app')!);
