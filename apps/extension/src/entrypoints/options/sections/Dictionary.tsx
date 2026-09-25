import { Icon } from '@oppenly/ui';
import { useState } from 'preact/hooks';
import type { SectionProps } from './types';

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Dictionary({ settings, update }: SectionProps) {
  const [word, setWord] = useState('');
  const [filter, setFilter] = useState('');
  const words = [...settings.dictionary].sort((a, b) => a.localeCompare(b));
  const shown = filter
    ? words.filter((w) => w.toLowerCase().includes(filter.toLowerCase()))
    : words;

  const add = (e: Event) => {
    e.preventDefault();
    const clean = word.trim();
    if (!clean || /\s/.test(clean)) return;
    void update((s) => ({ dictionary: [...new Set([...s.dictionary, clean])] }));
    setWord('');
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const list = text
      .split(/\r?\n/)
      .map((w) => w.trim())
      .filter((w) => w && !/\s/.test(w));
    await update((s) => ({ dictionary: [...new Set([...s.dictionary, ...list])] }));
  };

  return (
    <>
      <header class="os-title">
        <h1>Personal dictionary</h1>
        <p>
          Words here are never marked as misspelled: names, product terms, jargon. Stored on this
          computer only.
        </p>
      </header>

      <section class="os-panel">
        <form class="os-body" onSubmit={add}>
          <div class="op-field">
            <label class="op-label" for="new-word">
              Add a word
            </label>
            <div class="os-inline">
              <input
                id="new-word"
                class="op-input"
                value={word}
                placeholder="For example: Oppenly"
                autocomplete="off"
                spellcheck={false}
                onInput={(e) => setWord((e.currentTarget as HTMLInputElement).value)}
              />
              <button
                type="submit"
                class="op-btn op-btn--primary"
                disabled={!word.trim() || /\s/.test(word.trim())}
              >
                Add
              </button>
            </div>
            {/\s/.test(word.trim()) && <span class="op-hint">Add one word at a time.</span>}
          </div>
        </form>
      </section>

      <section class="os-panel">
        <div class="os-row">
          <div class="os-row__text">
            <strong>
              {words.length} {words.length === 1 ? 'word' : 'words'}
            </strong>
          </div>
          <div class="os-actions">
            <label class="op-btn op-btn--secondary op-btn--sm">
              <Icon name="upload" size={16} />
              Import
              <input
                type="file"
                accept=".txt,text/plain"
                hidden
                onChange={(e) => {
                  const f = (e.currentTarget as HTMLInputElement).files?.[0];
                  if (f) void importFile(f);
                }}
              />
            </label>
            <button
              type="button"
              class="op-btn op-btn--secondary op-btn--sm"
              disabled={!words.length}
              onClick={() => download('oppenly-dictionary.txt', words.join('\n'))}
            >
              <Icon name="download" size={16} />
              Export
            </button>
          </div>
        </div>
        {words.length > 12 && (
          <div class="os-body" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <input
              class="op-input"
              placeholder="Search your dictionary"
              value={filter}
              onInput={(e) => setFilter((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
        )}
        {words.length === 0 ? (
          <p class="os-empty">
            Your dictionary is empty. Add words here or choose “Add to dictionary” on a spelling
            suggestion.
          </p>
        ) : (
          <div class="os-body">
            <div class="os-tags">
              {shown.map((w) => (
                <span key={w} class="os-tag">
                  {w}
                  <button
                    type="button"
                    aria-label={`Remove ${w}`}
                    onClick={() =>
                      void update((s) => ({ dictionary: s.dictionary.filter((x) => x !== w) }))
                    }
                  >
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
