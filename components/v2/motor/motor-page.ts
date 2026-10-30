import type { HomeProductCard, MotorCategory, Product, ProductPosition, PublicArticle } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { extractEmbeds, isAllowedImageUrl, publicDate } from '@/lib/article-format';
import { isCategoryIndexable, productsForCategory, universalProducts } from '@/lib/v2/motor-category';
import { articleCategories, normalizeTopik } from '@/lib/v2/article-v2';
import { positionOf, positionsOf, toCard } from '@/lib/v2/home-data';
import { categoryLabel } from '@/lib/v2/home-content';

// Pure data rules of the per-category page (F-016 S5). No Firebase or React imports, so tests/f016-motor.cjs and
// app/sitemap.ts can load it.

// S5.1: approved lead lines (CONTENT.md, 2026-10-29). Categories without one show P-17 until RND approves a line.
const APPROVED_LEAD: Partial<Record<MotorCategory, string>> = {
  retro:
    'Side bag dan tas tangki INZTA untuk motor retro seperti Yamaha XSR 155, dari tas samping ringkas untuk harian sampai side bag 20 liter untuk touring.',
};
// Categories without an approved line get a neutral lead that names no model (S5.1.1) and points to the admin.
export function fallbackLead(label: string): string {
  return `Tas INZTA untuk motor ${label}. Ragu soal ukuran? Tanyakan ke admin lewat WhatsApp.`;
}

export const UNIVERSAL_MAX = 3;
export const THUMBS_MAX = 4;
export const TOPICS_MAX = 3;

// S5.2: only these three position tabs, in canvas order.
export const TAB_POSITIONS: readonly { key: ProductPosition; label: string }[] = [
  { key: 'side', label: 'Side bag' },
  { key: 'tank', label: 'Tank bag' },
  { key: 'tail', label: 'Tail bag' },
];

const XSR_155 = /xsr\s?155/i;

const createdMs = (p: Product): number => {
  const v = (p as { createdAt?: unknown }).createdAt;
  return typeof v === 'number' ? v : 0;
};
const isBest = (p: Product) => (p.badge ?? '').toLowerCase().includes('best');

// S5.3.1, S5.5: best sellers first, then newest. Array.prototype.sort is stable, so equal items keep their order.
export function sortForCategory(products: readonly Product[]): Product[] {
  return [...products].sort((a, b) => Number(isBest(b)) - Number(isBest(a)) || createdMs(b) - createdMs(a));
}

// S5.1.3 (E7): every claim of the Retro line is backed by a listed product, else the lead falls back to P-17.
function retroLeadBacked(listed: readonly Product[]): boolean {
  const side = listed.filter(p => positionOf(p) === 'side');
  return (
    side.length > 0 &&
    listed.some(p => positionOf(p) === 'tank') &&
    listed.some(p => XSR_155.test(p.name)) &&
    side.some(p => p.name.toLowerCase().includes('20l'))
  );
}

// S5.1, S5.1.1, S5.1.3: the approved lead, or null while the placeholder P-17 shows.
export function approvedLead(c: MotorCategory, forCategory: readonly Product[], universal: readonly Product[]): string | null {
  const line = APPROVED_LEAD[c];
  if (!line) return null;
  if (c === 'retro' && !retroLeadBacked([...forCategory, ...universal])) return null;
  return line;
}

// S5.8.4, S5.8.5: one call shared by the page metadata and app/sitemap.ts.
export function categoryIndexable(c: MotorCategory, products: readonly Product[]): boolean {
  const forCategory = productsForCategory(products, c);
  const lead = approvedLead(c, forCategory, universalProducts(products).slice(0, UNIVERSAL_MAX));
  return isCategoryIndexable(c, products, lead !== null);
}

// S5.8.3: description = the lead shown in the hero, else the new string of design.md §11.
export function categoryDescription(c: MotorCategory, lead: string | null): string {
  return lead ?? `Tas INZTA untuk motor ${categoryLabel(c)}.`;
}

// F-005 6.2: the root layout template adds " | INZTA Moto", so the title carries no brand of its own.
export function categoryTitle(c: MotorCategory): string {
  return `Tas untuk motor ${categoryLabel(c)}`;
}

// S5.9.3: prefilled text (new string), URL-encoded once here.
export function consultHref(c: MotorCategory, waNumber: string = WA_NUMBER): string {
  const text = `Halo INZTA, saya ingin konsultasi tas untuk motor ${categoryLabel(c)} saya`;
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
}

export interface CategoryTab {
  key: ProductPosition | 'semua';
  label: string;
}

// S5.2.2: a position tab exists only when a product of S5.3 has that position; the tablist only with two or more.
export function categoryTabs(products: readonly Product[]): CategoryTab[] {
  const present = new Set(products.flatMap(p => positionsOf(p)));
  const tabs = TAB_POSITIONS.filter(t => present.has(t.key));
  return tabs.length >= 2 ? [{ key: 'semua', label: 'Semua' }, ...tabs] : [];
}

