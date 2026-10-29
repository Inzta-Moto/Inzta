import HomeV2 from '@/components/v2/HomeV2';
import { getActiveProducts, getArticles } from '@/lib/public-content';
import { getFlashSale } from '@/lib/v2/flash-sale';
import { buildHomeData } from '@/lib/v2/home-data';

// ISR: rendered on the server so Google sees products and articles; admin writes call revalidatePath (F-001).
// F-016: the flash-sale state is read in the same render so the promo bar is in the HTML and never shifts the page.
export const revalidate = 3600;

export default async function HomePage() {
  const [products, articles, flash] = await Promise.all([getActiveProducts(), getArticles(), getFlashSale()]);
  return <HomeV2 data={buildHomeData(products, articles, flash)} />;
}
