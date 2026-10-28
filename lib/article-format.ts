import type { Article, ArticleStatus, ContentFormat, ImageLayout, ImagePosition, ImageSize, PublicArticle } from '@/types';
import { ALLOWED_IMAGE_PREFIX } from '@/lib/constants';
import { SLUG_PATTERN } from '@/lib/slug';

// Pure helpers shared by the editor (browser), the API, and the renderer. No dependencies, so importing
// this file never pulls marked or sanitize-html into a client bundle.

// Stored dates are Firestore Timestamps (legacy) or ISO strings (since F-000); pages and the API use ms.
export function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v._seconds === 'number') return v._seconds * 1000;
  }
  return null;
}

export function toPublicArticle(id: string, data: Record<string, any>): PublicArticle {
  const { createdAt, updatedAt, publishedAt, ...rest } = data as Article;
  return {
    ...rest,
    slug: id,
    createdAt: toMillis(createdAt),
    updatedAt: toMillis(updatedAt),
    publishedAt: toMillis(publishedAt),
  };
}

export const statusOf = (a: Pick<Article, 'status'>): ArticleStatus => a.status ?? 'published';
export const formatOf = (a: Pick<Article, 'contentFormat'>): ContentFormat => a.contentFormat ?? 'plain';

// Legacy published articles have no publishedAt but may be indexed, so they count as published once.
export const isEverPublished = (a: { status?: ArticleStatus; publishedAt?: unknown }): boolean =>
  Boolean(a.publishedAt) || statusOf(a) === 'published';

export const publicDate = (a: { publishedAt?: number | null; createdAt?: number | null }): number | null =>
  a.publishedAt ?? a.createdAt ?? null;

/**
 * True only for an https URL on the website's own Cloudinary cloud. The URL is parsed as well as
 * prefix-matched because browsers normalise "..", "%2e%2e", and "\" in paths, which would otherwise let
 * "https://res.cloudinary.com/dukddlp0b/../other-cloud/..." load an image from another cloud.
 */
