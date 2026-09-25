/** Decide which elements Oppenly checks. */

const TEXT_INPUT_TYPES = new Set(['text', '']);

/** Code editors and fields where grammar suggestions would be wrong or unwanted. */
const EXCLUDED_ANCESTORS =
  '.cm-editor, .CodeMirror, .monaco-editor, .ace_editor, .ql-code-block, pre, code, [data-oppenly="false"]';

/** Opt-out attributes sites already set for grammar extensions. We honour all of them. */
function optedOut(el: Element): boolean {
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (
      node.getAttribute('data-gramm') === 'false' ||
      node.getAttribute('data-gramm_editor') === 'false' ||
      node.getAttribute('data-enable-grammarly') === 'false' ||
      node.getAttribute('data-oppenly') === 'false'
    ) {
      return true;
    }
  }
  return false;
}

/** Never check secrets. Single-line inputs also skip searches, logins and contact details. */
const SECRET = /pass|pwd|secret|token|otp|one-time|captcha|card|cvc|cvv|ssn|iban/i;
const NOT_PROSE = /search|query|username|login|email|phone|tel\b|zip|postal|url|address|name$/i;

function looksSensitive(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  const hints = [
    el.name,
    el.id,
    el.getAttribute('autocomplete') ?? '',
    el.getAttribute('aria-label') ?? '',
    el.placeholder,
  ];
  if (hints.some((h) => SECRET.test(h))) return true;
  return el instanceof HTMLInputElement && hints.some((h) => NOT_PROSE.test(h));
}

export type FieldKind = 'textarea' | 'input' | 'contenteditable';

export function kindOf(el: HTMLElement): FieldKind | null {
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type) ? 'input' : null;
  if (el.isContentEditable) return 'contenteditable';
  return null;
}

/** For contenteditable, the outermost editable element (the editor root). */
function editableRootOf(el: HTMLElement): HTMLElement {
  let root = el;
  while (root.parentElement?.isContentEditable) root = root.parentElement;
  return root;
}

/** Resolve the field Oppenly should attach to for a focused element, or null. */
export function fieldFor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const kind = kindOf(target);
  if (!kind) return null;
  const el = kind === 'contenteditable' ? editableRootOf(target) : target;
  if (!isSupported(el, kind)) return null;
  return el;
}

export function isSupported(el: HTMLElement, kind: FieldKind): boolean {
  if (optedOut(el)) return false;
  if (el.closest(EXCLUDED_ANCESTORS)) return false;
  if (kind !== 'contenteditable') {
    const f = el as HTMLInputElement | HTMLTextAreaElement;
    if (f.readOnly || f.disabled) return false;
    if (looksSensitive(f)) return false;
  }
  if (el.getAttribute('role') === 'combobox' || el.getAttribute('role') === 'searchbox')
    return false;
  const rect = el.getBoundingClientRect();
  if (kind === 'input' && rect.width < 200) return false;
  if (rect.width < 80 || rect.height < 16) return false;
  return true;
}

/** Nearest opaque background colour, to match light or dark UI to the page. */
export function prefersDark(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (!m) continue;
    const alpha = m[4] === undefined ? 1 : Number(m[4]);
    if (alpha < 0.5) continue;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.42;
  }
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  return scheme.includes('dark') && !scheme.includes('light');
}
