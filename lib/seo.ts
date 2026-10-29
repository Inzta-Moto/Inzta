// F-005: canonical URLs, page metadata, and JSON-LD. Pure module (no Firestore, no `marked`), so tests can load it directly.
import type { Metadata } from 'next';
import type { Product, PublicArticle } from '@/types';
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

// --- Page metadata (phase 2, requirement 6) ---

/** The one og:site_name and title suffix (6.2, 6.5). The layout template is `%s | ${SITE_NAME}`. */
export const SITE_NAME = 'INZTA Moto';

// Approved by Angkasa on 2026-10-29 (task 13). No "100%", "dijamin", "terbaik", "pasti", "waterproof", or "anti air" (6.3).
export const PAGE_TEXT = {
  home: {
    title: 'INZTA Moto: Tas Motor dan Perlengkapan Touring',
    description: 'Tas samping, tank bag, tail bag, tas crashbar, dan aksesori touring buatan INZTA. Pesan langsung lewat WhatsApp.',
  },
  produk: {
    title: 'Semua Produk Tas Motor',
    description: 'Daftar tas samping, tank bag, tail bag, tas crashbar, dan aksesori touring INZTA, dengan harga dan stok terbaru.',
  },
  blog: {
    title: 'Blog Touring dan Tas Motor',
    description: 'Catatan perjalanan, cara memilih dan memasang tas motor, dan kabar acara touring dari Tim INZTA.',
  },
} as const;

export const DEFAULT_OG_IMAGE = { url: `${SITE_ORIGIN}/logo-mtg.png`, width: 842, height: 842, alt: SITE_NAME };

type OgImage = string | { url: string; width?: number; height?: number; alt?: string; type?: string };

/**
 * A full openGraph object. A page's openGraph replaces the layout's instead of merging with it, so every page
 * passes one built here: og:url = canonical and the same og:site_name everywhere (6.5).
 */
export function openGraph(o: { url: string; title: string; description: string; images?: OgImage[]; type?: 'website' | 'article' }) {
  return { type: o.type ?? 'website', locale: 'id_ID', siteName: SITE_NAME, url: o.url, title: o.title, description: o.description, images: o.images ?? [DEFAULT_OG_IMAGE] };
}

/** Metadata for `/`, `/produk`, `/blog`: unique title and description, canonical, og, and twitter (6.1, 6.5). */
export function sectionMetadata(page: keyof typeof PAGE_TEXT): Metadata {
  const { title, description } = PAGE_TEXT[page];
  const url = page === 'home' ? canonicalUrl() : canonicalUrl(page);
  // The layout template does not apply to the root page, so `/` passes its full title.
  const fullTitle = page === 'home' ? title : `${title} | ${SITE_NAME}`;
  return {
    title: page === 'home' ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: openGraph({ url, title: fullTitle, description }),
    // Replaces the layout's twitter object, so it repeats the creator.
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [DEFAULT_OG_IMAGE.url], creator: '@inztamoto' },
  };
}

/** Markdown (or plain text) as one line of plain text: markers removed, lines joined (6.4, 8.5). */
export function plainText(markdown: string): string {
  return (markdown || '')
    .normalize('NFKC') // 𝗜𝗡𝗭𝗧𝗔 (Unicode bold) -> INZTA
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '') // headings, quotes, list markers
    .replace(/^[\s|:-]*-{3,}[\s|:-]*$/gm, '') // table separator rows and horizontal rules
    .replace(/\|/g, ' ') // table cells
    // Emphasis markers only at a word edge, so "10~15 L", "10*20 cm", "TK#5", and "tank_bag" stay intact.
    .replace(/(^|[\s(])[*_~`]+|[*_~`]+(?=[\s.,;:!?)]|$)/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** plainText() cut at a word boundary to at most `max` characters (6.4). */
export function plainTextSummary(markdown: string, max = 155): string {
  const text = plainText(markdown);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s.,;:–-]+$/, '')}…`;
}

// --- JSON-LD ---

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_ORIGIN}/#organization`,
  name: 'INZTA Moto',
  url: `${SITE_ORIGIN}/`,
  logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo-inzta.png` },
} as const;

// Q-6 (Angkasa, 2026-10-29): the official profiles, as in the F-003 footer links.
export const SAME_AS = [
  'https://www.instagram.com/inztamoto_bag',
  'https://www.tiktok.com/@inztamoto',
];

export const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE_ORIGIN}/#website`,
  url: `${SITE_ORIGIN}/`,
  name: SITE_NAME,
  publisher: { '@id': ORGANIZATION['@id'] },
} as const;

/** One JSON-LD block holding several items (requirement 2.1 still sees one Article). */
export function jsonLdGraph(...items: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@graph': items.map(({ '@context': _context, ...item }) => item) };
}

/** Organization (with sameAs) + WebSite for `/` (9.1, 9.2). No SearchAction. */
export const homeJsonLd = () => jsonLdGraph({ ...ORGANIZATION, sameAs: SAME_AS }, WEBSITE);

/** BreadcrumbList with the visible labels and canonical URLs (7.1). */
export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

const absoluteUrl = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE_ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);
const IN_STOCK = 'https://schema.org/InStock';
const OUT_OF_STOCK = 'https://schema.org/OutOfStock';

/**
 * Product from the normalized document (8.1–8.6): the price shown on page load, no 0 fallback, no rating.
 * Simple -> Offer; variable -> AggregateOffer over the active variants, omitted when there is no price.
 */
export function productJsonLd(p: Product & { slug: string }): Record<string, unknown> {
  const url = canonicalUrl('produk', p.slug);
  let offers: Record<string, unknown> | null = null;
  if (p.productType === 'variable') {
    const active = (p.variants || []).filter(v => v.isActive);
    if (typeof p.priceFrom === 'number' && p.priceFrom > 0) {
      offers = {
        '@type': 'AggregateOffer',
        url,
        priceCurrency: 'IDR',
        lowPrice: p.priceFrom,
        highPrice: typeof p.priceTo === 'number' && p.priceTo >= p.priceFrom ? p.priceTo : p.priceFrom,
        offerCount: active.length,
        availability: (p.totalStock ?? 0) > 0 ? IN_STOCK : OUT_OF_STOCK,
      };
    }
  } else if (typeof p.price === 'number' && p.price > 0) {
    offers = {
      '@type': 'Offer',
      url,
      priceCurrency: 'IDR',
      price: p.price,
      availability: (p.stock ?? 0) > 0 ? IN_STOCK : OUT_OF_STOCK,
      itemCondition: 'https://schema.org/NewCondition',
    };
  }
  const item: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    image: (p.images || []).filter(Boolean).map(absoluteUrl),
    description: plainText(p.description || ''),
    sku: p.productType === 'simple' ? p.sku?.trim() : null,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers,
  };
  return Object.fromEntries(Object.entries(item).filter(([, v]) => !isEmpty(v)));
}

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
