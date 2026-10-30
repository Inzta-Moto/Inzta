import '@/app/(v2)/v2-catalog.css';
import V2Layout from '@/components/v2/V2Layout';
import CatalogPage from '@/components/v2/catalog/CatalogPage';
import { toCatalogItem } from '@/components/v2/catalog/filter';
import { getActiveProducts } from '@/lib/public-content';
import { WA_NUMBER } from '@/lib/constants';
import { sectionMetadata } from '@/lib/seo';

// F-016 E1, S2.7.1: ISR instead of force-dynamic; product and stock writes purge /produk (revalidateProductPaths).
// The query string is read on the client only (S2.2.8), so the route stays static.
export const revalidate = 3600;

// F-005 phase 2 owns the title, description, canonical (absolute, never the query, S2.7.3), and Open Graph
// (F-016 C-3 replaces design.md §9 "Semua tas motor INZTA").
export const metadata = sectionMetadata('produk');

// S2.7.2: a failed read throws (getActiveProducts does not catch), so the last good ISR page keeps being served,
// else app/produk/error.tsx; an empty list is never rendered or cached because of an error.
export default async function ProdukPage() {
  const products = await getActiveProducts();
  return (
    <V2Layout current="produk" products={products} dark={false}>
      <CatalogPage items={products.map(toCatalogItem)} waHref={`https://wa.me/${WA_NUMBER}`} />
    </V2Layout>
  );
}
