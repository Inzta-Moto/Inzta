import type { Metadata } from 'next';
import type { Product } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { getActiveProducts } from '@/lib/public-content';
import { toCartCatalog } from '@/lib/cart/catalog';
import V2Layout from '@/components/v2/V2Layout';
import CartPage from '@/components/v2/cart/CartPage';

// F-030 E9: ISR like the other v2 pages; product saves purge it through revalidateProductPaths (lib/revalidate.ts).
export const revalidate = 3600;

// The cart lives in the visitor's browser, so the page has nothing to index; links on it are still followed.
export const metadata: Metadata = {
  title: 'Keranjang',
  description: 'Daftar barang pilihan untuk dipesan via WhatsApp.',
  robots: { index: false, follow: true },
};

export default async function KeranjangPage() {
  // D-2: the same active-product read as the navbar prices, so opening the cart adds no Firestore read. A failed read
  // keeps the page up with the stored cart and a note (E15) instead of marking every line unavailable.
  let products: Product[] | null;
  try {
    products = await getActiveProducts();
  } catch (e) {
    console.error('[keranjang] products read failed:', e);
    products = null;
  }
  // Review REV-10: an empty list means the read gave nothing (no Admin credentials outside production); a running
  // shop always has active products, so it is treated as unknown instead of marking every line unavailable.
  const catalog = products && products.length > 0 ? toCartCatalog(products) : null;
  return (
    <V2Layout current="keranjang" products={products ?? []}>
      <CartPage catalog={catalog} waHref={`https://wa.me/${WA_NUMBER}`} />
    </V2Layout>
  );
}
