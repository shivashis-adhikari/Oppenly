import { clearVault } from '@oppenly/engine/vault';
import { Icon, type IconName, Mark, Segmented, Switch } from '@oppenly/ui';
import {
  Dictionary,
  download,
  Providers,
  Rules,
  type SectionProps,
  Writing,
} from '@oppenly/ui/settings';
import { zipSync } from 'fflate';
import { useEffect, useState } from 'preact/hooks';
import { Node as PMNode } from 'prosemirror-model';
import { schema } from '../editor/schema';
import { docToDocx } from '../io/docx';
import { safeFileName } from '../io/files';
import { providerBackend, refreshAiStatus } from '../lib/ai';
import {
  type DocRecord,
  deleteAllDocs,
  displayTitle,
  listDocs,
  putDoc,
  requestPersistence,
} from '../lib/docs';
import { loadRules } from '../lib/engine';
import { go } from '../lib/router';
import {
  DEFAULT_WEB_SETTINGS,
  settings,
  type Theme,
  updateSettings,
  type WebSettings,
} from '../lib/settings';
import { toast } from '../lib/toast';
import { confirmDialog, Dialogs } from './dialogs';

const REPO = 'https://github.com/shivashis-adhikari/Oppenly';

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: 'general', label: 'General', icon: 'sliders' },
  { id: 'writing', label: 'Writing', icon: 'target' },
  { id: 'rules', label: 'Suggestions', icon: 'list' },
  { id: 'dictionary', label: 'Dictionary', icon: 'book' },
  { id: 'ai', label: 'AI providers', icon: 'key' },
  { id: 'privacy', label: 'Privacy & data', icon: 'shield' },
  { id: 'about', label: 'About', icon: 'info' },
];

type Props = SectionProps<WebSettings>;

export function Settings({ section }: { section: string }) {
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]!;
  const props: Props = {
    settings: settings.value,
    update: async (patch) => {
      const next = await updateSettings(patch);
      void refreshAiStatus();
      return next;
    },
  };
  return (
    <div class="os ox-settings">
      <nav class="os-nav" aria-label="Settings sections">
        <a class="os-nav__item ox-settings__back" href="#/">
          <Icon name="chevronLeft" size={18} />
          Documents
        </a>
        <div class="ox-settings__label">Settings</div>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#/settings/${s.id}`}
            class="os-nav__item"
            aria-current={s.id === current.id ? 'page' : undefined}
          >
            <Icon name={s.icon} size={18} />
            {s.label}
          </a>
        ))}
      </nav>
      <main class="os-main">
        <div class="os-content">
          {current.id === 'general' && <General {...props} />}
          {current.id === 'writing' && (
            <Writing
              {...props}
              goalsHint="Used for new documents. Each document keeps its own goals; change them from the Goals button."
            />
          )}
          {current.id === 'rules' && <Rules {...props} loadRules={loadRules} />}
          {current.id === 'dictionary' && <Dictionary {...props} />}
          {current.id === 'ai' && <Providers {...props} backend={providerBackend} />}
          {current.id === 'privacy' && <Privacy />}
          {current.id === 'about' && <About />}
        </div>
      </main>
      <Dialogs session={null} />
    </div>
  );
}

function General({ settings: s, update }: Props) {
  return (
    <>
      <header class="os-title">
        <h1>General</h1>
      </header>
      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>Appearance</strong>
            <span>“System” follows your computer’s light or dark mode.</span>
          </div>
          <Segmented<Theme>
            label="Appearance"
            value={s.theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => void update({ theme })}
          />
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Text size</strong>
            <span>The size of the text in your documents.</span>
          </div>
          <Segmented<string>
            label="Text size"
            value={String(s.fontSize)}
            options={[
              { value: '15', label: 'Small' },
              { value: '17', label: 'Medium' },
              { value: '19', label: 'Large' },
            ]}
            onChange={(v) => void update({ fontSize: Number(v) })}
          />
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Set goals for new documents</strong>
            <span>Open the goals dialog when you start a document.</span>
          </div>
          <Switch
            label="Set goals for new documents"
            checked={s.goalsOnNew}
            onChange={(goalsOnNew) => void update({ goalsOnNew })}
          />
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Underline shapes</strong>
            <span>
              Mark each category with its own underline style as well as its colour: solid, dashed,
              dotted, wavy.
            </span>
          </div>
          <Switch
            label="Underline shapes"
            checked={s.underlineShapes}
            onChange={(underlineShapes) => void update({ underlineShapes })}
          />
        </div>
      </section>
    </>
  );
}

interface Backup {
  app: 'oppenly';
  version: 1;
  exportedAt: string;
  settings: WebSettings;
  documents: DocRecord[];
}

