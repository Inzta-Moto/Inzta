import { notFound } from 'next/navigation';
import type { Product } from '@/types';
import { getActiveProducts } from '@/lib/public-content';
import { sectionMetadata } from '@/lib/seo';
import { PARTNER_STORES } from '@/lib/v2/partner-stores';
import V2Layout from '@/components/v2/V2Layout';
import StorePage from '@/components/v2/store/StorePage';
import '@/app/(v2)/v2-about.css';
import '@/app/(v2)/v2-store.css';

// F-027 B1: static shop data, but the navbar prices and flash-sale state in V2Layout are read on the server, so the
// page is ISR like /kebijakan-privasi. v2-about.css carries the route map styles of the card's dark panel.
export const revalidate = 3600;

// B7: own title, description, canonical, and Open Graph; no Store/LocalBusiness JSON-LD (ADR-0036 point 6).
export const metadata = sectionMetadata('toko');

export default async function TokoPage() {
  if (PARTNER_STORES.length === 0) notFound();
  // The navbar needs the active products anyway, so the same read names the bags a shop displays. A failed read hides
  // the navbar prices and the product list instead of failing the page, as on /tentang.
  const products = await getActiveProducts().catch((e: unknown): Product[] => {
    console.error('[toko] products read failed:', e);
    return [];
  });
  const productNames = Object.fromEntries(products.flatMap(p => (p.slug ? [[p.slug, p.name]] : [])));
  return (
    <V2Layout products={products}>
      <StorePage stores={PARTNER_STORES} productNames={productNames} />
    </V2Layout>
  );
}
