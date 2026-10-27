import { Marked, type Tokens, type Token } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { ContentFormat } from '@/types';
import { formatOf, isAllowedImageUrl, isPlaceholderImage } from '@/lib/article-format';
import { generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';

// Server only (F-012 requirement 4.1): imported by server pages and route handlers, never by a client
// component, so neither library reaches the browser bundle. The build gate greps .next/static to prove it.

export type RenderWarning =
  | { kind: 'image-host' | 'placeholder' | 'inline-image'; src: string; alt: string }
  | { kind: 'raw-html' };

export interface RenderResult {
  html: string;
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
  },
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
          const img = meaningful[0] as Tokens.Image;
          const alt = this.parser.parseInline(img.tokens, this.parser.textRenderer).trim();
          if (!isAllowedImageUrl(img.href)) {
            warnings.push(imageWarning(img.href, alt));
            return '';
          }
          const caption = (img.title || '').trim();
          const attrs = [
            `src="${escapeHtml(optimizeCloudinaryUrl(img.href, 1200))}"`,
            `srcset="${escapeHtml(generateCloudinarySrcSet(img.href, [480, 800, 1200]))}"`,
            `sizes="(max-width: 768px) 100vw, 720px"`,
            `alt="${escapeHtml(alt)}"`,
            `loading="lazy"`,
            `decoding="async"`,
          ].join(' ');
          const figcaption = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';
          return `<figure><img ${attrs}>${figcaption}</figure>\n`;
        }
        const inner = this.parser.parseInline(tokens);
        return inner.trim() ? `<p>${inner}</p>\n` : '';
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

  const html = md.parse(content) as string;
  return { html: sanitizeArticleHtml(html), warnings };
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
  return { html: renderPlain(content), warnings: [] };
}
