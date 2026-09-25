import type { Block, Run } from './blocks';

// Destinations whose content is not document text.
const SKIP = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'headerl',
  'headerr',
  'headerf',
  'footer',
  'footerl',
  'footerr',
  'footerf',
  'footnote',
  'listtable',
  'listoverridetable',
  'rsidtbl',
  'generator',
  'xmlnstbl',
  'themedata',
  'colorschememapping',
  'latentstyles',
  'datastore',
  'fldinst',
  'pntext',
  'pntxta',
  'pntxtb',
]);

interface GroupState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  skip: boolean;
  /** Characters to skip after a \u escape. */
  uc: number;
}

/** Windows-1252 bytes 0x80-0x9F, which differ from Latin-1. */
const CP1252: Record<number, string> = {
  128: '€',
  130: '‚',
  131: 'ƒ',
  132: '„',
  133: '…',
  134: '†',
  135: '‡',
  136: 'ˆ',
  137: '‰',
  138: 'Š',
  139: '‹',
  140: 'Œ',
  142: 'Ž',
  145: '‘',
  146: '’',
  147: '“',
  148: '”',
  149: '•',
  150: '–',
  151: '—',
  152: '˜',
  153: '™',
  154: 'š',
  155: '›',
  156: 'œ',
  158: 'ž',
  159: 'Ÿ',
};

/** Reads the text and basic formatting (bold, italic, underline, strike) of an RTF file. */
export function rtfToBlocks(source: string): Block[] {
  if (!source.startsWith('{\\rtf')) throw new Error('This file is not a Rich Text document.');
  const blocks: Block[] = [];
  let runs: Run[] = [];
  const stack: GroupState[] = [];
  let st: GroupState = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    skip: false,
    uc: 1,
  };
  let pendingSkip = 0;

  const emit = (text: string) => {
    if (st.skip || !text) return;
    if (pendingSkip > 0) {
      const drop = Math.min(pendingSkip, text.length);
      pendingSkip -= drop;
      text = text.slice(drop);
      if (!text) return;
    }
    const last = runs[runs.length - 1];
    const fmt = { bold: st.bold, italic: st.italic, underline: st.underline, strike: st.strike };
    if (
      last &&
      !last.br &&
      last.bold === fmt.bold &&
      last.italic === fmt.italic &&
      last.underline === fmt.underline &&
      last.strike === fmt.strike
    )
      last.text += text;
    else runs.push({ ...fmt, text });
  };
  const endParagraph = () => {
    if (st.skip) return;
    blocks.push({ kind: 'paragraph', runs });
    runs = [];
  };

  let i = 0;
  let groupStart = false;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === '{') {
      stack.push(st);
      st = { ...st };
      groupStart = true;
      i++;
      continue;
    }
    if (ch === '}') {
      st = stack.pop() ?? st;
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = source[i + 1] ?? '';
      if (next === '\\' || next === '{' || next === '}') {
        emit(next);
        i += 2;
      } else if (next === "'") {
        const code = Number.parseInt(source.slice(i + 2, i + 4), 16);
        emit(CP1252[code] ?? String.fromCharCode(code));
        i += 4;
      } else if (next === '*') {
        st.skip = true;
        i += 2;
      } else if (next === '~') {
        emit('\u00a0');
        i += 2;
      } else if (next === '-' || next === '_') {
        if (next === '_') emit('-');
        i += 2;
      } else if (next === '\n' || next === '\r') {
        endParagraph();
        i += 2;
      } else {
        const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(source.slice(i + 1, i + 40));
        if (!m) {
          i += 2;
          continue;
        }
        const word = m[1]!;
        const arg = m[2] === undefined ? null : Number(m[2]);
        i += 1 + m[0].length;
        if (groupStart && SKIP.has(word)) st.skip = true;
        groupStart = false;
        switch (word) {
          case 'par':
          case 'sect':
            endParagraph();
            break;
          case 'line':
            if (!st.skip) runs.push({ text: '', br: true });
            break;
          case 'tab':
            emit('\t');
            break;
          case 'emdash':
            emit('—');
            break;
          case 'endash':
            emit('–');
            break;
          case 'lquote':
            emit('‘');
            break;
          case 'rquote':
            emit('’');
            break;
          case 'ldblquote':
            emit('“');
            break;
          case 'rdblquote':
            emit('”');
            break;
          case 'bullet':
            emit('•');
            break;
          case 'b':
            st.bold = arg !== 0;
            break;
          case 'i':
            st.italic = arg !== 0;
            break;
          case 'ul':
            st.underline = arg !== 0;
            break;
          case 'ulnone':
            st.underline = false;
            break;
          case 'strike':
            st.strike = arg !== 0;
            break;
          case 'plain':
            st = { ...st, bold: false, italic: false, underline: false, strike: false };
            break;
          case 'uc':
            st.uc = arg ?? 1;
            break;
          case 'u': {
            const code = arg === null ? 63 : arg < 0 ? arg + 65536 : arg;
            emit(String.fromCharCode(code));
            pendingSkip = st.uc;
            break;
          }
        }
      }
      continue;
    }
    groupStart = false;
    if (ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    // Plain text up to the next control character.
    let j = i;
    while (j < source.length && !'\\{}\r\n'.includes(source[j]!)) j++;
    emit(source.slice(i, j));
    i = j;
  }
  if (runs.length) endParagraph();
  // Drop the empty trailing paragraph most RTF writers add.
  while (blocks.length && blocks[blocks.length - 1]!.runs.every((r) => !r.text.trim() && !r.br))
    blocks.pop();
  return blocks;
}
