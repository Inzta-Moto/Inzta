import HomeClient from './HomeClient';
import { getActiveFeatures, getActiveProducts, getArticles } from '@/lib/public-content';

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath.
export const revalidate = 3600;

export default async function HomePage() {
  const [products, features, articles] = await Promise.all([
    getActiveProducts(),
    getActiveFeatures(),
    getArticles(),
  ]);

  return (
    <HomeClient
      products={products.slice(0, 10)}
      features={features}
      articles={articles.slice(0, 3)}
    />
  );
}