export function isAllowedImageUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith(ALLOWED_IMAGE_PREFIX)) return false;
  if (/[\s"'<>\\`]/.test(url)) return false;
  try {
    return new URL(url).href.startsWith(ALLOWED_IMAGE_PREFIX);
  } catch {
    return false;
  }
}

// ADR-0013: naskah reference images as local files (../images/K-XX/<file>) until they are uploaded;
// "GAMBAR-N" marks a photo that does not exist yet.
export function isPlaceholderImage(url: string): boolean {
  return /^GAMBAR-\d+$/i.test(url) || /^(?:\.{1,2}\/)*images\//i.test(url);
}

export type BodyImageKind = 'allowed' | 'placeholder' | 'foreign';

export interface BodyImage {
  index: number;
  // Offsets of the whole "![alt](url "caption")" in content, including an F-013 attribute block after it,
  // so edit and replace rewrite the image and its block together.
  start: number;
  end: number;
  raw: string;
  alt: string;
  url: string;
  caption: string;
  line: number;
  kind: BodyImageKind;
  fileName: string;
  // F-013: resolved layout of the attribute block; DEFAULT_LAYOUT when there is none.
  layout: ImageLayout;
}

const unescapeMd = (s: string) => s.replace(/\\([\\`*_{}\[\]()#+\-.!"'<>|~])/g, '$1');

// F-013 image layout (requirement 2). One contract for the renderer (lib/markdown.ts) and the editor.
export const DEFAULT_LAYOUT: ImageLayout = Object.freeze({ posisi: 'tengah', ukuran: 'penuh' }) as ImageLayout;
// An attribute block directly after an image: optional spaces or tabs, then "{...}" on the same line.
export const ATTR_BLOCK_RE = /^[ \t]*\{([^{}\n]*)\}/;
// The only classes the renderer writes and the sanitizer lets through, only on <figure> (requirement 3.5).
export const FIGURE_CLASSES = [
  'article-figure--kiri',
  'article-figure--kanan',
  'article-figure--kecil',
  'article-figure--sedang',
  'article-figure--besar',
] as const;

const POSITIONS: readonly ImagePosition[] = ['kiri', 'tengah', 'kanan'];
const SIZES: readonly ImageSize[] = ['kecil', 'sedang', 'besar', 'penuh'];
const isPosition = (v: unknown): v is ImagePosition => typeof v === 'string' && (POSITIONS as readonly string[]).includes(v);
const isSize = (v: unknown): v is ImageSize => typeof v === 'string' && (SIZES as readonly string[]).includes(v);

/**
 * Reads the content of an attribute block (without the braces). Only `posisi` and `ukuran` with a listed
 * value count, case-insensitively; items without "=", unknown keys, and other values (quoted ones too) are
 * ignored. The last valid value of a key wins (requirements 2.3–2.5).
 */
export function parseImageAttrs(block: string): Partial<ImageLayout> {
  const attrs: Partial<ImageLayout> = {};
  for (const item of (block || '').split(/[ \t]+/)) {
    const eq = item.indexOf('=');
    if (eq <= 0) continue;
    const key = item.slice(0, eq).toLowerCase();
    const value = item.slice(eq + 1).toLowerCase();
    if (key === 'posisi' && isPosition(value)) attrs.posisi = value;
    else if (key === 'ukuran' && isSize(value)) attrs.ukuran = value;
  }
  return attrs;
}

/**
 * Defaults and the full-width rule of requirement 2.6: no posisi → tengah; no ukuran → sedang beside text,
 * else penuh; penuh never floats. Values outside the lists are treated as missing.
 */
export function resolveLayout(attrs: Partial<ImageLayout> | null | undefined): ImageLayout {
  const posisi: ImagePosition = isPosition(attrs?.posisi) ? attrs!.posisi! : 'tengah';
  const floats = posisi === 'kiri' || posisi === 'kanan';
  const ukuran: ImageSize = isSize(attrs?.ukuran) ? attrs!.ukuran! : floats ? 'sedang' : 'penuh';
  return ukuran === 'penuh' ? { posisi: 'tengah', ukuran } : { posisi, ukuran };
}

/**
 * One choice in the image dialog (requirement 5.2): picking Kiri or Kanan while Ukuran is Penuh switches
 * Ukuran to Sedang; picking Penuh switches Posisi to Tengah. The result is always a resolved layout.
 */
export function changeLayout(current: Partial<ImageLayout> | null | undefined, change: Partial<ImageLayout>): ImageLayout {
  const next = { ...resolveLayout(current) };
  if (isPosition(change.posisi)) {
    next.posisi = change.posisi;
    if (change.posisi !== 'tengah' && next.ukuran === 'penuh') next.ukuran = 'sedang';
  }
  if (isSize(change.ukuran)) {
    next.ukuran = change.ukuran;
    if (change.ukuran === 'penuh') next.posisi = 'tengah';
  }
  return resolveLayout(next);
}

const isDefaultLayout = (l: ImageLayout) => l.posisi === DEFAULT_LAYOUT.posisi && l.ukuran === DEFAULT_LAYOUT.ukuran;

/** Canonical attribute block (requirement 2.2): '' for the default layout, else "{posisi=<p> ukuran=<u>}". */
export function layoutBlock(layout: Partial<ImageLayout> | null | undefined): string {
  const l = resolveLayout(layout);
  return isDefaultLayout(l) ? '' : `{posisi=${l.posisi} ukuran=${l.ukuran}}`;
}

/** Classes for the rendered <figure>, always members of FIGURE_CLASSES; [] for the default layout. */
export function layoutClasses(layout: Partial<ImageLayout> | null | undefined): string[] {
  const l = resolveLayout(layout);
  const classes: string[] = [];
  if (l.posisi !== 'tengah') classes.push(`article-figure--${l.posisi}`);
  if (l.ukuran !== 'penuh') classes.push(`article-figure--${l.ukuran}`);
  return classes;
}

// Figure width in the 728 px reading column. Smaller sizes switch to 100vw at the CSS phone breakpoint
// (767 px, requirement 4.6), so a 768 px viewport picks the small candidate; penuh keeps F-012's exact
// string so default-layout HTML stays byte-identical (requirements 3.3, 3.4, amended for review WEB-01).
const SIZES_ATTR: Record<ImageSize, string> = {
  kecil: '(max-width: 767px) 100vw, 240px',
  sedang: '(max-width: 767px) 100vw, 364px',
  besar: '(max-width: 767px) 100vw, 546px',
  penuh: '(max-width: 768px) 100vw, 720px',
};

/** The img `sizes` attribute for this layout (requirement 3.4). */
export function layoutSizes(layout: Partial<ImageLayout> | null | undefined): string {
  return SIZES_ATTR[resolveLayout(layout).ukuran];
}

// Matches the image syntax the editor writes and the naskah use; marked's own grammar is wider (nested
// brackets, reference images), and anything this misses is still caught by renderArticle() warnings.
// F-013: an optional attribute block on the same line is part of the match (group 5).
const IMAGE_RE = /!\[((?:\\.|[^\]\\\n])*)\]\(\s*(<[^>\n]*>|[^\s()]+)(?:\s+"((?:\\.|[^"\\\n])*)"|\s+'((?:\\.|[^'\\\n])*)')?\s*\)(?:[ \t]*\{([^{}\n]*)\})?/g;

// Lines inside fenced code blocks are not Markdown, so images and headings there do not count.
function fencedRanges(content: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = /^ {0,3}(`{3,}|~{3,})[^\n]*$/gm;
  let open: { fence: string; start: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    const fence = m[1];
    if (!open) open = { fence, start: m.index };
    else if (fence[0] === open.fence[0] && fence.length >= open.fence.length) {
      ranges.push([open.start, m.index + m[0].length]);
      open = null;
    }
  }
  if (open) ranges.push([open.start, content.length]);
  return ranges;
}

const inRanges = (pos: number, ranges: Array<[number, number]>) => ranges.some(([a, b]) => pos >= a && pos < b);

export function extractBodyImages(content: string): BodyImage[] {
  const text = content || '';
  const fenced = fencedRanges(text);
  const images: BodyImage[] = [];
  let m: RegExpExecArray | null;
  IMAGE_RE.lastIndex = 0;
  while ((m = IMAGE_RE.exec(text))) {
    if (inRanges(m.index, fenced)) continue;
    const rawUrl = m[2].startsWith('<') ? m[2].slice(1, -1) : m[2];
    const url = rawUrl.trim();
    const kind: BodyImageKind = isAllowedImageUrl(url) ? 'allowed' : isPlaceholderImage(url) ? 'placeholder' : 'foreign';
    images.push({
      index: images.length,
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      alt: unescapeMd(m[1]).trim(),
      url,
      caption: unescapeMd(m[3] ?? m[4] ?? '').trim(),
      line: text.slice(0, m.index).split('\n').length,
      kind,
      fileName: url.split(/[/\\]/).pop() || url,
      layout: resolveLayout(parseImageAttrs(m[5] ?? '')),
    });
  }
  return images;
}

/** True when the body has an ATX "#" heading outside fenced code; the article title is the only h1. */
export function hasH1(content: string): boolean {
  const text = content || '';
  const fenced = fencedRanges(text);
  const re = /^ {0,3}#(?:[ \t]|$)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!inRanges(m.index, fenced)) return true;
  }
  return false;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

// The editor writes alt and caption into Markdown; escaping keeps "]" and '"' from ending the syntax early.
export function escapeAlt(alt: string): string {
  return oneLine(alt).replace(/\\/g, '\\\\').replace(/([\[\]])/g, '\\$1');
}

export function escapeCaption(caption: string): string {
  return oneLine(caption).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** F-012 image syntax; with a layout (F-013) the canonical attribute block follows, none for the default. */
export function imageMarkdown(url: string, alt: string, caption?: string, layout?: ImageLayout): string {
  const title = caption && oneLine(caption) ? ` "${escapeCaption(caption)}"` : '';
  return `![${escapeAlt(alt)}](${url}${title})${layout ? layoutBlock(layout) : ''}`;
}

// F-013 phase C markers (requirement 17): EMBED_LINE_RE is a whole trimmed paragraph, EMBED_TEXT_RE any
// marker text. The keyword is case-insensitive; the slug is checked against SLUG_PATTERN by the renderer.
export const EMBED_LINE_RE = /^\[\[(produk|artikel):([^\]\s]*)\]\]$/i;
export const EMBED_TEXT_RE = /\[\[(?:produk|artikel):[^\]\n]*\]\]/gi;
export const MAX_EMBEDS = 10;
const EMBED_LINES_RE = /^[ \t]*\[\[(?:produk|artikel):[^\]\s]*\]\][ \t]*$/gim;

