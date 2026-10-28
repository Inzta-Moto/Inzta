import { cache } from 'react';
import { getAdminDb, hasAdminCredentials } from '@/lib/firebaseAdmin';
import { normalizeProduct } from '@/lib/product-utils';
import { publicDate, statusOf, toMillis, toPublicArticle } from '@/lib/article-format';
import { Article, ArticleCard, Product, PublicArticle } from '@/types';

export { toMillis, toPublicArticle };

// Server-only reads for public pages (F-001). Pages using these are ISR, so Firestore is read once per
// regeneration instead of once per visitor. The published-only filter (F-012) lives here and nowhere else.

// Without credentials (local or CI build without secrets) pages render empty so the build passes, except
// on Vercel Production, where an empty home page and a 404 for every article would be cached for an hour.
// With credentials, errors propagate on purpose: a failed build keeps the previous deployment, and a
// failed background regeneration keeps the last good page in the ISR cache instead of an empty one.
export async function readPublic<T>(label: string, read: () => Promise<T>, empty: T): Promise<T> {
  if (!hasAdminCredentials()) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error(`[public-content] ${label}: Firebase Admin credentials missing in production`);
    }
    console.warn(`[public-content] ${label}: no Firebase Admin credentials, rendering empty`);
    return empty;
  }
  return read();
}

export function toArticleCard(a: PublicArticle): ArticleCard {
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    images: a.images,
    imageUrl: a.imageUrl,
    coverImage: a.coverImage,
    coverAlt: a.coverAlt,
    createdAt: a.createdAt,
    publishedAt: a.publishedAt,
  };
}

// Legacy documents have no status and are published (requirement 1.2).
const isPublished = (a: Pick<Article, 'status'>) => statusOf(a) === 'published';

const byNewest =(a: { createdAt: number | null }, b: { createdAt: number | null }) =>
  (b.createdAt ?? 0) - (a.createdAt ?? 0);

export async function getActiveProducts(): Promise<Product[]> {
  return readPublic('products', async () => {
    const snap = await getAdminDb().collection('products').where('isActive', '==', true).get();
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          ...normalizeProduct(d.id, data),
          slug: d.id,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        } as unknown as Product & { createdAt: number | null };
      })
      .sort(byNewest);
  }, []);
}

// Drafts are filtered in memory after the same collection read: legacy documents have no status field,
// and a Firestore where('status', '==', 'published') would skip them.
export async function getArticles(): Promise<PublicArticle[]> {
  return readPublic('articles', async () => {
    const snap = await getAdminDb().collection('articles').get();
    return snap.docs
      .map(d => toPublicArticle(d.id, d.data()))
      .filter(isPublished)
      .sort((a, b) => (publicDate(b) ?? 0) - (publicDate(a) ?? 0));
  }, []);
}

// cache() lets generateMetadata and the page share one read per render. A draft is null, so
// /blog/{slug} is a 404 for everyone; admins preview drafts on /admin/pratinjau/{slug}.
export const getArticle = cache(async (slug: string): Promise<PublicArticle | null> => {
  return readPublic('article', async () => {
    const doc = await getAdminDb().collection('articles').doc(slug).get();
    if (!doc.exists) return null;
    const article = toPublicArticle(doc.id, doc.data() ?? {});
    return isPublished(article) ? article : null;
  }, null);
});

export function newestDate(items: { createdAt?: number | null; updatedAt?: number | null }[]): number | null {
  let newest: number | null = null;
  for (const item of items) {
    const ms = item.updatedAt ?? item.createdAt ?? null;
    if (ms !== null && (newest === null || ms > newest)) newest = ms;
  }
  return newest;
}
