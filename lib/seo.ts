// F-005: canonical URLs and JSON-LD. Pure module (no Firestore, no `marked`), so tests can load it directly.
import type { PublicArticle } from '@/types';
import { SITE_ORIGIN, DEFAULT_AUTHOR } from '@/lib/constants';
import { extractBodyImages, formatOf, isAllowedImageUrl, publicDate } from '@/lib/article-format';

/** canonicalUrl() -> 'https://inzta.id/', canonicalUrl('blog', slug) -> 'https://inzta.id/blog/{slug}'. Never a query or fragment. */
export function canonicalUrl(...segments: string[]): string {
  return `${SITE_ORIGIN}/${segments.filter(Boolean).map(encodeURIComponent).join('/')}`;
}

// Built with fromCharCode so this file holds no literal U+2028/U+2029.
const UNSAFE_IN_SCRIPT = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/** JSON.stringify with <, >, &, U+2028, U+2029 as \u escapes, so text like "</script>" cannot close the block. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_IN_SCRIPT, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'INZTA Moto',
  url: `${SITE_ORIGIN}/`,
  logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo-inzta.png` },
} as const;

/** The main image a visitor sees (requirement 2.6), or null. */
export function articleMainImage(article: PublicArticle): string | null {
  if (formatOf(article) === 'markdown') {
    if (article.showCover !== false && isAllowedImageUrl(article.coverImage)) return article.coverImage;
    const body = extractBodyImages(article.content || '').find(img => img.kind === 'allowed');
    if (body) return body.url;
    return isAllowedImageUrl(article.coverImage) ? article.coverImage : null; // Q-4
  }
  const gallery = article.images || (article.imageUrl ? [article.imageUrl] : []); // same as BlogDetailClient
  return gallery[0]?.startsWith('https://') ? gallery[0] : null;
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

// Requirement 2.9: the item never carries an empty property.
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** The Article item of requirement 2. Values match what the page shows; no description, no rating. */
export function articleJsonLd(article: PublicArticle): Record<string, unknown> {
  const url = canonicalUrl('blog', article.slug);
  const published = publicDate(article);
  const modified = published !== null && article.updatedAt !== null && article.updatedAt >= published ? article.updatedAt : published;
  const image = articleMainImage(article);
  const item: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    headline: article.title,
    image: image ? [image] : null,
    datePublished: iso(published),
    dateModified: iso(modified),
    // Q-3: every byline is a Person with the visible name; plain articles show no byline.
    author: formatOf(article) === 'markdown' ? { '@type': 'Person', name: article.author?.trim() || DEFAULT_AUTHOR } : null,
    publisher: ORGANIZATION,
  };
  return Object.fromEntries(Object.entries(item).filter(([, v]) => !isEmpty(v)));
}
