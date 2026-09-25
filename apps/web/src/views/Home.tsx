import { Icon, Mark, ScoreRing } from '@oppenly/ui';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Node as PMNode } from 'prosemirror-model';
import { schema } from '../editor/schema';
import { type Block, buildDoc } from '../io/blocks';
import { ACCEPT, exportDoc, importFile } from '../io/files';
import {
  createDoc,
  type DocRecord,
  deleteDoc,
  displayTitle,
  emptyTrash,
  listDocs,
  restoreDoc,
  TRASH_DAYS,
  trashDoc,
} from '../lib/docs';
import { go, route } from '../lib/router';
import { toast } from '../lib/toast';
import { fresh } from './DocPage';
import { confirmDialog, Dialogs } from './dialogs';
import { Menu, MenuItem, MenuSeparator } from './Menu';

/** Left navigation shared by the dashboard and the trash. */
export function Shell({ children }: { children: ComponentChildren }) {
  const r = route.value;
  const item = (href: string, icon: 'file' | 'trash' | 'gear', label: string, current: boolean) => (
    <a href={href} class="ox-nav__item" aria-current={current ? 'page' : undefined}>
      <Icon name={icon} size={18} />
      {label}
    </a>
  );
  return (
    <div class="ox-shell">
      <nav class="ox-nav" aria-label="Main">
        <a href="#/" class="ox-nav__brand" aria-label="Oppenly documents">
          <Mark size={26} />
          <span>Oppenly</span>
        </a>
        {item('#/', 'file', 'Documents', r.name === 'home')}
        {item('#/trash', 'trash', 'Trash', r.name === 'trash')}
        {item('#/settings/general', 'gear', 'Settings', false)}
        <span class="ox-grow" />
        <p class="ox-nav__note">
          <Icon name="lock" size={14} />
          Documents are stored in this browser, on this computer.
        </p>
      </nav>
      <main class="ox-shell__main">{children}</main>
      <Dialogs session={null} />
    </div>
  );
}

function when(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

const SAMPLE: Block[] = [
  {
    kind: 'paragraph',
    runs: [
      {
        text: 'Hi Jordan, thanks for sending the draft. Me and Priya reviewed it yesterday and the results is really good. We should utilize the new data in order to make a decision by Friday.',
      },
    ],
  },
  {
    kind: 'paragraph',
    runs: [
      {
        text: 'The survey was completed by over two hundred customers, and their going to share there feedback with the team next week. Less people answered the last question then we expected.',
      },
    ],
  },
  {
    kind: 'paragraph',
    runs: [{ text: 'Sorry for the late reply, I will send you my notes tommorow.' }],
  },
];

async function newDocument(init: Partial<DocRecord> = {}) {
  const doc = await createDoc(init);
  fresh.id = init.content ? '' : doc.id;
  go({ name: 'doc', id: doc.id });
}

async function openUpload(file: File) {
  try {
    const { doc, title } = await importFile(file);
    await newDocument({ title, content: doc.toJSON() });
  } catch (err) {
    toast((err as Error).message);
  }
}

function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void openUpload(f);
  };
  input.click();
}

type Sort = 'updated' | 'created' | 'title';

export function Home() {
  const [docs, setDocs] = useState<DocRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [dragging, setDragging] = useState(false);
  const reload = () => void listDocs().then((all) => setDocs(all.filter((d) => !d.deletedAt)));
  useEffect(reload, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (docs ?? []).filter(
      (d) => !q || d.title.toLowerCase().includes(q) || d.text.toLowerCase().includes(q),
    );
    if (sort === 'title') list.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
    else if (sort === 'created') list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }, [docs, query, sort]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files[0];
    if (f) void openUpload(f);
  };

  return (
    <Shell>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dropping files is a shortcut; the Upload button does the same */}
      <div
        class="ox-home"
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <header class="ox-home__head">
          <h1>Documents</h1>
          <span class="ox-grow" />
          <button type="button" class="op-btn op-btn--secondary" onClick={pickFile}>
            <Icon name="upload" size={16} />
            Upload
          </button>
          <button type="button" class="op-btn op-btn--primary" onClick={() => void newDocument()}>
            <Icon name="plus" size={16} />
            New document
          </button>
        </header>

        {docs && docs.length > 0 && (
          <div class="ox-home__tools">
            <label class="ox-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                placeholder="Search documents"
                aria-label="Search documents"
                onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
              />
            </label>
            <label class="ox-sort">
              <span>Sort by</span>
              <select
                class="op-select"
                value={sort}
                onChange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as Sort)}
              >
                <option value="updated">Last edited</option>
                <option value="created">Date created</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
        )}

        {docs === null ? null : docs.length === 0 ? (
          <div class="ox-welcome">
            <Mark size={40} />
            <h2>Write your first document</h2>
            <p>
              Start from a blank page, open a Word, OpenDocument, RTF, Markdown or text file, or try
              a sample with a few mistakes to fix. Everything stays on this computer.
            </p>
            <div class="ox-actions ox-actions--center">
              <button
                type="button"
                class="op-btn op-btn--primary"
                onClick={() => void newDocument()}
              >
                New document
              </button>
              <button type="button" class="op-btn op-btn--secondary" onClick={pickFile}>
                Upload a file
              </button>
              <button
                type="button"
                class="op-btn op-btn--ghost"
                onClick={() =>
                  void newDocument({ title: 'Project update', content: buildDoc(SAMPLE).toJSON() })
                }
              >
                Try a sample
              </button>
            </div>
          </div>
        ) : (
          <div class="ox-grid">
            {!query && (
              <button
                type="button"
                class="ox-doc-card ox-doc-card--new"
                onClick={() => void newDocument()}
              >
                <Icon name="plus" size={22} />
                New document
              </button>
            )}
            {shown.map((d) => (
              <DocCard key={d.id} doc={d} onChange={reload} />
            ))}
            {query && shown.length === 0 && (
              <p class="ox-quiet">No documents match “{query.trim()}”.</p>
            )}
          </div>
        )}

        {dragging && (
          <div class="ox-drop" aria-hidden="true">
            <Icon name="upload" size={24} />
            Drop a file to open it
          </div>
        )}
      </div>
    </Shell>
  );
}