// S5.6.1: inline Markdown reduced to plain text for the "Yang dibahas" list.
export function inlineText(md: string): string {
  return md
    .replace(/\s*\{[^{}]*\}\s*$/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/(^|[^\w*])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?!\s)([^_]+?)_(?!\w)/g, '$1$2')
    .replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// S5.6.1: the first ATX "## " headings outside fenced code, Markdown articles only (legacy plain → none).
export function articleH2s(a: Pick<PublicArticle, 'content' | 'contentFormat'>, max = TOPICS_MAX): string[] {
  if (a.contentFormat !== 'markdown') return [];
  const out: string[] = [];
  let fence: { ch: string; len: number } | null = null;
  // Stored articles can use CRLF line ends.
  for (const line of (a.content ?? '').split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      const mark = { ch: f[1][0], len: f[1].length };
      if (!fence) fence = mark;
      else if (mark.ch === fence.ch && mark.len >= fence.len && line.trim() === f[1]) fence = null;
      continue;
    }
    if (fence) continue;
    const h = /^ {0,3}##[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!h) continue;
    const text = inlineText(h[1]);
    if (text) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export interface ArticleThumb {
  slug: string;
  name: string;
  image: string;
}

// S5.6.2: product embeds in order of first appearance, resolved against the products the page already read; missing,
// inactive, and photo-less products are skipped.
export function articleThumbs(content: string | undefined, activeProducts: readonly Product[], max = THUMBS_MAX): ArticleThumb[] {
  const bySlug = new Map(activeProducts.map(p => [p.slug, p]));
  const seen = new Set<string>();
  const out: ArticleThumb[] = [];
  for (const ref of extractEmbeds(content ?? '')) {
    if (ref.kind !== 'produk' || seen.has(ref.slug)) continue;
    seen.add(ref.slug);
    const p = bySlug.get(ref.slug);
    const image = p ? p.images?.[0] || p.imageUrl || null : null;
    if (!p || p.isActive === false || !image) continue;
    out.push({ slug: p.slug, name: p.name, image });
    if (out.length >= max) break;
  }
  return out;
}

// S5.6: newest per-motor article of this category (published only; getArticles() already filters drafts).
export function pickCategoryArticle(articles: readonly PublicArticle[], c: MotorCategory): PublicArticle | null {
  const matches = articles
    .map((a, i) => ({ a, i, d: publicDate(a) }))
    .filter(({ a }) => normalizeTopik(a.topik) === 'per-motor' && articleCategories(a).includes(c))
    .sort((x, y) => (y.d ?? -Infinity) - (x.d ?? -Infinity) || x.i - y.i);
  return matches[0]?.a ?? null;
}

// "24 Oktober 2026" in Jakarta time, identical on server and client.
export function formatLongDate(ms: number | null): string {
  if (ms === null) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(ms));
}

export interface CategoryArticle {
  slug: string;
  title: string;
  cover: string | null;
  coverAlt: string;
  meta: string;
  topics: string[];
  thumbs: ArticleThumb[];
}

export interface CategoryPageData {
  category: MotorCategory;
  label: string;
  lead: string | null;
  cards: HomeProductCard[];
  // Position keys per card, in grid order; the only data the tab island receives (S5.2.3).
  cardPositions: ProductPosition[][];
  tabs: CategoryTab[];
  universal: HomeProductCard[];
  showInstallNotice: boolean;
  article: CategoryArticle | null;
}

export function buildCategoryPage(c: MotorCategory, products: readonly Product[], articles: readonly PublicArticle[]): CategoryPageData {
  const forCategory = sortForCategory(productsForCategory(products, c));
  const universal = sortForCategory(universalProducts(products)).slice(0, UNIVERSAL_MAX);
  const lead = approvedLead(c, forCategory, universal);
  const a = pickCategoryArticle(articles, c);
  const date = a ? publicDate(a) : null;
  return {
    category: c,
    label: categoryLabel(c),
    lead,
    cards: forCategory.map(toCard),
    cardPositions: forCategory.map(p => positionsOf(p)),
    tabs: forCategory.length ? categoryTabs(forCategory) : [],
    universal: universal.map(toCard),
    // S5.4.1: Retro only, and only while an XSR 155 product is listed.
    showInstallNotice: c === 'retro' && forCategory.some(p => XSR_155.test(p.name)),
    article: a
      ? {
          slug: a.slug,
          title: a.title,
          cover: isAllowedImageUrl(a.coverImage) ? (a.coverImage as string) : null,
          coverAlt: a.coverAlt?.trim() ?? '',
          meta: date === null ? 'Tim INZTA' : `Tim INZTA · ${formatLongDate(date)}`,
          topics: articleH2s(a),
          thumbs: articleThumbs(a.content, products),
        }
      : null,
  };
}
