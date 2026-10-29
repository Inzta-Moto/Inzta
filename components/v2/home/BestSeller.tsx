import Link from 'next/link';
import type { FlashSaleState, HomeProductCard } from '@/types';
import { endsAtMs } from '@/lib/v2/flash-time';
import BestSellerHead, { FlashOnlySection } from '@/components/v2/home/BestSellerHead';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import { ArrowRight } from '@/components/v2/icons';

const SCROLLER_ID = 'iz-bestseller';

// F-016 S1.3. Server component: card names and prices are in the server HTML (G-S2); only the heading area (arrows or
// the flash countdown) is a client island. The flash state is already normalised by buildHomeData (ended → none).
// No card and no sale: no section (S1.3.4). A sale without cards: the panel alone, removed when the sale ends.
export default function BestSeller({ cards, flash }: { cards: HomeProductCard[]; flash: FlashSaleState }) {
  if (cards.length === 0) {
    return flash.isActive === true && endsAtMs(flash) !== null ? <FlashOnlySection flash={flash} /> : null;
  }

  return (
    <section className="iz-section--tight" style={{ paddingTop: 0 }} data-motion="best">
      <div className="iz-wrap">
        <BestSellerHead flash={flash} scrollerId={SCROLLER_ID} />
        {/* S1.3.6: without JavaScript a thin scrollbar shows on fine pointers (v2-home.css). Cards carry no flash label
            or flash price (S1.3.7). */}
        <div id={SCROLLER_ID} className="iz-scroller iz-row-cards" data-reveal-stagger="">
          {cards.map(card => (
            <ProductCardV2 key={card.slug} card={card} best />
          ))}
        </div>
        <Link className="iz-link" href="/produk" style={{ marginTop: 16 }}>
          Lihat semua produk <ArrowRight width={18} height={18} />
        </Link>
      </div>
    </section>
  );
}
