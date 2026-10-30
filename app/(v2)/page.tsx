import HomeV2 from '@/components/v2/HomeV2';
import JsonLd from '@/components/JsonLd';
import { getActiveProducts, getArticles } from '@/lib/public-content';
import { getFlashSale } from '@/lib/v2/flash-sale';
import { buildHomeData, readHomeSources } from '@/lib/v2/home-data';
import { homeJsonLd, sectionMetadata } from '@/lib/seo';

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath (F-001, S1.11.1).
// F-016: the flash-sale state is read in the same render so the promo bar is in the HTML and never shifts the page.
// A products read failure throws (S1.11.2); articles and flash-sale failures only drop their sections (S1.8.4, S0.3.6).
export const revalidate = 3600;

// F-005 phase 2 owns the Beranda title, description, canonical, and Open Graph (F-016 C-3, design.md §9).
export const metadata = sectionMetadata('home');

export default async function HomePage() {
  const { products, articles, flash } = await readHomeSources({
    products: getActiveProducts,
    articles: getArticles,
    flash: getFlashSale,
  });
  return (
    <>
      {/* F-005 9.1, 9.2: Organization + WebSite, no SearchAction. */}
      <JsonLd data={homeJsonLd()} />
      <HomeV2 data={buildHomeData(products, articles, flash)} products={products} />
    </>
  );
}
