import type { Mark, Node as PMNode } from 'prosemirror-model';
import type { Block, Run } from './blocks';

// A small Markdown reader for the common subset: headings, lists, quotes, rules, paragraphs,
// bold, italic, strikethrough, links and code (kept as plain text).

const INLINE =
  /(\*\*|__)(.+?)\1|~~(.+?)~~|(\*|_)(?!\s)(.+?)(?<!\s)\4|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|`([^`]+)`/g;

function parseInline(text: string, base: Omit<Run, 'text'> = {}): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ ...base, text: unescapeMarkdown(text.slice(last, at)) });
    if (m[2] !== undefined) runs.push(...parseInline(m[2], { ...base, bold: true }));
    else if (m[3] !== undefined) runs.push(...parseInline(m[3], { ...base, strike: true }));
    else if (m[5] !== undefined) runs.push(...parseInline(m[5], { ...base, italic: true }));
    else if (m[6] !== undefined) runs.push(...parseInline(m[6], { ...base, href: m[7] }));
    else if (m[8] !== undefined) runs.push({ ...base, text: m[8] });
    last = at + m[0].length;
  }
  if (last < text.length) runs.push({ ...base, text: unescapeMarkdown(text.slice(last)) });
  return runs;
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, '$1');
}

export function markdownToBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let fence = false;
  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', runs: parseInline(para.join(' ')) });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    if (/^\s*(```|~~~)/.test(line)) {
      flush();
      fence = !fence;
      continue;
    }
    if (fence) {
      blocks.push({ kind: 'paragraph', runs: [{ text: line }] });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: 'heading',
        level: Math.min(3, heading[1]!.length),
        runs: parseInline(heading[2]!),
      });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      blocks.push({ kind: 'hr', runs: [] });
      continue;
    }
    const quote = /^\s{0,3}>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      blocks.push({ kind: 'quote', runs: parseInline(quote[1]!) });
      continue;
    }
    const item = /^(\s*)([-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      blocks.push({
        kind: 'item',
        list: item[3] ? 'ordered' : 'bullet',
        start: item[3] ? Number(item[3]) : undefined,
        depth: Math.floor(item[1]!.length / 2),
        runs: parseInline(item[4]!),
      });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, '\\$1').replace(/^(#{1,6}\s|>|\d+\.\s|[-+]\s)/, '\\$1');
}

function inlineMarkdown(node: PMNode): string {
  let out = '';
  node.forEach((child) => {
    if (child.type.name === 'hard_break') {
      out += '  \n';
      return;
    }
    let text = escapeText(child.text ?? '');
    const has = (name: string) => child.marks.some((m: Mark) => m.type.name === name);
    if (has('strike')) text = `~~${text}~~`;
    if (has('em')) text = `*${text}*`;
    if (has('strong')) text = `**${text}**`;
    const link = child.marks.find((m: Mark) => m.type.name === 'link');
    if (link) text = `[${text}](${link.attrs.href})`;
    out += text;
  });
  // Merge touching markers from adjacent runs, e.g. "**a****b**" -> "**ab**".
  return out.replace(/\*\*\*\*/g, '').replace(/~~~~/g, '');
}

function blockMarkdown(node: PMNode, indent: string, lines: string[]): void {
  switch (node.type.name) {
    case 'heading':
      lines.push(`${'#'.repeat(node.attrs.level as number)} ${inlineMarkdown(node)}`, '');
      break;
    case 'paragraph':
      lines.push(indent + inlineMarkdown(node), '');
      break;
    case 'horizontal_rule':
      lines.push('---', '');
      break;
    case 'blockquote': {
      const inner: string[] = [];
      node.forEach((child) => {
        blockMarkdown(child, '', inner);
      });
      while (inner[inner.length - 1] === '') inner.pop();
      lines.push(...inner.map((l) => (l ? `> ${l}` : '>')), '');
      break;
    }
    case 'bullet_list':
    case 'ordered_list': {
      let n = (node.attrs.order as number | undefined) ?? 1;
      node.forEach((item) => {
        const marker = node.type.name === 'ordered_list' ? `${n++}. ` : '- ';
        item.forEach((child, _offset, i) => {
          if (i === 0 && child.type.name === 'paragraph')
            lines.push(indent + marker + inlineMarkdown(child));
          else {
            const nested: string[] = [];
            blockMarkdown(child, `${indent}  `, nested);
            lines.push(...nested.filter((l) => l !== ''));
          }
        });
      });
      lines.push('');
      break;
    }
  }
}

export function docToMarkdown(doc: PMNode): string {
  const lines: string[] = [];
  doc.forEach((node) => {
    blockMarkdown(node, '', lines);
  });
  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`;
}
