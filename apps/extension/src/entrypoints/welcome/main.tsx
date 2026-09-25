import '@oppenly/ui/app.css';
import './welcome.css';
import { Icon, Wordmark } from '@oppenly/ui';
import { render } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { mountOverlay } from '../../content/mount';
import overlayCss from '../../content/ui/content.css?inline';
import { useSettings } from '../../shared/hooks';

const SAMPLE = `Hi Jordan,

Thanks for sending the draft. Me and Priya reviewed it yesterday and the results is really good. We should utilize the new data in order to make a decision by Friday.

Sorry for the late reply, I will send you my notes tommorow.`;

/** The same in-page layer that runs on websites, mounted on this page as a live demo. */
function Demo() {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const host = document.createElement('oppenly-demo');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = overlayCss;
    const container = document.createElement('div');
    shadow.append(style, container);
    document.documentElement.append(host);
    const unmount = mountOverlay(container, host);
    ref.current?.focus();
    return () => {
      unmount();
      host.remove();
    };
  }, []);
  return (
    <div class="wl-demo">
      <textarea
        ref={ref}
        class="wl-textarea"
        aria-label="Try Oppenly here"
        spellcheck={false}
        defaultValue={SAMPLE}
      />
      <p class="wl-hint">
        Hover over an underline and click a fix. This is exactly how Oppenly works on other sites.
      </p>
    </div>
  );
}

const LEGEND = [
  { cat: 'correctness', label: 'Correctness', text: 'Spelling, grammar and punctuation' },
  { cat: 'clarity', label: 'Clarity', text: 'Shorter, clearer sentences' },
  { cat: 'engagement', label: 'Engagement', text: 'Stronger, more varied words' },
  { cat: 'delivery', label: 'Delivery', text: 'Tone, confidence and inclusive language' },
] as const;

function Welcome() {
  const [settings, update] = useSettings();
  useEffect(() => {
    if (settings && !settings.welcomeSeen) void update({ welcomeSeen: true });
  }, [settings?.welcomeSeen]);

  return (
    <div class="wl">
      <header class="wl-top">
        <Wordmark height={26} />
      </header>

      <section class="wl-hero">
        <h1>Oppenly is ready.</h1>
        <p>
          It checks your writing in text boxes on the sites you use: email, social posts, chats and
          forms. All checks run on this computer.
        </p>
      </section>

      <Demo />

      <section class="wl-grid">
        <article class="wl-card">
          <h3>Four kinds of suggestions</h3>
          <ul class="wl-legend">
            {LEGEND.map((l) => (
              <li key={l.cat}>
                <span class={`wl-swatch wl-swatch--${l.cat}`} />
                <span>
                  <strong>{l.label}</strong>
                  {l.text}
                </span>
              </li>
            ))}
          </ul>
        </article>
        <article class="wl-card">
          <h3>The Oppenly button</h3>
          <p>
            It appears in the corner of the field you’re typing in and shows how many suggestions
            there are.
          </p>
          <ul class="wl-steps">
            <li>
              <Icon name="sidebar" size={16} /> Click it to open the assistant: every suggestion,
              rewrites, tone and goals.
            </li>
            <li>
              <Icon name="power" size={16} /> Hover over it to pause Oppenly or turn it off for a
              site.
            </li>
            <li>
              <Icon name="pen" size={16} /> Select a sentence to rewrite it: shorter, more formal,
              friendlier.
            </li>
          </ul>
        </article>
      </section>

      <section class="wl-ai">
        <div>
          <h3>Want AI suggestions too? It’s optional.</h3>
          <p>
            Connect an AI provider you already use (OpenAI, Anthropic, Google, a model on your own
            computer, and many more) for context-aware suggestions and full rewrites. Nothing is
            sent anywhere unless you set this up and agree.
          </p>
        </div>
        <div class="wl-ai__actions">
          <button
            type="button"
            class="op-btn op-btn--primary"
            onClick={() =>
              void browser.tabs.create({ url: browser.runtime.getURL('/options.html#ai') })
            }
          >
            Set up AI
          </button>
          <span class="op-small op-subtle">
            Or keep everything on this device. You can change this any time.
          </span>
        </div>
      </section>

      <section class="wl-pin">
        <Icon name="info" size={18} />
        <p>
          <strong>Tip:</strong> pin Oppenly to your toolbar (puzzle-piece icon, then the pin) to
          turn it on or off for a site in one click.
        </p>
      </section>
    </div>
  );
}

render(<Welcome />, document.getElementById('app')!);
