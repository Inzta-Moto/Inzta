import type { Metadata } from 'next';
import HomeV2 from '@/components/v2/HomeV2';
import { getActiveProducts, getArticles } from '@/lib/public-content';
import { getFlashSale } from '@/lib/v2/flash-sale';
import { buildHomeData, readHomeSources } from '@/lib/v2/home-data';
import { canonicalUrl } from '@/lib/seo';

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath (F-001, S1.11.1).
// F-016: the flash-sale state is read in the same render so the promo bar is in the HTML and never shifts the page.
// A products read failure throws (S1.11.2); articles and flash-sale failures only drop their sections (S1.8.4, S0.3.6).
export const revalidate = 3600;

// Title and description are the root defaults (E5, design.md §9); the Beranda only adds its canonical.
export const metadata: Metadata = { alternates: { canonical: canonicalUrl() } };

export default async function HomePage() {
  const { products, articles, flash } = await readHomeSources({
    products: getActiveProducts,
    articles: getArticles,
    flash: getFlashSale,
  });
  return <HomeV2 data={buildHomeData(products, articles, flash)} products={products} />;
}
