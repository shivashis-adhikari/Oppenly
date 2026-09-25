import { strFromU8, unzipSync } from 'fflate';
import type { Block, Run } from './blocks';

const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const STYLE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const XLINK = 'http://www.w3.org/1999/xlink';

interface Format {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

/** Reads an OpenDocument text file (.odt from LibreOffice, Google Docs and others). */
export function odtToBlocks(data: Uint8Array): Block[] {
  const files = unzipSync(data, {
    filter: (f) => f.name === 'content.xml' || f.name === 'styles.xml',
  });
  const content = files['content.xml'];
  if (!content) throw new Error('This file is not an OpenDocument text file.');
  const doc = new DOMParser().parseFromString(strFromU8(content), 'application/xml');

  // Character formats and list kinds defined by automatic styles.
  const formats = new Map<string, Format>();
  const orderedLists = new Set<string>();
  const readStyles = (root: Document) => {
    for (const st of Array.from(root.getElementsByTagNameNS(STYLE, 'style'))) {
      const props = st.getElementsByTagNameNS(STYLE, 'text-properties')[0];
      if (!props) continue;
      const weight = props.getAttributeNS(FO, 'font-weight');
      const underline = props.getAttributeNS(STYLE, 'text-underline-style');
      const strike = props.getAttributeNS(STYLE, 'text-line-through-style');
      formats.set(st.getAttributeNS(STYLE, 'name') ?? '', {
        bold: weight === 'bold' || Number(weight) >= 600,
        italic: props.getAttributeNS(FO, 'font-style') === 'italic',
        underline: Boolean(underline && underline !== 'none'),
        strike: Boolean(strike && strike !== 'none'),
      });
    }
    for (const ls of Array.from(root.getElementsByTagNameNS(TEXT, 'list-style'))) {
      const first = ls.firstElementChild;
      if (first?.localName === 'list-level-style-number')
        orderedLists.add(ls.getAttributeNS(STYLE, 'name') ?? '');
    }
  };
  readStyles(doc);
  const stylesXml = files['styles.xml'];
  if (stylesXml)
    readStyles(new DOMParser().parseFromString(strFromU8(stylesXml), 'application/xml'));

  const runsOf = (el: Element, fmt: Format, href?: string): Run[] => {
    const runs: Run[] = [];
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        runs.push({ ...fmt, href, text: node.textContent ?? '' });
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const e = node as Element;
      if (e.namespaceURI !== TEXT) continue;
      switch (e.localName) {
        case 'span': {
          const style = formats.get(e.getAttributeNS(TEXT, 'style-name') ?? '') ?? {};
          runs.push(...runsOf(e, { ...fmt, ...pick(style) }, href));
          break;
        }
        case 'a':
          runs.push(...runsOf(e, fmt, e.getAttributeNS(XLINK, 'href') ?? undefined));
          break;
        case 's':
          runs.push({ ...fmt, href, text: ' '.repeat(Number(e.getAttributeNS(TEXT, 'c') ?? 1)) });
          break;
        case 'tab':
          runs.push({ ...fmt, href, text: '\t' });
          break;
        case 'line-break':
          runs.push({ text: '', br: true });
          break;
        case 'note':
        case 'bookmark':
        case 'bookmark-start':
        case 'bookmark-end':
          break;
        default:
          runs.push(...runsOf(e, fmt, href));
      }
    }
    return runs;
  };

  const blocks: Block[] = [];
  const walk = (el: Element, list?: { kind: 'bullet' | 'ordered'; depth: number }) => {
    for (const node of Array.from(el.children)) {
      if (node.namespaceURI !== TEXT) {
        if (
          node.localName === 'table' ||
          node.localName === 'table-row' ||
          node.localName === 'table-cell'
        )
          walk(node, list);
        continue;
      }
      const baseFmt = pick(formats.get(node.getAttributeNS(TEXT, 'style-name') ?? '') ?? {});
      if (node.localName === 'h') {
        const level = Number(node.getAttributeNS(TEXT, 'outline-level') ?? 1);
        blocks.push({ kind: 'heading', level: Math.min(3, level), runs: runsOf(node, baseFmt) });
      } else if (node.localName === 'p') {
        const runs = runsOf(node, baseFmt);
        if (list) blocks.push({ kind: 'item', list: list.kind, depth: list.depth, runs });
        else blocks.push({ kind: 'paragraph', runs });
      } else if (node.localName === 'list') {
        const style = node.getAttributeNS(TEXT, 'style-name') ?? '';
        const kind = list && !style ? list.kind : orderedLists.has(style) ? 'ordered' : 'bullet';
        const depth = list ? list.depth + 1 : 0;
        for (const item of Array.from(node.children)) walk(item, { kind, depth: list ? depth : 0 });
      } else if (node.localName === 'list-item' || node.localName === 'section') {
        walk(node, list);
      }
    }
  };
  const body = doc.getElementsByTagNameNS(
    'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
    'text',
  )[0];
  if (body) walk(body);
  return blocks;
}

/** Only the formats a style turns on, so plain styles do not switch inherited ones off. */
function pick(f: Format): Format {
  const out: Format = {};
  if (f.bold) out.bold = true;
  if (f.italic) out.italic = true;
  if (f.underline) out.underline = true;
  if (f.strike) out.strike = true;
  return out;
}
