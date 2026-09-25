import { download } from '@oppenly/ui/settings';
import { DOMSerializer, DOMParser as PMDOMParser, type Node as PMNode } from 'prosemirror-model';
import { schema } from '../editor/schema';
import { buildDoc, textToBlocks } from './blocks';
import { docToDocx, docxToBlocks } from './docx';
import { docToMarkdown, markdownToBlocks } from './markdown';
import { odtToBlocks } from './odt';
import { rtfToBlocks } from './rtf';

export const ACCEPT = '.docx,.odt,.rtf,.txt,.md,.markdown,.html,.htm';
export const MAX_UPLOAD = 25 * 1024 * 1024;

export interface Imported {
  doc: PMNode;
  title: string;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim();
}

function htmlToDoc(html: string): PMNode {
  // DOMParser never runs scripts; the schema keeps only supported elements and safe links.
  const dom = new DOMParser().parseFromString(html, 'text/html');
  return PMDOMParser.fromSchema(schema).parse(dom.body);
}

/** Reads an uploaded file. Everything happens in this browser; nothing is uploaded anywhere. */
export async function importFile(file: File): Promise<Imported> {
  if (file.size > MAX_UPLOAD) throw new Error('This file is larger than 25 MB.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const title = baseName(file.name);
  switch (ext) {
    case 'docx': {
      const { blocks, title: docTitle } = docxToBlocks(new Uint8Array(await file.arrayBuffer()));
      return { doc: buildDoc(blocks), title: docTitle || title };
    }
    case 'odt':
      return { doc: buildDoc(odtToBlocks(new Uint8Array(await file.arrayBuffer()))), title };
    case 'rtf':
      return { doc: buildDoc(rtfToBlocks(await file.text())), title };
    case 'md':
    case 'markdown':
      return { doc: buildDoc(markdownToBlocks(await file.text())), title };
    case 'html':
    case 'htm': {
      const html = await file.text();
      const docTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
      return { doc: htmlToDoc(html), title: docTitle || title };
    }
    case 'txt':
      return { doc: buildDoc(textToBlocks(await file.text())), title };
    case 'doc':
      throw new Error('Old Word files (.doc) are not supported. Save it as .docx and try again.');
    default:
      throw new Error('Oppenly opens .docx, .odt, .rtf, .txt, .md and .html files.');
  }
}

/** The document as plain text, with simple list markers. */
export function docToText(doc: PMNode): string {
  const lines: string[] = [];
  const walk = (node: PMNode, prefix: string) => {
    node.forEach((child) => {
      if (child.isTextblock) {
        let text = '';
        child.forEach((c) => {
          text += c.type.name === 'hard_break' ? '\n' : (c.text ?? '');
        });
        lines.push(prefix + text);
      } else if (child.type.name === 'bullet_list' || child.type.name === 'ordered_list') {
        let n = (child.attrs.order as number | undefined) ?? 1;
        child.forEach((item) => {
          const marker = child.type.name === 'ordered_list' ? `${n++}. ` : '- ';
          const sub: string[] = [];
          const start = lines.length;
          walk(item, '');
          sub.push(...lines.splice(start));
          sub.forEach((l, i) => {
            lines.push(prefix + (i === 0 ? marker : '   ') + l);
          });
        });
      } else if (child.type.name === 'horizontal_rule') lines.push('---');
      else walk(child, child.type.name === 'blockquote' ? `${prefix}> ` : prefix);
    });
  };
  walk(doc, '');
  return `${lines.join('\n')}\n`;
}

export function docToHtml(doc: PMNode, title: string): string {
  const container = document.createElement('div');
  container.append(DOMSerializer.fromSchema(schema).serializeFragment(doc.content));
  const safeTitle = title.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
body { max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem; font: 17px/1.65 Georgia, serif; color: #1f2430; }
h1, h2, h3 { font-family: system-ui, sans-serif; line-height: 1.25; }
blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #d0d5dd; color: #475467; }
a { color: #1e74fe; }
</style>
</head>
<body>
${title ? `<h1>${safeTitle}</h1>\n` : ''}${container.innerHTML}
</body>
</html>
`;
}

/** A file name that is valid on Windows, macOS and Linux. */
export function safeFileName(title: string, max = 120): string {
  const clean = title
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are not allowed in file names
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .trim()
    .slice(0, max);
  return clean || 'Untitled';
}

function fileName(title: string, ext: string): string {
  return `${safeFileName(title)}.${ext}`;
}

export type ExportFormat = 'docx' | 'md' | 'txt' | 'html';

export function exportDoc(doc: PMNode, title: string, format: ExportFormat): void {
  switch (format) {
    case 'docx':
      download(
        fileName(title, 'docx'),
        new Blob([docToDocx(doc, title) as BlobPart], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      );
      break;
    case 'md':
      download(
        fileName(title, 'md'),
        (title ? `# ${title}\n\n` : '') + docToMarkdown(doc),
        'text/markdown',
      );
      break;
    case 'txt':
      download(fileName(title, 'txt'), (title ? `${title}\n\n` : '') + docToText(doc));
      break;
    case 'html':
      download(fileName(title, 'html'), docToHtml(doc, title), 'text/html');
      break;
  }
}
