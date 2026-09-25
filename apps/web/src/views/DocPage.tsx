import { Icon, ScoreRing } from '@oppenly/ui';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RewritePopover, SelectionBar } from '../editor/Floating';
import { DocSession } from '../editor/session';
import { Toolbar } from '../editor/Toolbar';
import { docToText, type ExportFormat, exportDoc } from '../io/files';
import { createDoc, displayTitle, getDoc, trashDoc } from '../lib/docs';
import { go } from '../lib/router';
import { settings } from '../lib/settings';
import { toast } from '../lib/toast';
import { Panel, panel } from '../panel/Panel';
import { closeRewrite } from '../panel/rewrite-state';
import { Dialogs, dialog, openDialog } from './dialogs';
import { Menu, MenuItem, MenuSeparator } from './Menu';

/** Set by the dashboard when it creates a document, so the goals dialog can open once. */
export const fresh = { id: '' };

export function DocPage({ id }: { id: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<DocSession | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let current: DocSession | null = null;
    let cancelled = false;
    setMissing(false);
    void getDoc(id).then((doc) => {
      if (cancelled) return;
      if (!doc || doc.deletedAt) {
        setMissing(true);
        return;
      }
      current = new DocSession(mountRef.current!, doc, {
        placeholder: 'Type or paste your text here.',
        onLink: () => openDialog({ kind: 'link' }),
      });
      setSession(current);
      if (fresh.id === id) {
        fresh.id = '';
        if (settings.value.goalsOnNew) openDialog({ kind: 'goals' });
        else current.view.focus();
      } else current.view.focus();
    });
    const flush = () => void current?.save();
    window.addEventListener('pagehide', flush);
    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', flush);
      closeRewrite();
      dialog.value = null;
      void current?.close();
      setSession(null);
    };
  }, [id]);

  if (missing) {
    return (
      <div class="ox-missing">
        <h1>This document isn’t here</h1>
        <p>It may have been deleted, or it was created in a different browser.</p>
        <a class="op-btn op-btn--primary" href="#/">
          Go to documents
        </a>
      </div>
    );
  }

  return (
    <div class="ox-doc" data-panel={panel.value.open}>
      {session && <TopBar session={session} />}
      <div class="ox-doc__main">
        <div class="ox-doc__scroll">
          <div class="ox-page" style={{ '--ox-size': `${settings.value.fontSize}px` }}>
            {session && <TitleField session={session} />}
            <div ref={mountRef} class="ox-editor" />
          </div>
        </div>
        {session && <Toolbar session={session} />}
      </div>
      {session && <Panel session={session} />}
      {session && <SelectionBar session={session} />}
      {session && <RewritePopover session={session} />}
      <Dialogs session={session} />
    </div>
  );
}

function TitleField({ session }: { session: DocSession }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const title = session.record.value.title;
  // Grow with the text so long titles wrap instead of scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  return (
    <textarea
      ref={ref}
      class="ox-title"
      rows={1}
      value={title}
      placeholder="Untitled document"
      aria-label="Document title"
      spellcheck
      onInput={(e) =>
        session.setTitle((e.currentTarget as HTMLTextAreaElement).value.replace(/\n/g, ' '))
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || (e.key === 'ArrowDown' && !e.shiftKey)) {
          e.preventDefault();
          session.view.focus();
        }
      }}
    />
  );
}

function TopBar({ session }: { session: DocSession }) {
  const analysis = session.analysis.value;
  const save = session.saveState.value;
  const record = session.record.value;
  const title = displayTitle(record);

  const doExport = (format: ExportFormat) =>
    exportDoc(session.view.state.doc, record.title.trim(), format);
  const print = () => {
    const previous = document.title;
    document.title = title;
    window.print();
    document.title = previous;
  };

  return (
    <header class="ox-top">
      <a class="ox-top__back" href="#/" title="All documents">
        <Icon name="chevronLeft" size={18} />
        <span>Documents</span>
      </a>
      <span class="ox-save" data-state={save} aria-live="polite">
        {save === 'saving'
          ? 'Saving…'
          : save === 'error'
            ? 'Not saved: storage is full or blocked'
            : 'Saved on this computer'}
      </span>
      <span class="ox-grow" />

      <button type="button" class="ox-top__btn" onClick={() => openDialog({ kind: 'goals' })}>
        <Icon name="target" size={16} />
        Goals
      </button>
      <button
        type="button"
        class="ox-top__score"
        title="Overall score. Click for performance."
        onClick={() => openDialog({ kind: 'performance' })}
      >
        <ScoreRing score={analysis?.score ?? null} size={32} />
        <span>Overall score</span>
      </button>

      <Menu label="Document menu" trigger={<Icon name="more" size={18} />}>
        <MenuItem
          icon="plus"
          onClick={async () => {
            const doc = await createDoc();
            fresh.id = doc.id;
            go({ name: 'doc', id: doc.id });
          }}
        >
          New document
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon="download" onClick={() => doExport('docx')}>
          Download as Word (.docx)
        </MenuItem>
        <MenuItem icon="download" onClick={() => doExport('md')}>
          Download as Markdown (.md)
        </MenuItem>
        <MenuItem icon="download" onClick={() => doExport('txt')}>
          Download as plain text (.txt)
        </MenuItem>
        <MenuItem icon="download" onClick={() => doExport('html')}>
          Download as web page (.html)
        </MenuItem>
        <MenuItem icon="printer" onClick={print}>
          Print or save as PDF
        </MenuItem>
        <MenuItem
          icon="copy"
          onClick={async () => {
            await navigator.clipboard.writeText(docToText(session.view.state.doc));
            toast('Copied the text to your clipboard.');
          }}
        >
          Copy all text
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon="trash"
          danger
          onClick={async () => {
            await session.save();
            await trashDoc(record.id);
            toast(`Moved “${title}” to the trash.`);
            go({ name: 'home' });
          }}
        >
          Move to trash
        </MenuItem>
      </Menu>

      {!panel.value.open && (
        <button
          type="button"
          class="ox-top__assistant"
          onClick={() => {
            panel.value = { ...panel.value, open: true };
          }}
        >
          <span class="ox-count" data-zero={session.suggestions.value.length === 0}>
            {session.suggestions.value.length}
          </span>
          Open assistant
        </button>
      )}
    </header>
  );
}