function DocCard({ doc, onChange }: { doc: DocRecord; onChange: () => void }) {
  const title = displayTitle(doc);
  const snippet = doc.text.trim().replace(/\s+/g, ' ').slice(0, 220);
  return (
    <div class="ox-doc-card">
      <a class="ox-doc-card__link" href={`#/doc/${doc.id}`}>
        <span class="ox-doc-card__date">{when(doc.updatedAt)}</span>
        <strong class="ox-doc-card__title">{title}</strong>
        <span class="ox-doc-card__snippet">{snippet || 'Empty document'}</span>
      </a>
      <div class="ox-doc-card__foot">
        {doc.score !== null && doc.words >= 30 ? (
          <span class="ox-doc-card__score" title="Overall score">
            <ScoreRing score={doc.score} size={24} />
          </span>
        ) : null}
        <span class="ox-quiet">
          {doc.words.toLocaleString()} {doc.words === 1 ? 'word' : 'words'}
        </span>
        <span class="ox-grow" />
        <Menu label={`Actions for ${title}`} trigger={<Icon name="more" size={16} />}>
          <MenuItem icon="file" onClick={() => go({ name: 'doc', id: doc.id })}>
            Open
          </MenuItem>
          <MenuItem
            icon="download"
            onClick={() =>
              exportDoc(
                doc.content ? PMNode.fromJSON(schema, doc.content) : buildDoc([]),
                doc.title.trim(),
                'docx',
              )
            }
          >
            Download as Word
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon="trash"
            danger
            onClick={async () => {
              await trashDoc(doc.id);
              onChange();
              toast(`Moved “${title}” to the trash.`, {
                label: 'Undo',
                run: () => void restoreDoc(doc.id).then(onChange),
              });
            }}
          >
            Move to trash
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
}

export function Trash() {
  const [docs, setDocs] = useState<DocRecord[] | null>(null);
  const reload = () => void listDocs().then((all) => setDocs(all.filter((d) => d.deletedAt)));
  useEffect(reload, []);
  return (
    <Shell>
      <div class="ox-home">
        <header class="ox-home__head">
          <div>
            <h1>Trash</h1>
            <p class="ox-quiet">Documents here are deleted for good after {TRASH_DAYS} days.</p>
          </div>
          <span class="ox-grow" />
          {docs && docs.length > 0 && (
            <button
              type="button"
              class="op-btn op-btn--secondary"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Empty the trash?',
                  message: `This permanently deletes ${docs.length} ${docs.length === 1 ? 'document' : 'documents'} from this computer. It can’t be undone.`,
                  confirm: 'Empty trash',
                  danger: true,
                });
                if (!ok) return;
                await emptyTrash();
                reload();
              }}
            >
              Empty trash
            </button>
          )}
        </header>
        {docs && docs.length === 0 && <p class="ox-quiet ox-pad-top">The trash is empty.</p>}
        {docs && docs.length > 0 && (
          <ul class="ox-rows">
            {docs.map((d) => (
              <li key={d.id} class="ox-row">
                <div class="ox-row__text">
                  <strong>{displayTitle(d)}</strong>
                  <span>Deleted {when(d.deletedAt ?? d.updatedAt)}</span>
                </div>
                <button
                  type="button"
                  class="op-btn op-btn--secondary op-btn--sm"
                  onClick={async () => {
                    await restoreDoc(d.id);
                    reload();
                    toast(`Restored “${displayTitle(d)}”.`);
                  }}
                >
                  <Icon name="restore" size={15} />
                  Restore
                </button>
                <button
                  type="button"
                  class="op-btn op-btn--ghost op-btn--sm"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Delete for good?',
                      message: `“${displayTitle(d)}” will be permanently deleted from this computer.`,
                      confirm: 'Delete',
                      danger: true,
                    });
                    if (!ok) return;
                    await deleteDoc(d.id);
                    reload();
                  }}
                >
                  Delete forever
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