function Privacy() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false));
    void listDocs().then((d) => setCount(d.length));
  }, []);

  const backup = async () => {
    const data: Backup = {
      app: 'oppenly',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: settings.value,
      documents: await listDocs(),
    };
    const date = new Date().toISOString().slice(0, 10);
    download(`oppenly-backup-${date}.json`, JSON.stringify(data), 'application/json');
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<Backup>;
      if (data.app !== 'oppenly' || !Array.isArray(data.documents)) throw new Error();
      for (const d of data.documents) {
        if (typeof d?.id === 'string' && typeof d.text === 'string') await putDoc(d);
      }
      if (data.settings) await updateSettings({ ...DEFAULT_WEB_SETTINGS, ...data.settings });
      setCount((await listDocs()).length);
      toast(`Restored ${data.documents.length} documents.`);
    } catch {
      toast('That file is not an Oppenly backup.');
    }
  };

  const allAsWord = async () => {
    const docs = (await listDocs()).filter((d) => !d.deletedAt);
    const files: Record<string, Uint8Array> = {};
    for (const d of docs) {
      const content = d.content
        ? PMNode.fromJSON(schema, d.content)
        : schema.node('doc', null, [schema.node('paragraph')]);
      let name = safeFileName(displayTitle(d), 80);
      while (files[`${name}.docx`]) name += ' (2)';
      files[`${name}.docx`] = docToDocx(content, d.title.trim());
    }
    download(
      'oppenly-documents.zip',
      new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }),
    );
  };

  const eraseAll = async () => {
    const ok = await confirmDialog({
      title: 'Delete all Oppenly data?',
      message:
        'This permanently deletes every document, your settings, dictionary and saved AI keys from this browser. It can’t be undone.',
      confirm: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    await deleteAllDocs();
    await clearVault();
    await updateSettings(DEFAULT_WEB_SETTINGS);
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    await refreshAiStatus();
    toast('All Oppenly data was deleted from this browser.');
    go({ name: 'home' });
  };

  return (
    <>
      <header class="os-title">
        <h1>Privacy & data</h1>
        <p>
          Oppenly runs on this computer. Your documents, dictionary and settings are stored in this
          browser and never uploaded. The page can only connect to the Oppenly server running on
          your computer.
        </p>
      </header>

      <section class="os-callout">
        <Icon name="lock" size={20} />
        <div>
          <strong>What leaves your computer</strong>
          <p>
            Nothing, unless you set up a cloud AI provider. Then the text you check or rewrite is
            sent to that provider with your key, and nowhere else. Oppenly’s developers never
            receive your text, your key or any usage data.
          </p>
        </div>
      </section>

      <section class="os-panel">
        <div class="os-panel__head">
          <h3>Your documents</h3>
          <p>
            {count} {count === 1 ? 'document' : 'documents'} stored in this browser for{' '}
            {location.host}.
          </p>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Protect from automatic cleanup</strong>
            <span>
              {persisted
                ? 'On. The browser will not clear your documents to free up space.'
                : 'Browsers may clear site data when disk space runs low. Ask the browser to keep it.'}
            </span>
          </div>
          {!persisted && (
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              onClick={async () => {
                const ok = await requestPersistence();
                setPersisted(ok);
                if (!ok) toast('The browser declined. Keep a backup to be safe.');
              }}
            >
              Turn on
            </button>
          )}
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Download all documents</strong>
            <span>Every document as a Word file, in one .zip.</span>
          </div>
          <button
            type="button"
            class="op-btn op-btn--secondary op-btn--sm"
            onClick={() => void allAsWord()}
          >
            <Icon name="download" size={16} />
            Download
          </button>
        </div>
        <div class="os-row">
          <div class="os-row__text">
            <strong>Back up and restore</strong>
            <span>
              A backup file holds your documents and settings (not your AI keys). Restore it here or
              in another browser.
            </span>
          </div>
          <div class="os-actions">
            <label class="op-btn op-btn--secondary op-btn--sm">
              <Icon name="upload" size={16} />
              Restore
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) void restore(f);
                }}
              />
            </label>
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              onClick={() => void backup()}
            >
              <Icon name="download" size={16} />
              Back up
            </button>
          </div>
        </div>
      </section>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>Delete everything</strong>
            <span>Removes all documents, settings, your dictionary and saved AI keys.</span>
          </div>
          <button
            type="button"
            class="op-btn op-btn--danger op-btn--sm"
            onClick={() => void eraseAll()}
          >
            Delete all data
          </button>
        </div>
      </section>
    </>
  );
}

const CREDITS: [string, string, string][] = [
  ['Harper', 'Grammar engine', 'Apache-2.0'],
  ['wink-nlp', 'Language analysis', 'MIT'],
  ['SCOWL', 'Common-word list', 'Permissive'],
  ['ProseMirror', 'Editor', 'MIT'],
  ['fflate', 'Word and OpenDocument files', 'MIT'],
  ['Figtree', 'Typeface', 'OFL-1.1'],
  ['Preact', 'Interface', 'MIT'],
];

function About() {
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
              <strong>Oppenly for the web, running on this computer</strong>
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
            <a href={`${REPO}/blob/main/PRIVACY.md`} target="_blank" rel="noreferrer">
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