// F-013 phase C4 (W-5): Markdown links to an INZTA article or product page, outside fenced code. Paths with a
// query or anchor are not matched, so they are never reported.
const SITE_LINK_RE = /\]\(\s*<?\/(produk|blog)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?>?(?:\s+"(?:\\.|[^"\\])*")?\s*\)/g;
export function siteLinks(content: string): Array<{ kind: 'produk' | 'artikel'; slug: string; path: string }> {
  const text = content || '';
  const fenced = fencedRanges(text);
  const out: Array<{ kind: 'produk' | 'artikel'; slug: string; path: string }> = [];
  for (const m of text.matchAll(SITE_LINK_RE)) {
    if (inRanges(m.index ?? 0, fenced)) continue;
    out.push({ kind: m[1] === 'produk' ? 'produk' : 'artikel', slug: m[2], path: `/${m[1]}/${m[2]}` });
  }
  return out;
}

export interface EmbedRef {
  kind: 'produk' | 'artikel';
  slug: string;
  // 1-based line number and the canonical marker, e.g. "[[produk:side-bag-z10]]".
  line: number;
  marker: string;
}

const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])(?:\s|$)/;
const ATX_HEADING_RE = /^ {0,3}#{1,6}(?:\s|$)/;
const FENCE_RE = /^ {0,3}(?:`{3,}|~{3,})/;

/**
 * F-013 phase C: the marker lines that render as cards, without a Markdown parser, so the editor and the
 * checklist can use it in the browser (requirement 17.1). A marker counts when it is a paragraph of its own: a
 * blank line, a heading, a code fence, or the start before it; a blank line, a heading, a fence, or the end after
 * it; outside fenced code; and, when indented, not inside a list item. The server still decides with
 * renderArticle() blocks; tests/f012-markdown.cjs checks that both agree.
 */
export function extractEmbeds(content: string): EmbedRef[] {
  const text = content || '';
  const lines = text.split('\n');
  const fenced = fencedRanges(text);
  const out: EmbedRef[] = [];
  const boundary = (l: string | undefined) => l === undefined || !l.trim() || ATX_HEADING_RE.test(l) || FENCE_RE.test(l);
  let offset = 0;
  for (let i = 0; i < lines.length; offset += lines[i].length + 1, i++) {
    const line = lines[i];
    const indent = /^ */.exec(line)![0].length;
    const m = indent <= 3 ? EMBED_LINE_RE.exec(line.trim()) : null;
    if (!m || !SLUG_PATTERN.test(m[2]) || inRanges(offset, fenced)) continue;
    if (!boundary(lines[i - 1]) || !boundary(lines[i + 1])) continue;
    if (indent > 0) {
      // An indented line after a list item (or its indented continuation) belongs to that item.
      let j = i - 1;
      while (j >= 0 && !lines[j].trim()) j--;
      if (j >= 0 && (LIST_ITEM_RE.test(lines[j]) || /^\s/.test(lines[j]))) continue;
    }
    const kind = m[1].toLowerCase() === 'produk' ? 'produk' : 'artikel';
    out.push({ kind, slug: m[2], line: i + 1, marker: `[[${kind}:${m[2]}]]` });
  }
  return out;
}

export function countWords(content: string): number {
  const text = (content || '')
    .replace(EMBED_LINES_RE, ' ')
    .replace(IMAGE_RE, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~\-|]+/g, ' ');
  return text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

// About 200 words per minute for Indonesian web reading; shown as an estimate only.
export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 200));

/**
 * First readable sentence of the body for a meta description fallback: skips headings, images, and
 * list markers, strips inline Markdown, and cuts at a word boundary near `max` characters.
 */
export function firstLineSummary(content: string, max = 160): string {
  for (const rawLine of (content || '').split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || /^(#|!\[|```|~~~|\|)/.test(line) || EMBED_LINE_RE.test(line)) continue;
    line = line
      .replace(/^([-*+]|\d+[.)])\s+/, '')
      .replace(IMAGE_RE, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]*>/g, '')
      .replace(/(\*\*|__|\*|_|`)/g, '')
      .trim();
    if (!line) continue;
    if (line.length <= max) return line;
    const cut = line.slice(0, max + 1);
    const space = cut.lastIndexOf(' ');
    return (space > max * 0.6 ? cut.slice(0, space) : line.slice(0, max)).replace(/[\s,.;:]+$/, '') + '…';
  }
  return '';
}
