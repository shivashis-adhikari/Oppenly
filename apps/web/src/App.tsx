import { Icon } from '@oppenly/ui';
import { engineSettingsFor } from '@oppenly/ui/settings-model';
import { effect } from '@preact/signals';
import { refreshAiStatus } from './lib/ai';
import { purgeOldTrash } from './lib/docs';
import { engine } from './lib/engine';
import { route } from './lib/router';
import { applyTheme, settings } from './lib/settings';
import { closeToast, toasts } from './lib/toast';
import { DocPage } from './views/DocPage';
import { Home, Trash } from './views/Home';
import { Settings } from './views/Settings';

// Apply appearance settings and keep the engine and AI status in step with settings.
let engineKey = '';
let aiKey = '';
effect(() => {
  const s = settings.value;
  applyTheme(s.theme);
  document.documentElement.classList.toggle('ox-shapes', s.underlineShapes);
  const nextEngine = JSON.stringify(engineSettingsFor(s));
  if (nextEngine !== engineKey) {
    const first = engineKey === '';
    engineKey = nextEngine;
    const config = engineSettingsFor(s);
    void (first ? engine.init(config) : engine.configure(config));
  }
  const nextAi = JSON.stringify(s.ai);
  if (nextAi !== aiKey) {
    aiKey = nextAi;
    void refreshAiStatus();
  }
});

void purgeOldTrash();

export function App() {
  const r = route.value;
  return (
    <>
      {r.name === 'home' && <Home />}
      {r.name === 'trash' && <Trash />}
      {r.name === 'doc' && <DocPage key={r.id} id={r.id} />}
      {r.name === 'settings' && <Settings section={r.section} />}
      <Toasts />
    </>
  );
}

function Toasts() {
  const list = toasts.value;
  return (
    <div class="ox-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class="ox-toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.run();
                closeToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            class="ox-toast__close"
            aria-label="Dismiss"
            onClick={() => closeToast(t.id)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
