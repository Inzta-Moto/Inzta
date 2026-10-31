import { cache } from 'react';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { normalizeProduct } from '@/lib/product-utils';
import { readPublic, toMillis } from '@/lib/public-content';
import { fixtureProducts } from '@/lib/v2/dev-fixture';
import type { Product } from '@/types';

// One product read per render, shared by generateMetadata and the page (F-016 S3.10.1). A read error propagates
// (S3.10.3): ISR keeps the last good page or the route shows error.tsx; it never caches a "not found" for a product
// that exists. F-003 task 4: an inactive product (or a legacy one without isActive, which the catalog and sitemap
// also skip) reads as missing, so its page answers 404 like the catalog and the public product API.
export const getProduct = cache(async (slug: string): Promise<Product | null> => {
  // F-016 A5: local fixture in development only; it holds active products only.
  const fixture = fixtureProducts();
  if (fixture) return fixture.find(p => p.slug === slug) ?? null;
  return readPublic('product', async () => {
    const doc = await getAdminDb().collection('products').doc(slug).get();
    if (!doc.exists) return null;
    const data = doc.data() ?? {};
    if (data.isActive !== true) return null;
    // Dates become epoch milliseconds so the product can be passed to client components.
    return {
      ...normalizeProduct(slug, data),
      slug,
      createdAt: toMillis(data.createdAt),
      updatedAt: toMillis(data.updatedAt),
    } as unknown as Product;
  }, null);
});
