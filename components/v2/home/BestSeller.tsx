import Link from 'next/link';
import type { FlashSaleState, HomeProductCard } from '@/types';
import { isFlashActive } from '@/lib/v2/flash-time';
import BestSellerHead from '@/components/v2/home/BestSellerHead';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import { ArrowRight } from '@/components/v2/icons';

const SCROLLER_ID = 'iz-bestseller';

// F-016 7 and 24.4. Server component: card names and prices are in the server HTML (19.2); only the heading area
// (arrows or flash-sale countdown) is a client island. No best seller and no sale: no section (7.2). A sale with no
// best seller: the flash panel renders alone (24.4).
export default function BestSeller({ cards, flash }: { cards: HomeProductCard[]; flash: FlashSaleState }) {
  const flashActive = isFlashActive(flash, Date.now());
  if (cards.length === 0 && !flashActive) return null;

  return (
    <section className="iz-section--tight" style={{ paddingTop: 0 }}>
      <div className="iz-wrap">
        <BestSellerHead flash={flash} scrollerId={SCROLLER_ID} hasCards={cards.length > 0} />
        {cards.length > 0 && (
          <>
            <div id={SCROLLER_ID} className="iz-scroller iz-row-cards">
              {cards.map(card => (
                <ProductCardV2 key={card.slug} card={card} best />
              ))}
            </div>
            <Link className="iz-link" href="/produk" style={{ marginTop: 16 }}>
              Lihat semua produk <ArrowRight width={18} height={18} />
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
