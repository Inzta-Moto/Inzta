import HomeClient from './HomeClient';
import JsonLd from '@/components/JsonLd';
import { getActiveProducts, getArticles, toArticleCard } from '@/lib/public-content';
import { homeJsonLd, sectionMetadata } from '@/lib/seo';

export const metadata = sectionMetadata('home');

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath.
export const revalidate = 3600;

export default async function HomePage() {
  const [products, articles] = await Promise.all([getActiveProducts(), getArticles()]);

  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <HomeClient
        products={products.slice(0, 10)}
        articles={articles.slice(0, 3).map(toArticleCard)}
      />
    </>
  );
}
