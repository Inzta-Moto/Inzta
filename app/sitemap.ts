import { MetadataRoute } from 'next';
import { getActiveProducts, getArticles, newestDate } from '@/lib/public-content';
import { CATEGORY_SLUGS, categoryHref } from '@/lib/v2/motor-category';
import { categoryIndexable } from '@/components/v2/motor/motor-page';

// ISR like the pages it lists; article and product writes call revalidatePath('/sitemap.xml').
export const revalidate = 3600;

// lastModified is omitted when a document has no date, because the request time would tell Google
// that every URL changed at every crawl.
const lastModified = (ms: number | null) => (ms === null ? {} : { lastModified: new Date(ms) });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

  // Errors propagate (see lib/public-content.ts) so a failed read keeps the last good sitemap.
  const [products, articles] = await Promise.all([getActiveProducts(), getArticles()]);

  // Halaman statis
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      ...lastModified(newestDate([...products, ...articles])),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/produk`,
      ...lastModified(newestDate(products)),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      ...lastModified(newestDate(articles)),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // F-016 S8.7.4: static page without a document date, so no lastModified.
    {
      url: `${baseUrl}/tentang`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // Halaman dinamis produk
  const productRoutes: MetadataRoute.Sitemap = products.map(p => ({
    url: `${baseUrl}/produk/${p.slug}`,
    ...lastModified(newestDate([p])),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // getArticles() returns published articles only (F-012), so drafts never reach the sitemap.
  const articleRoutes: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${baseUrl}/blog/${a.slug}`,
    ...lastModified(newestDate([a])),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // F-016 S5.8.5: only category pages that the same helper as their metadata marks indexable (none at launch).
  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_SLUGS.filter(c => categoryIndexable(c, products)).map(c => ({
    url: `${baseUrl}${categoryHref(c)}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...articleRoutes];
}
