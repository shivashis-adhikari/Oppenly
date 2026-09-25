import { Icon, type IconName } from '@oppenly/ui';
import type { Command } from 'prosemirror-state';
import { openDialog } from '../views/dialogs';
import { schema } from './schema';
import type { DocSession } from './session';
import {
  clearFormatting,
  toggleBold,
  toggleHeading,
  toggleItalic,
  toggleList,
  toggleUnderline,
} from './setup';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

export function Toolbar({ session }: { session: DocSession }) {
  const f = session.formatting.value;
  const words = session.analysis.value?.stats.words ?? 0;
  const run = (cmd: Command) => {
    cmd(session.view.state, session.view.dispatch, session.view);
    session.view.focus();
  };
  const btn = (icon: IconName, label: string, keys: string, on: boolean, action: () => void) => (
    <button
      type="button"
      class="ox-tool"
      aria-label={label}
      title={`${label} (${keys})`}
      aria-pressed={on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      <Icon name={icon} size={18} />
    </button>
  );

  return (
    <div class="ox-toolbar" role="toolbar" aria-label="Formatting">
      <button
        type="button"
        class="ox-words"
        title="See performance"
        onClick={() => openDialog({ kind: 'performance' })}
      >
        {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        <Icon name="chevronDown" size={14} />
      </button>
      <span class="ox-toolbar__sep" />
      {btn('bold', 'Bold', `${mod}B`, f.bold, () => run(toggleBold))}
      {btn('italic', 'Italic', `${mod}I`, f.italic, () => run(toggleItalic))}
      {btn('underline', 'Underline', `${mod}U`, f.underline, () => run(toggleUnderline))}
      <span class="ox-toolbar__sep" />
      <button
        type="button"
        class="ox-tool ox-tool--text"
        aria-label="Heading 1"
        title={`Heading 1 (${mod}Alt+1)`}
        aria-pressed={f.block === 'heading1'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run(toggleHeading(1))}
      >
        H1
      </button>
      <button
        type="button"
        class="ox-tool ox-tool--text"
        aria-label="Heading 2"
        title={`Heading 2 (${mod}Alt+2)`}
        aria-pressed={f.block === 'heading2'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run(toggleHeading(2))}
      >
        H2
      </button>
      {btn('link', 'Link', `${mod}K`, f.link, () => openDialog({ kind: 'link' }))}
      <span class="ox-toolbar__sep" />
      {btn('listNumber', 'Numbered list', `${mod}Shift+7`, f.block === 'ordered_list', () =>
        run(toggleList(schema.nodes.ordered_list)),
      )}
      {btn('listBullet', 'Bulleted list', `${mod}Shift+8`, f.block === 'bullet_list', () =>
        run(toggleList(schema.nodes.bullet_list)),
      )}
      <span class="ox-toolbar__sep ox-toolbar__sep--wide" />
      {btn('clearFormat', 'Clear formatting', `${mod}\\`, false, () => run(clearFormatting))}
    </div>
  );
}
