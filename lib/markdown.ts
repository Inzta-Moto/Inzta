import { Marked, type Tokens, type Token } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { ContentFormat, RenderBlock, RenderWarning } from '@/types';
import {
  DEFAULT_LAYOUT,
  EMBED_LINE_RE,
  EMBED_TEXT_RE,
  MAX_EMBEDS,
  FIGURE_CLASSES,
  formatOf,
  isAllowedImageUrl,
  isPlaceholderImage,
  layoutClasses,
  layoutSizes,
} from '@/lib/article-format';
import { attachImageLayouts, type LayoutImage } from '@/lib/markdown-layout';
import { generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';
import { SLUG_PATTERN } from '@/lib/slug';

// Server only (F-012 requirement 4.1): imported by server pages and route handlers, never by a client
// component, so neither library reaches the browser bundle. The build gate greps .next/static to prove it.

export type { RenderBlock, RenderWarning };

export interface RenderResult {
  // All HTML blocks joined; markers add nothing, so callers that ignore cards keep working (18.3).
  html: string;
  // F-013 phase C: HTML blocks and product/article cards in Markdown order.
  blocks: RenderBlock[];
  warnings: RenderWarning[];
}

const SITE_HOSTS = new Set(['inzta.id', 'www.inzta.id']);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Only http(s) and site paths keep their href. A path must start with exactly one "/", because "//host"
// and "/\host" are protocol-relative in browsers.
function safeHref(href: string): { href: string; external: boolean } | null {
  if (/^\/(?![\/\\])/.test(href)) return { href, external: false };
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { href, external: !SITE_HOSTS.has(url.hostname.toLowerCase()) };
  } catch {
    return null;
  }
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  // Tables: spec amendment 2026-10-27 (Sehan), tags only. marked's align attributes are not on the
  // allowlist, so they are dropped like any other attribute.
  allowedTags: [
    'h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'img', 'figure', 'figcaption', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
    img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'decoding'],
    // F-013 (requirement 4.10): the column heading of a body cell, shown as a label when a table becomes cards
    // on phones. Plain text written by the table renderer below; no other data-* attribute is allowed.
    td: ['data-label'],
  },
  // F-013 requirement 3.5: the five image-layout classes, on <figure> only. `class` is deliberately not in
  // allowedAttributes, so any other class, and a class on any other tag, is removed.
  allowedClasses: { figure: [...FIGURE_CLASSES] },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  // Second layer for the image host: runs inside sanitizing, so nothing is changed after it (4.9).
  exclusiveFilter: frame => frame.tag === 'img' && !isAllowedImageAttrs(frame.attribs.src, frame.attribs.srcset),
};

function isAllowedImageAttrs(src: string | undefined, srcset: string | undefined): boolean {
  if (!isAllowedImageUrl(src)) return false;
  if (!srcset) return true;
  // Cloudinary URLs contain commas (f_auto,q_auto), so candidates are split on whitespace: every token
  // that is not a width or density descriptor is a URL and must be on the allowed host.
  return srcset
    .trim()
    .split(/\s+/)
    .filter(token => !/^\d+(?:\.\d+)?[wxh],?$/.test(token))
    .every(token => isAllowedImageUrl(token.replace(/,+$/, '')));
}

// Exported for tests: proves the second layer holds even if the token stage let something through.
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

function imageWarning(href: string, alt: string): RenderWarning {
  if (isAllowedImageUrl(href)) return { kind: 'inline-image', src: href, alt };
  return { kind: isPlaceholderImage(href) ? 'placeholder' : 'image-host', src: href, alt };
}

const isBlank = (t: Token) => (t.type === 'text' || t.type === 'space') && !t.raw.trim();

