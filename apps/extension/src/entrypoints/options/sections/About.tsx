import { Mark } from '@oppenly/ui';

const REPO = 'https://github.com/shivashis-adhikari/Oppenly';
const SITE = 'https://shivashis-adhikari.github.io/Oppenly';

const CREDITS: [string, string, string][] = [
  ['Harper', 'Grammar engine', 'Apache-2.0'],
  ['wink-nlp', 'Language analysis', 'MIT'],
  ['SCOWL', 'Common-word list', 'Permissive'],
  ['Figtree', 'Typeface', 'OFL-1.1'],
  ['Preact', 'Interface', 'MIT'],
];

export function About() {
  const version = browser.runtime.getManifest().version;
  return (
    <>
      <header class="os-title">
        <h1>About</h1>
      </header>
      <section class="os-panel">
        <div class="os-row">
          <div class="op-row">
            <Mark size={36} />
            <div class="os-row__text">
              <strong>Oppenly {version}</strong>
              <span>Free and open source under the Apache License 2.0.</span>
            </div>
          </div>
        </div>
        <div class="os-row">
          <div class="op-row" style={{ gap: '16px', flexWrap: 'wrap' }}>
            <a href={REPO} target="_blank" rel="noreferrer">
              Source code
            </a>
            <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              Report a problem
            </a>
            <a href={`${SITE}/privacy.html`} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
            <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
              License
            </a>
          </div>
        </div>
      </section>
      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Built with</h3>
        </div>
        <div class="os-body os-credits">
          {CREDITS.map(([name, role, license]) => (
            <div key={name}>
              <strong>{name}</strong>
              <span>
                {role} · {license}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
