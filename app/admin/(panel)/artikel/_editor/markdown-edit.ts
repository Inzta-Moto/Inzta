// Toolbar transforms for the Markdown textarea. Each returns the replacement for a range of the text plus
// the selection to restore, so applyEdit() can insert it in a way the browser's undo history keeps.

export interface TextEdit {
  start: number;
  end: number;
  text: string;
  selectStart: number;
  selectEnd: number;
}

function lineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  // A selection ending right after a newline does not include the next line.
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', effectiveEnd);
  return { lineStart, lineEnd: nl === -1 ? value.length : nl };
}

const HEADING_RE = /^ {0,3}#{1,6}[ \t]+/;
const LIST_RE = /^ {0,3}(?:[-*+]|\d+[.)])[ \t]+/;

export function headingEdit(value: string, start: number, end: number, level: 2 | 3): TextEdit {
  const { lineStart, lineEnd } = lineRange(value, start, end);
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const prefix = `${'#'.repeat(level)} `;
  const allAtLevel = lines.every(l => l.startsWith(prefix) && !l.startsWith(prefix + '#'));
  const text = lines.map(l => (allAtLevel ? l.slice(prefix.length) : prefix + l.replace(HEADING_RE, ''))).join('\n');
  return { start: lineStart, end: lineEnd, text, selectStart: lineStart, selectEnd: lineStart + text.length };
}

export function listEdit(value: string, start: number, end: number, ordered: boolean): TextEdit {
  const { lineStart, lineEnd } = lineRange(value, start, end);
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const isKind = (l: string) => (ordered ? /^\d+[.)][ \t]/.test(l) : /^[-*+][ \t]/.test(l));
  const remove = lines.every(l => !l.trim() || isKind(l));
  let n = 0;
  const text = lines
    .map(l => {
      if (!l.trim()) return l;
      const bare = l.replace(LIST_RE, '');
      if (remove) return bare;
      n += 1;
      return (ordered ? `${n}. ` : '- ') + bare;
    })
    .join('\n');
  return { start: lineStart, end: lineEnd, text, selectStart: lineStart, selectEnd: lineStart + text.length };
}

export function wrapEdit(value: string, start: number, end: number, marker: string, placeholder: string): TextEdit {
  const selected = value.slice(start, end);
  const m = marker.length;
  // Already wrapped inside the selection: unwrap.
  if (selected.length > 2 * m && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(m, -m);
    return { start, end, text: inner, selectStart: start, selectEnd: start + inner.length };
  }
  // Wrapped just outside the selection: unwrap. A "*" next to another "*" is part of "**", not italic.
  const before = value.slice(start - m, start);
  const after = value.slice(end, end + m);
  const partOfBold = m === 1 && (value[start - 2] === '*' || value[end + 1] === '*');
  if (selected && before === marker && after === marker && !partOfBold) {
    return { start: start - m, end: end + m, text: selected, selectStart: start - m, selectEnd: end - m };
  }
  const inner = selected || placeholder;
  // Markdown emphasis cannot start or end with a space, so keep the selection's outer spaces outside.
  const lead = inner.match(/^\s*/)?.[0] ?? '';
  const trail = inner.match(/\s*$/)?.[0] ?? '';
  const core = inner.trim() || placeholder;
  const text = `${lead}${marker}${core}${marker}${trail}`;
  const selectStart = start + lead.length + m;
  return { start, end, text, selectStart, selectEnd: selectStart + core.length };
}

/** Text to insert at `pos` so that `block` sits in its own paragraph (blank line before and after). */
export function blockEdit(value: string, start: number, end: number, block: string): TextEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const text = lead + block + trail;
  const selectStart = start + lead.length + block.length;
  return { start, end, text, selectStart, selectEnd: selectStart };
}

// Link text must not close the brackets early; URLs must not contain spaces or unbalanced parentheses.
export const escapeLinkText = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1');
export const encodeLinkUrl = (s: string) => s.trim().replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

export function isAllowedLinkUrl(url: string): boolean {
  const u = url.trim();
  return /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u) || /^\/(?![\/\\])\S*$/.test(u);
}

/**
 * Applies an edit through execCommand('insertText') so Ctrl+Z works; falls back to setRangeText plus an
 * input event (which React's onChange picks up) where execCommand is unavailable.
 */
export function applyEdit(textarea: HTMLTextAreaElement, edit: TextEdit) {
  textarea.focus();
  textarea.setSelectionRange(edit.start, edit.end);
  let inserted = false;
  try {
    inserted = document.execCommand('insertText', false, edit.text);
  } catch {
    inserted = false;
  }
  if (!inserted || textarea.value.slice(edit.start, edit.start + edit.text.length) !== edit.text) {
    textarea.setRangeText(edit.text, edit.start, edit.end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  textarea.setSelectionRange(edit.selectStart, edit.selectEnd);
}
