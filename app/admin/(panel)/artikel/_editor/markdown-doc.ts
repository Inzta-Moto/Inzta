// F-013 phase B: Markdown <-> visual editor document (Tiptap JSON). Pure: no DOM, no React, so the round-trip
// test runs it in Node. The parser is the marked lexer the public renderer uses (decision B-2), so the editor
// reads Markdown exactly as the page does; the serializer writes images with the phase A imageMarkdown().

import { Marked, type Token, type Tokens } from 'marked';
import type { JSONContent } from '@tiptap/core';
import { DEFAULT_LAYOUT, imageMarkdown, type BodyImage } from '@/lib/article-format';
import { attachImageLayouts, type LayoutImage } from '@/lib/markdown-layout';
import { encodeLinkUrl } from './markdown-edit';

type Mark = NonNullable<JSONContent['marks']>[number];

// Anything outside the editor's subset: the enclosing top-level block is kept verbatim as "Markdown mentah" (B-4).
class Unsupported extends Error {}
const unsupported = (): never => { throw new Unsupported(); };

// ---------------------------------------------------------------------------------------------------------
// Markdown -> document

// Named entities the editor decodes; any other named entity makes its block raw, so its rendering never changes.
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : unsupported();
    }
    return ENTITIES[e.toLowerCase()] ?? unsupported();
  });
}

const sameMarks = (a?: Mark[], b?: Mark[]) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
// Nested emphasis of the same kind ("**a **b** c**") is one mark in ProseMirror; a second copy fails the schema.
const withMark = (marks: Mark[], mark: Mark) => (marks.some(m => m.type === mark.type) ? marks : [...marks, mark]);

function inline(tokens: Token[] | undefined, marks: Mark[] = [], out: JSONContent[] = []): JSONContent[] {
  const text = (value: string) => {
    if (!value) return;
    const last = out[out.length - 1];
    if (last?.type === 'text' && sameMarks(last.marks, marks)) last.text += value;
    else out.push(marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value });
  };
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'text':
        // A soft line break inside a paragraph shows as a space on the page.
        if ((t as Tokens.Text).tokens) inline((t as Tokens.Text).tokens, marks, out);
        else text(decodeEntities((t as Tokens.Text).text).replace(/\n/g, ' '));
        break;
      case 'escape':
        text((t as Tokens.Escape).text);
        break;
      case 'strong':
        inline((t as Tokens.Strong).tokens, withMark(marks, { type: 'bold' }), out);
        break;
      case 'em':
        inline((t as Tokens.Em).tokens, withMark(marks, { type: 'italic' }), out);
        break;
      case 'link': {
        const link = t as Tokens.Link;
        if (link.title) unsupported();
        inline(link.tokens, withMark(marks, { type: 'link', attrs: { href: link.href } }), out);
        break;
      }
      case 'br':
        out.push(marks.length ? { type: 'hardBreak', marks } : { type: 'hardBreak' });
        break;
      default:
        // codespan, del, html, and images that do not stand alone (the renderer drops those with a warning).
        unsupported();
    }
  }
  return out;
}

const paragraph = (content: JSONContent[]): JSONContent => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' });
const isBlank = (t: Token) => (t.type === 'text' || t.type === 'space') && !t.raw.trim();

// Alt as the renderer reads it (text renderer over the alt tokens), without entity decoding.
const plainText = (tokens: Token[] | undefined): string =>
  (tokens ?? []).map(t => ('tokens' in t && t.tokens ? plainText(t.tokens as Token[]) : 'text' in t ? String(t.text) : '')).join('');

function imageNode(img: LayoutImage): JSONContent {
  const layout = img.layout ?? DEFAULT_LAYOUT;
  return {
    type: 'articleImage',
    attrs: { src: img.href, alt: plainText(img.tokens).trim(), caption: (img.title || '').trim(), posisi: layout.posisi, ukuran: layout.ukuran },
  };
}

function block(t: Token): JSONContent[] {
  switch (t.type) {
    case 'space':
      return [];
    case 'paragraph': {
      const tokens = (t as Tokens.Paragraph).tokens;
      const meaningful = tokens.filter(x => !isBlank(x));
      if (meaningful.length === 1 && meaningful[0].type === 'image') return [imageNode(meaningful[0] as LayoutImage)];
      return [paragraph(inline(tokens))];
    }
    case 'heading': {
      const h = t as Tokens.Heading;
      // Same levels as the renderer: "#" is shown as h2 and "####" and deeper as h3 (B-10).
      const content = inline(h.tokens);
      return [{ type: 'heading', attrs: { level: h.depth <= 2 ? 2 : 3 }, ...(content.length ? { content } : {}) }];
    }
    case 'list':
      return [listNode(t as Tokens.List)];
    case 'table':
      return [tableNode(t as Tokens.Table)];
    default:
      return unsupported();
  }
}

