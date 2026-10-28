import { getAdminDb } from '@/lib/firebaseAdmin';
import { readPublic } from '@/lib/public-content';
import { normalizeProduct } from '@/lib/product-utils';
import { publicDate, statusOf, toPublicArticle } from '@/lib/article-format';
import type { ArticleEmbed, ArticleEmbeds, ProductEmbed, RenderBlock } from '@/types';

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
