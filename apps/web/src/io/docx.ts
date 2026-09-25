import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Mark, Node as PMNode } from 'prosemirror-model';
import type { Block, Run } from './blocks';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// ---------- Reading ----------

function attr(el: Element | null | undefined, name: string): string | null {
  return el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null;
}

function child(el: Element, name: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
}

/** On/off properties like <w:b/> or <w:b w:val="0"/>. */
function on(props: Element | null, name: string): boolean {
  const el = props ? child(props, name) : null;
  if (!el) return false;
  const v = attr(el, 'val');
  return v === null || !['0', 'false', 'none'].includes(v);
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** Reads a .docx file into blocks: paragraphs, headings, lists, quotes and inline formatting. */
export function docxToBlocks(data: Uint8Array): { blocks: Block[]; title: string } {
  const files = unzipSync(data, {
    filter: (f) =>
      f.name === 'word/document.xml' ||
      f.name === 'word/numbering.xml' ||
      f.name === 'word/styles.xml' ||
      f.name === 'word/_rels/document.xml.rels' ||
      f.name === 'docProps/core.xml',
  });
  const main = files['word/document.xml'];
  if (!main) throw new Error('This file is not a Word document.');
  const doc = parseXml(strFromU8(main));

  const links = new Map<string, string>();
  const rels = files['word/_rels/document.xml.rels'];
  if (rels) {
    for (const rel of Array.from(parseXml(strFromU8(rels)).getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('TargetMode') === 'External')
        links.set(rel.getAttribute('Id') ?? '', rel.getAttribute('Target') ?? '');
    }
  }

  // Which numbering ids are ordered (decimal etc.) rather than bullets, per level.
  const ordered = new Map<string, boolean>();
  const numbering = files['word/numbering.xml'];
  if (numbering) {
    const n = parseXml(strFromU8(numbering));
    const abstract = new Map<string, Element>();
    for (const a of Array.from(n.getElementsByTagNameNS(W, 'abstractNum')))
      abstract.set(attr(a, 'abstractNumId') ?? '', a);
    for (const num of Array.from(n.getElementsByTagNameNS(W, 'num'))) {
      const id = attr(num, 'numId') ?? '';
      const abs = abstract.get(attr(child(num, 'abstractNumId'), 'val') ?? '');
      if (!abs) continue;
      for (const lvl of Array.from(abs.getElementsByTagNameNS(W, 'lvl'))) {
        const fmt = attr(child(lvl, 'numFmt'), 'val') ?? 'bullet';
        ordered.set(`${id}:${attr(lvl, 'ilvl')}`, fmt !== 'bullet' && fmt !== 'none');
      }
    }
  }

  // Style ids of headings, titles and quotes (ids differ by language, names do not).
  const styleKind = new Map<string, { heading?: number; quote?: boolean }>();
  const styles = files['word/styles.xml'];
  if (styles) {
    for (const st of Array.from(parseXml(strFromU8(styles)).getElementsByTagNameNS(W, 'style'))) {
      const id = attr(st, 'styleId') ?? '';
      const name = (attr(child(st, 'name'), 'val') ?? '').toLowerCase();
      const h = /^heading ([1-9])$/.exec(name);
      if (h) styleKind.set(id, { heading: Math.min(3, Number(h[1])) });
      else if (name === 'title') styleKind.set(id, { heading: 1 });
      else if (name === 'subtitle') styleKind.set(id, { heading: 2 });
      else if (name === 'quote' || name === 'intense quote') styleKind.set(id, { quote: true });
    }
  }

  const blocks: Block[] = [];
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) return { blocks, title: '' };

  const readRuns = (el: Element, href?: string): Run[] => {
    const runs: Run[] = [];
    for (const node of Array.from(el.children)) {
      if (node.localName === 'hyperlink') {
        const id = node.getAttributeNS(R, 'id') ?? node.getAttribute('r:id') ?? '';
        runs.push(...readRuns(node, links.get(id)));
      } else if (
        node.localName === 'ins' ||
        node.localName === 'smartTag' ||
        node.localName === 'sdt'
      ) {
        runs.push(
          ...readRuns(node.localName === 'sdt' ? (child(node, 'sdtContent') ?? node) : node, href),
        );
      } else if (node.localName === 'r') {
        const props = child(node, 'rPr');
        const fmt = {
          bold: on(props, 'b'),
          italic: on(props, 'i'),
          underline: Boolean(
            props && child(props, 'u') && attr(child(props, 'u'), 'val') !== 'none',
          ),
          strike: on(props, 'strike') || on(props, 'dstrike'),
          href,
        };
        for (const part of Array.from(node.children)) {
          if (part.localName === 't') runs.push({ ...fmt, text: part.textContent ?? '' });
          else if (part.localName === 'tab') runs.push({ ...fmt, text: '\t' });
          else if (part.localName === 'br' || part.localName === 'cr')
            runs.push({ text: '', br: true });
          else if (part.localName === 'noBreakHyphen') runs.push({ ...fmt, text: '-' });
        }
      }
    }
    return runs;
  };

  const readParagraph = (p: Element) => {
    const props = child(p, 'pPr');
    const styleId = attr(child(props ?? p, 'pStyle'), 'val') ?? '';
    const kind = styleKind.get(styleId) ?? {};
    const numPr = props ? child(props, 'numPr') : null;
    const runs = readRuns(p);
    if (numPr) {
      const numId = attr(child(numPr, 'numId'), 'val') ?? '';
      const level = Number(attr(child(numPr, 'ilvl'), 'val') ?? 0);
      if (numId !== '0') {
        blocks.push({
          kind: 'item',
          list: ordered.get(`${numId}:${level}`) ? 'ordered' : 'bullet',
          depth: level,
          runs,
        });
        return;
      }
    }
    if (kind.heading) blocks.push({ kind: 'heading', level: kind.heading, runs });
    else if (kind.quote) blocks.push({ kind: 'quote', runs });
    else blocks.push({ kind: 'paragraph', runs });
  };

  const walk = (el: Element) => {
    for (const node of Array.from(el.children)) {
      if (node.localName === 'p') readParagraph(node);
      else if (node.localName === 'tbl') {
        // Tables become one paragraph per cell paragraph.
        for (const p of Array.from(node.getElementsByTagNameNS(W, 'p'))) readParagraph(p);
      } else if (node.localName === 'sdt') walk(child(node, 'sdtContent') ?? node);
    }
  };
  walk(body);

  let title = '';
  const core = files['docProps/core.xml'];
  if (core)
    title = parseXml(strFromU8(core)).getElementsByTagName('dc:title')[0]?.textContent ?? '';
  return { blocks, title: title.trim() };
}