function listNode(list: Tokens.List): JSONContent {
  const items = list.items.map(item => {
    if (item.task) unsupported();
    const content: JSONContent[] = [];
    for (const c of item.tokens) {
      // Tight list items hold a "text" block token instead of a paragraph.
      if (c.type === 'text') content.push(paragraph(inline((c as Tokens.Text).tokens ?? [c])));
      else content.push(...block(c));
    }
    if (content.length === 0) content.push(paragraph([]));
    if (content[0].type !== 'paragraph') unsupported();
    return { type: 'listItem', content };
  });
  const attrs: Record<string, unknown> = { tight: !list.loose };
  if (list.ordered) attrs.start = typeof list.start === 'number' ? list.start : 1;
  return { type: list.ordered ? 'orderedList' : 'bulletList', attrs, content: items };
}

function tableNode(table: Tokens.Table): JSONContent {
  const row = (cells: Tokens.TableCell[], header: boolean): JSONContent => ({
    type: 'tableRow',
    content: cells.map(cell => ({ type: header ? 'tableHeader' : 'tableCell', content: [paragraph(inline(cell.tokens))] })),
  });
  return { type: 'table', content: [row(table.header, true), ...table.rows.map(r => row(r, false))] };
}

const rawNode = (raw: string): JSONContent => {
  const text = raw.replace(/\n+$/, '');
  return text ? { type: 'rawMarkdown', content: [{ type: 'text', text }] } : { type: 'rawMarkdown' };
};

/** p(m): the editor document for Markdown `md`. Never throws; anything it cannot represent becomes a raw block. */
export function markdownToDoc(md: string): JSONContent {
  const content: JSONContent[] = [];
  const marked = new Marked({ gfm: true, breaks: false, async: false });
  try {
    const tokens = marked.lexer(md || '');
    // The same walk as the renderer's walkTokens hook, so image layouts are read identically.
    marked.walkTokens(tokens, token => {
      if ('tokens' in token && Array.isArray(token.tokens)) attachImageLayouts(token.tokens);
      if (token.type === 'table') {
        const table = token as Tokens.Table;
        for (const cell of [...table.header, ...table.rows.flat()]) attachImageLayouts(cell.tokens);
      }
    });
    for (const t of tokens) {
      try {
        content.push(...block(t));
      } catch (e) {
        if (!(e instanceof Unsupported)) throw e;
        content.push(rawNode(t.raw));
      }
    }
  } catch {
    // The lexer itself failed (deeply nested lists or quotes): keep the whole body as one raw block.
    return { type: 'doc', content: [rawNode(md)] };
  }
  return { type: 'doc', content: content.length ? content : [paragraph([])] };
}

/** Number of raw blocks in a document, at any depth (a paste into a list item lands there), for the notice (9.8). */
export const countRawBlocks = (node: JSONContent): number =>
  (node.content ?? []).reduce((n, child) => n + (child.type === 'rawMarkdown' ? 1 : countRawBlocks(child)), 0);

// ---------------------------------------------------------------------------------------------------------
// Document -> Markdown

const WORD = /[\p{L}\p{N}]/u;