function renderMarkdown(content: string): RenderResult {
  const warnings: RenderWarning[] = [];
  let rawHtmlWarned = false;
  const noteRawHtml = () => {
    if (!rawHtmlWarned) warnings.push({ kind: 'raw-html' });
    rawHtmlWarned = true;
  };

  // A private instance per call, so renderer overrides and warnings never leak between callers.
  const md = new Marked({ gfm: true, breaks: false, async: false });
  md.use({
    // Runs on a parent before its children, so the block is gone before the renderer sees the tokens.
    walkTokens(token) {
      // After an inline raw <pre>, <code>, <kbd>, or <script>, marked marks the following text `escaped` and
      // the text renderer would emit it unescaped, so a tag fragment there reached the sanitizer as a tag.
      // Clearing the flag makes the renderer escape it like any other text; the reader still sees it.
      if (token.type === 'text' && (token as Tokens.Text).escaped) (token as Tokens.Text).escaped = false;
      // Paragraphs, list-item text, links, emphasis, headings: anything with inline child tokens.
      if ('tokens' in token && Array.isArray(token.tokens)) attachImageLayouts(token.tokens);
      // Table cells are not passed to the callback themselves, only their children.
      if (token.type === 'table') {
        const table = token as Tokens.Table;
        for (const cell of [...table.header, ...table.rows.flat()]) attachImageLayouts(cell.tokens);
      }
    },
    renderer: {
      html() {
        noteRawHtml();
        return '';
      },
      heading({ tokens, depth }: Tokens.Heading) {
        // The article title is the page's only h1, so "#" becomes h2 and "####" and deeper become h3.
        const tag = depth <= 2 ? 'h2' : 'h3';
        return `<${tag}>${this.parser.parseInline(tokens)}</${tag}>\n`;
      },
      paragraph({ tokens }: Tokens.Paragraph) {
        const meaningful = tokens.filter(t => !isBlank(t));
        if (meaningful.length === 1 && meaningful[0].type === 'image') {
          const img = meaningful[0] as LayoutImage;
          const alt = this.parser.parseInline(img.tokens, this.parser.textRenderer).trim();
          if (!isAllowedImageUrl(img.href)) {
            warnings.push(imageWarning(img.href, alt));
            return '';
          }
          const caption = (img.title || '').trim();
          // F-013: default layout writes no class and F-012's sizes, so its HTML is byte-identical (3.3).
          const layout = img.layout ?? DEFAULT_LAYOUT;
          const classes = layoutClasses(layout);
          const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
          const attrs = [
            `src="${escapeHtml(optimizeCloudinaryUrl(img.href, 1200))}"`,
            `srcset="${escapeHtml(generateCloudinarySrcSet(img.href, [480, 800, 1200]))}"`,
            `sizes="${layoutSizes(layout)}"`,
            `alt="${escapeHtml(alt)}"`,
            `loading="lazy"`,
            `decoding="async"`,
          ].join(' ');
          const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
          return `<figure${cls}><img ${attrs}>${figcaption}</figure>\n`;
        }
        const inner = this.parser.parseInline(tokens);
        return inner.trim() ? `<p>${inner}</p>\n` : '';
      },
      // F-013 (4.10): marked's table markup, plus each body cell's column heading as data-label for the phone
      // card layout. Alignment is not written; the sanitizer dropped it anyway.
      table({ header, rows }: Tokens.Table) {
        const headings = header.map(cell => this.parser.parseInline(cell.tokens));
        // The label is the heading as the reader sees it: rendered (raw HTML already dropped), tags removed. That
        // text is already HTML-escaped, so only the attribute quote needs escaping.
        const labels = headings.map(h => h.replace(/<[^>]*>/g, '').replace(/"/g, '&quot;').trim());
        const head = headings.map(h => `<th>${h}</th>\n`).join('');
        const body = rows
          .map(row => {
            const cells = row
              .map((cell, i) => `<td${labels[i] ? ` data-label="${labels[i]}"` : ''}>${this.parser.parseInline(cell.tokens)}</td>\n`)
              .join('');
            return `<tr>\n${cells}</tr>\n`;
          })
          .join('');
        return `<table>\n<thead>\n<tr>\n${head}</tr>\n</thead>\n${body ? `<tbody>${body}</tbody>` : ''}</table>\n`;
      },
      // Reached only for images that do not stand alone in a paragraph (with text, in a list, in a link).
      image({ href, tokens }: Tokens.Image) {
        warnings.push(imageWarning(href, this.parser.parseInline(tokens, this.parser.textRenderer).trim()));
        return '';
      },
      link({ href, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const safe = safeHref(href);
        if (!safe) return text;
        const rel = safe.external ? ' rel="noopener noreferrer" target="_blank"' : '';
        return `<a href="${escapeHtml(safe.href)}"${rel}>${text}</a>`;
      },
    },
  });

  // md.parse() is lexer -> walkTokens -> parser; the same steps run here by hand so the top-level tokens can
  // be cut at each marker (18.2). Without markers the one group gives md.parse()'s exact string.
  const blocks: RenderBlock[] = [];
  try {
    const tokens = md.lexer(content);
    md.walkTokens(tokens, md.defaults.walkTokens!);
    let group: Token[] = [];
    let embeds = 0;
    const flush = () => {
      // Each block is sanitized on its own, last (F-012 4.9).
      const html = group.length ? sanitizeArticleHtml(md.parser(group)) : '';
      if (html) blocks.push({ type: 'html', html });
      group = [];
    };
    for (const token of tokens) {
      const m = token.type === 'paragraph' ? EMBED_LINE_RE.exec(token.raw.trim()) : null;
      if (m && SLUG_PATTERN.test(m[2])) {
        const marker = token.raw.trim();
        if (++embeds > MAX_EMBEDS) {
          warnings.push({ kind: 'embed-limit', marker });
          continue;
        }
        flush();
        blocks.push({ type: m[1].toLowerCase() === 'produk' ? 'product' : 'article', slug: m[2] });
        continue;
      }
      if (m) warnings.push({ kind: 'embed-invalid', marker: token.raw.trim() });
      else if (token.type !== 'code') {
        for (const x of token.raw.matchAll(EMBED_TEXT_RE)) warnings.push({ kind: 'embed-inline', marker: x[0] });
      }
      group.push(token);
    }
    flush();
  } catch (error) {
    // Deeply nested lists or quotes overflow marked's recursion; the checklist blocks publishing on this.
    console.error('renderArticle: Markdown could not be parsed', { length: content.length, error: (error as Error)?.message });
    return { html: '', blocks: [], warnings: [{ kind: 'render-error' }] };
  }
  const html = blocks.map(b => (b.type === 'html' ? b.html : '')).join('');
  return { html, blocks, warnings };
}

function renderPlain(content: string): string {
  const html = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${escapeHtml(line)}</p>`)
    .join('\n');
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * The one renderer for article bodies (public page, admin preview tab, admin preview page). Markdown is
 * filtered at the token stage (images, links, raw HTML) and then passed through an allowlist sanitizer,
 * which always runs last.
 */
export function renderArticle(input: { content?: string | null; contentFormat?: ContentFormat }): RenderResult {
  const content = typeof input.content === 'string' ? input.content : '';
  if (formatOf(input) === 'markdown') return renderMarkdown(content);
  const html = renderPlain(content);
  return { html, blocks: html ? [{ type: 'html', html }] : [], warnings: [] };
}