// ---------- Writing ----------

function esc(text: string): string {
  return (
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // Characters XML 1.0 does not allow.
      // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}

interface WriteState {
  links: string[];
  lists: { start: number }[];
}

function runsXml(node: PMNode, state: WriteState): string {
  let out = '';
  node.forEach((c) => {
    if (c.type.name === 'hard_break') {
      out += '<w:r><w:br/></w:r>';
      return;
    }
    const has = (name: string) => c.marks.some((m: Mark) => m.type.name === name);
    const link = c.marks.find((m: Mark) => m.type.name === 'link');
    let props = '';
    if (link) props += '<w:rStyle w:val="Hyperlink"/>';
    if (has('strong')) props += '<w:b/>';
    if (has('em')) props += '<w:i/>';
    if (has('strike')) props += '<w:strike/>';
    if (has('underline')) props += '<w:u w:val="single"/>';
    const parts = (c.text ?? '').split('\t');
    let run = `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}`;
    parts.forEach((part, i) => {
      if (i) run += '<w:tab/>';
      if (part) run += `<w:t xml:space="preserve">${esc(part)}</w:t>`;
    });
    run += '</w:r>';
    if (link) {
      state.links.push(String(link.attrs.href));
      out += `<w:hyperlink r:id="rIdLink${state.links.length}">${run}</w:hyperlink>`;
    } else out += run;
  });
  return out;
}

function paragraphXml(node: PMNode, state: WriteState, pPr = ''): string {
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runsXml(node, state)}</w:p>`;
}

function blockXml(
  node: PMNode,
  state: WriteState,
  ctx: { quote?: boolean; list?: { numId: number; level: number } },
): string {
  switch (node.type.name) {
    case 'heading':
      return paragraphXml(node, state, `<w:pStyle w:val="Heading${node.attrs.level}"/>`);
    case 'paragraph': {
      if (ctx.list)
        return paragraphXml(
          node,
          state,
          `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${ctx.list.level}"/><w:numId w:val="${ctx.list.numId}"/></w:numPr>`,
        );
      return paragraphXml(node, state, ctx.quote ? '<w:pStyle w:val="Quote"/>' : '');
    }
    case 'horizontal_rule':
      return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
    case 'blockquote': {
      let out = '';
      node.forEach((c) => {
        out += blockXml(c, state, { ...ctx, quote: true });
      });
      return out;
    }
    case 'bullet_list':
    case 'ordered_list': {
      const level = ctx.list ? ctx.list.level + 1 : 0;
      let numId = 1;
      if (node.type.name === 'ordered_list') {
        state.lists.push({ start: (node.attrs.order as number) ?? 1 });
        numId = state.lists.length + 1;
      }
      let out = '';
      node.forEach((item) => {
        item.forEach((c, _o, i) => {
          if (i === 0 && c.type.name === 'paragraph')
            out += blockXml(c, state, { ...ctx, list: { numId, level } });
          else out += blockXml(c, state, { ...ctx, list: { numId, level: level } });
        });
      });
      return out;
    }
  }
  return '';
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="12" w:color="BFBFBF"/></w:pBdr></w:pPr><w:rPr><w:i/><w:color w:val="595959"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="1E74FE"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

function levels(format: 'bullet' | 'decimal'): string {
  const bullets = ['•', '◦', '▪'];
  let out = '';
  for (let l = 0; l < 9; l++) {
    const text = format === 'bullet' ? bullets[l % 3] : `%${l + 1}.`;
    const fmt = format === 'bullet' ? 'bullet' : ['decimal', 'lowerLetter', 'lowerRoman'][l % 3];
    out += `<w:lvl w:ilvl="${l}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (l + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  }
  return out;
}

function numberingXml(lists: { start: number }[]): string {
  let nums = '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
  lists.forEach((l, i) => {
    nums += `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${l.start}"/></w:lvlOverride></w:num>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels('bullet')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels('decimal')}</w:abstractNum>${nums}</w:numbering>`;
}

/** Writes an editor document as a Word (.docx) file. */
export function docToDocx(doc: PMNode, title: string): Uint8Array {
  const state: WriteState = { links: [], lists: [] };
  let body = '';
  doc.forEach((node) => {
    body += blockXml(node, state, {});
  });
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const links = state.links
    .map(
      (href, i) =>
        `<Relationship Id="rIdLink${i + 1}" Type="${R}/hyperlink" Target="${esc(href)}" TargetMode="External"/>`,
    )
    .join('');
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`),
    'word/document.xml': strToU8(document),
    'word/styles.xml': strToU8(STYLES),
    'word/numbering.xml': strToU8(numberingXml(state.lists)),
    'word/_rels/document.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="${R}/numbering" Target="numbering.xml"/>${links}</Relationships>`),
  };
  return zipSync(files, { level: 6 });
}
