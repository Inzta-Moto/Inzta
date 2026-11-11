import type { Product } from '@/types';
import { getActiveProducts } from '@/lib/public-content';
import { sectionMetadata } from '@/lib/seo';
import V2Layout from '@/components/v2/V2Layout';
import GaransiPage from '@/components/v2/warranty/GaransiPage';
import '@/app/(v2)/v2-warranty.css';

// F-031 2.1: server-rendered v2 page, ISR like /toko; product saves purge it with the other v2 frame pages
// (lib/revalidate.ts). The forms fetch their own timer token, so the cached HTML holds no time-bound value.
export const revalidate = 3600;

export const metadata = sectionMetadata('garansi');

export default async function Page() {
  // The navbar needs the active products anyway; the same read fills the product choice of both forms. A failed read
  // keeps the page up with only "Lainnya" in the list.
  const products = await getActiveProducts().catch((e: unknown): Product[] => {
    console.error('[garansi] products read failed:', e);
    return [];
  });
  const options = products
    .flatMap(p => (p.slug && p.name ? [{ slug: p.slug, name: p.name }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return (
    <V2Layout products={products} current="garansi">
      <GaransiPage products={options} />
    </V2Layout>
  );
}
