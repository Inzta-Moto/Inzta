import { getAdminDb } from '@/lib/firebaseAdmin';
import { readPublic } from '@/lib/public-content';
import { fixtureArticles, fixtureProducts } from '@/lib/v2/dev-fixture';
import { normalizeProduct } from '@/lib/product-utils';
import { publicDate, statusOf, toPublicArticle } from '@/lib/article-format';
import type { ArticleEmbed, ArticleEmbeds, MotorCategory, Product, ProductEmbed, RenderBlock } from '@/types';
import { CATEGORY_SLUGS, productsForCategory, universalProducts } from '@/lib/v2/motor-category';
import { sortForCategory } from '@/components/v2/motor/motor-page';

// Server only (F-013 phase C, requirement 19): card data for the [[produk:…]] and [[artikel:…]] markers of
// one article. Inactive products, unpublished articles, missing documents, and the article itself are left
// out, so their markers render nothing on the public page (K-4).

const httpsOrNull = (url: unknown) => (typeof url === 'string' && url.startsWith('https://') ? url : null);
const positive = (n: unknown) => (typeof n === 'number' && n > 0 ? n : null);

// Same prices as the product grid (ProductCard), so one product never shows two prices (K-8).
export function toProductEmbed(p: Record<string, any>): ProductEmbed {
  const variable = p.productType === 'variable';
  const activeVariants: any[] = variable ? (p.variants || []).filter((v: any) => v && v.isActive) : [];
  const price = positive(variable ? p.priceFrom : p.price);
  const top = variable ? positive(p.priceTo) : null;
  const compare = variable ? Math.max(0, ...activeVariants.map(v => positive(v.compareAtPrice) ?? 0)) : positive(p.compareAtPrice);
  // Unknown stock (legacy documents without the field) counts as available (K-9).
  const stock = variable ? p.totalStock : p.stock;
  return {
    slug: p.slug,
    name: String(p.name || ''),
    image: httpsOrNull(p.images?.[0]),
    price,
    priceTo: price !== null && top !== null && top > price ? top : null,
    compareAtPrice: price !== null && compare && compare > price ? compare : null,
    inStock: typeof stock !== 'number' || stock > 0,
  };
}

export function toArticleEmbed(id: string, data: Record<string, any>): ArticleEmbed {
  const a = toPublicArticle(id, data);
  const image = httpsOrNull(a.coverImage) ?? httpsOrNull(a.images?.[0]) ?? httpsOrNull(a.imageUrl);
  return {
    slug: id,
    title: String(a.title || ''),
    excerpt: String(a.excerpt || ''),
    image,
    date: publicDate(a),
  };
}

const EMPTY: ArticleEmbeds = { products: {}, articles: {} };

/** One getAll for every marker of the article; no read at all without markers (19.1). */
export async function resolveEmbeds(blocks: RenderBlock[], opts: { exclude?: string } = {}): Promise<ArticleEmbeds> {
  const products = Array.from(new Set(blocks.flatMap(b => (b.type === 'product' ? [b.slug] : []))));
  const articles = Array.from(new Set(blocks.flatMap(b => (b.type === 'article' && b.slug !== opts.exclude ? [b.slug] : []))));
  if (!products.length && !articles.length) return EMPTY;
  // F-017: the local fixture (development only, F016_FIXTURE) answers the cards too, so the article rails can be
  // reviewed without Firebase credentials.
  const fxProducts = fixtureProducts();
  const fxArticles = fixtureArticles();
  if (fxProducts && fxArticles) {
    const out: ArticleEmbeds = { products: {}, articles: {} };
    for (const p of fxProducts) if (products.includes(p.slug)) out.products[p.slug] = toProductEmbed(p as unknown as Record<string, any>);
    for (const a of fxArticles) if (articles.includes(a.slug)) out.articles[a.slug] = toArticleEmbed(a.slug, a as unknown as Record<string, any>);
    return out;
  }
  return readPublic('embeds', async () => {
    const db = getAdminDb();
    const refs = [...products.map(s => db.collection('products').doc(s)), ...articles.map(s => db.collection('articles').doc(s))];
    const snaps = await db.getAll(...refs);
    const out: ArticleEmbeds = { products: {}, articles: {} };
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      const data = snap.data() ?? {};
      if (i < products.length) {
        if (data.isActive === true) out.products[snap.id] = toProductEmbed({ ...normalizeProduct(snap.id, data), slug: snap.id });
      } else if (statusOf(data) === 'published') {
        out.articles[snap.id] = toArticleEmbed(snap.id, data);
      }
    });
    return out;
  }, EMPTY);
}

/** Blocks for the public page: cards without public data are left out, so their slugs never reach the browser. */
/** F-017: slugs of the "Baca juga" cards that will show, so "Artikel lain" can pass over them. */
export const shownArticleSlugs = (blocks: RenderBlock[], embeds: ArticleEmbeds): string[] =>
  Array.from(new Set(blocks.flatMap(b => (b.type === 'article' && embeds.articles[b.slug] ? [b.slug] : []))));

export const visibleBlocks = (blocks: RenderBlock[], embeds: ArticleEmbeds): RenderBlock[] =>
  blocks.filter(b => b.type === 'html' || Boolean(b.type === 'product' ? embeds.products[b.slug] : embeds.articles[b.slug]));

// F-017: bags for each motor category, for the "Untuk motor <kategori>" box of article pages. Same set and order as
// the category page (F-016 S5.3: tagged with the category but not universal, best sellers first, then newest); card
// fields only. A category without bags of its own gets the universal ones (tagged with all four, the category page's
// "Bisa juga"), so a chosen motor always finds a bag. The visitor's category is only known in the browser, so every
// category is sent, at most three each.
export const MOTOR_PRODUCTS_MAX = 3;
export function motorRailProducts(products: readonly Product[], max = MOTOR_PRODUCTS_MAX): Partial<Record<MotorCategory, ProductEmbed[]>> {
  const out: Partial<Record<MotorCategory, ProductEmbed[]>> = {};
  for (const c of CATEGORY_SLUGS) {
    const own = sortForCategory(productsForCategory(products, c));
    const list = (own.length ? own : sortForCategory(universalProducts(products))).slice(0, max);
    if (list.length) out[c] = list.map(p => toProductEmbed(p as unknown as Record<string, any>));
  }
  return out;
}
