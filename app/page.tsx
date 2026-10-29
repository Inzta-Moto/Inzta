import HomeClient from './HomeClient';
import { getActiveProducts, getArticles, toArticleCard } from '@/lib/public-content';
import { canonicalUrl } from '@/lib/seo';

export const metadata = { alternates: { canonical: canonicalUrl() } };

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath.
export const revalidate = 3600;

export default async function HomePage() {
  const [products, articles] = await Promise.all([getActiveProducts(), getArticles()]);

  return (
    <HomeClient
      products={products.slice(0, 10)}
      articles={articles.slice(0, 3).map(toArticleCard)}
    />
  );
}
