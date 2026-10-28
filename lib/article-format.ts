import type { Article, ArticleStatus, ContentFormat, PublicArticle } from '@/types';
import { ALLOWED_IMAGE_PREFIX } from '@/lib/constants';

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
  // Offsets of the whole "![alt](url "caption")" in content, for edit and replace.
  start: number;
  end: number;
  raw: string;
  alt: string;
  url: string;
  caption: string;
  line: number;
  kind: BodyImageKind;
  fileName: string;
}

const unescapeMd = (s: string) => s.replace(/\\([\\`*_{}\[\]()#+\-.!"'<>|~])/g, '$1');

// Matches the image syntax the editor writes and the naskah use; marked's own grammar is wider (nested
// brackets, reference images), and anything this misses is still caught by renderArticle() warnings.
const IMAGE_RE = /!\[((?:\\.|[^\]\\\n])*)\]\(\s*(<[^>\n]*>|[^\s()]+)(?:\s+"((?:\\.|[^"\\\n])*)"|\s+'((?:\\.|[^'\\\n])*)')?\s*\)/g;

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

export function imageMarkdown(url: string, alt: string, caption?: string): string {
  const title = caption && oneLine(caption) ? ` "${escapeCaption(caption)}"` : '';
  return `![${escapeAlt(alt)}](${url}${title})`;
}

export function countWords(content: string): number {
  const text = (content || '')
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
    if (!line || /^(#|!\[|```|~~~|\|)/.test(line)) continue;
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
