import type { Product } from '@/types';
import { toCard } from '@/lib/v2/home-data';
import ProductCardV2 from '@/components/v2/ProductCardV2';

const GRID_SIZES = '(max-width: 767px) 50vw, 25vw';

// "Lengkapi perjalanan Anda" (F-016 S3.8): cards per S0.9 with h3 names under the section h2; hidden when empty.
export default function RelatedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section className="iz-wrap iz-pdp-block">
      <h2 className="t-h2-shop iz-pdp-h2">Lengkapi perjalanan Anda</h2>
      <div className="iz-grid-4">
        {products.map(p => (
          <ProductCardV2 key={p.slug} card={toCard(p)} headingLevel={3} sizes={GRID_SIZES} />
        ))}
      </div>
    </section>
  );
}
