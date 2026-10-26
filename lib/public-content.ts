import { cache } from 'react';
import { getAdminDb, hasAdminCredentials } from '@/lib/firebaseAdmin';
import { normalizeProduct } from '@/lib/product-utils';
import { Article, ArticleCard, Product, PublicArticle } from '@/types';

// Server-only reads for public pages (F-001). Pages using these are ISR, so Firestore is read once per
// regeneration instead of once per visitor. F-010 adds its published-only filter here, not in the pages.

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

// Without credentials (local or CI build without secrets) pages render empty so the build passes, except
// on Vercel Production, where an empty home page and a 404 for every article would be cached for an hour.
// With credentials, errors propagate on purpose: a failed build keeps the previous deployment, and a
// failed background regeneration keeps the last good page in the ISR cache instead of an empty one.
async function readPublic<T>(label: string, read: () => Promise<T>, empty: T): Promise<T> {
  if (!hasAdminCredentials()) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error(`[public-content] ${label}: Firebase Admin credentials missing in production`);
    }
    console.warn(`[public-content] ${label}: no Firebase Admin credentials, rendering empty`);
    return empty;
  }
  return read();
}

function toPublicArticle(id: string, data: Record<string, any>): PublicArticle {
  const { createdAt, updatedAt, ...rest } = data as Article;
  return {
    ...rest,
    slug: id,
    createdAt: toMillis(createdAt),
    updatedAt: toMillis(updatedAt),
  };
}

export function toArticleCard(a: PublicArticle): ArticleCard {
  return { slug: a.slug, title: a.title, excerpt: a.excerpt, images: a.images, imageUrl: a.imageUrl, createdAt: a.createdAt };
}

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

export async function getArticles(): Promise<PublicArticle[]> {
  return readPublic('articles', async () => {
    const snap = await getAdminDb().collection('articles').get();
    return snap.docs.map(d => toPublicArticle(d.id, d.data())).sort(byNewest);
  }, []);
}

// cache() lets generateMetadata and the page share one read per render.
export const getArticle = cache(async (slug: string): Promise<PublicArticle | null> => {
  return readPublic('article', async () => {
    const doc = await getAdminDb().collection('articles').doc(slug).get();
    return doc.exists ? toPublicArticle(doc.id, doc.data() ?? {}) : null;
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