// Escapes text so marked reads it back as the same text (requirement 10.2). Line-start rules are applied per line.
function escapeText(s: string): string {
  return s
    .replace(/[\\`*[\]<~|]/g, '\\$&')
    .replace(/_/g, (m, i: number, str: string) => (WORD.test(str[i - 1] ?? '') && WORD.test(str[i + 1] ?? '') ? m : '\\_'))
    .replace(/&(?=#?[a-zA-Z0-9]+;)/g, '\\&');
}

function escapeLineStart(line: string): string {
  const l = line.replace(/^[ \t]+/, '');
  if (/^(?:[#>]|[-+](?:[ \t]|$)|(?:=+|-+)[ \t]*$)/.test(l)) return '\\' + l;
  const ordered = /^(\d+)([.)])(?:[ \t]|$)/.exec(l);
  return ordered ? ordered[1] + '\\' + l.slice(ordered[1].length) : l;
}

const MARK_ORDER = ['link', 'bold', 'italic'] as const;
const markOf = (node: JSONContent, type: string) => node.marks?.find(m => m.type === type);
const sameMark = (a: Mark | undefined, b: Mark | undefined) => Boolean(a && b && a.attrs?.href === b.attrs?.href);

function leaf(node: JSONContent, inTable: boolean): string {
  if (node.type === 'hardBreak') return inTable ? ' ' : '\\\n';
  return node.type === 'text' ? escapeText(node.text ?? '') : '';
}

// Emphasis cannot start or end with whitespace, so outer spaces move outside the markers.
function wrap(marker: string, inner: string): string {
  const core = inner.trim();
  if (!core) return inner;
  return `${inner.match(/^\s*/)![0]}${marker}${core}${marker}${inner.match(/\s*$/)![0]}`;
}

// ponytail: emphasis that ends in punctuation right before a letter ("**a.**b") does not close in CommonMark and
// shows its asterisks; rare in articles, the Pratinjau tab shows it. Fix with an entity boundary if it ever matters.
function inlineMd(nodes: JSONContent[], inTable: boolean, level = 0): string {
  if (level === MARK_ORDER.length) return nodes.map(n => leaf(n, inTable)).join('');
  const type = MARK_ORDER[level];
  let out = '';
  for (let i = 0; i < nodes.length; ) {
    const mark = markOf(nodes[i], type);
    let j = i + 1;
    while (j < nodes.length && (mark ? sameMark(markOf(nodes[j], type), mark) : !markOf(nodes[j], type))) j++;
    const inner = inlineMd(nodes.slice(i, j), inTable, level + 1);
    // A "!" right before a link's "[" would turn the link into an image (review REV-01).
    if (mark && type === 'link' && /(^|[^\\])!$/.test(out)) out = `${out.slice(0, -1)}\\!`;
    if (!mark) out += inner;
    else if (type === 'link') out += `[${inner}](${encodeLinkUrl(String(mark.attrs?.href ?? '')).replace(/\|/g, '%7C')})`;
    else out += wrap(type === 'bold' ? '**' : '*', inner);
    i = j;
  }
  return out;
}

function paragraphMd(node: JSONContent): string {
  const content = [...(node.content ?? [])];
  // A hard break at the end of a block is not a break in Markdown and would leave a stray "\".
  while (content.length && content[content.length - 1].type === 'hardBreak') content.pop();
  return inlineMd(content, false).split('\n').map(escapeLineStart).join('\n').trim();
}

function headingMd(node: JSONContent): string {
  const text = inlineMd(node.content ?? [], false).replace(/\\\n/g, ' ').trim();
  if (!text) return '';
  // A trailing "#" would be read as the closing sequence of the heading.
  return `${'#'.repeat(node.attrs?.level === 3 ? 3 : 2)} ${text.replace(/#$/, '\\#')}`;
}

function imageMd(node: JSONContent): string {
  const a = node.attrs ?? {};
  // A pasted <img> can carry line breaks in src; they would end the <...> form and inject Markdown (review REV-07).
  const src = String(a.src ?? '').replace(/[\r\n]+/g, '');
  // Paths with spaces or parentheses need the <...> form; imageMarkdown() writes the URL as given.
  const url = /[\s()<>]/.test(src) ? `<${src.replace(/[<>]/g, '')}>` : src;
  return imageMarkdown(url, String(a.alt ?? ''), String(a.caption ?? ''), { posisi: a.posisi ?? 'tengah', ukuran: a.ukuran ?? 'penuh' });
}

function listMd(node: JSONContent, alt: boolean): string {
  const ordered = node.type === 'orderedList';
  const start = Number(node.attrs?.start ?? 1) || 1;
  const items = node.content ?? [];
  // Two paragraphs in one item only stay apart in a loose list.
  const tight = node.attrs?.tight !== false && items.every(i => (i.content ?? []).filter(c => c.type !== 'bulletList' && c.type !== 'orderedList').length <= 1);
  return items
    .map((item, n) => {
      const marker = ordered ? `${start + n}${alt ? ')' : '.'} ` : alt ? '* ' : '- ';
      const pad = ' '.repeat(marker.length);
      const body = blocksMd(item.content ?? [], tight ? '\n' : '\n\n') || '';
      return marker + body.split('\n').map((l, i) => (i === 0 || !l ? l : pad + l)).join('\n');
    })
    .join(tight ? '\n' : '\n\n');
}

function tableMd(node: JSONContent): string {
  const rows = (node.content ?? []).map(row =>
    (row.content ?? []).map(cell => (cell.content ?? []).map(p => inlineMd(p.content ?? [], true).trim()).filter(Boolean).join(' ')),
  );
  if (rows.length === 0) return '';
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

function blockMd(node: JSONContent, alt: boolean): string {
  switch (node.type) {
    case 'paragraph': return paragraphMd(node);
    case 'heading': return headingMd(node);
    case 'bulletList':
    case 'orderedList': return listMd(node, alt);
    case 'table': return tableMd(node);
    case 'articleImage': return imageMd(node);
    case 'rawMarkdown': return (node.content ?? []).map(t => t.text ?? '').join('');
    default: return '';
  }
}

function blocksMd(nodes: JSONContent[], separator: string): string {
  const out: string[] = [];
  let prev: { type?: string; alt: boolean } | null = null;
  for (const node of nodes) {
    // A list right after a list of the same kind would merge with it; switching the marker starts a new list.
    const alt: boolean = Boolean(prev && prev.type === node.type && !prev.alt);
    const md = blockMd(node, alt);
    if (!md) continue;
    out.push(md);
    prev = { type: node.type, alt };
  }
  return out.join(separator);
}

/** s(d): canonical Markdown for an editor document. Empty blocks write nothing; no trailing newline. */
export function docToMarkdown(doc: JSONContent): string {
  return blocksMd(doc.content ?? [], '\n\n');
}

/** Which articleImage node (in document order) a side-panel image is: same src and alt, n-th occurrence. */
export function imageOccurrence(images: BodyImage[], image: BodyImage): number {
  return images.slice(0, image.index).filter(i => i.url === image.url && i.alt === image.alt).length;
}
