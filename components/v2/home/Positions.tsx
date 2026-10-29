import Image from 'next/image';
import Link from 'next/link';
import type { BagPosition } from '@/types';
import { formatRupiah } from '@/lib/v2/home-data';
import { POSITION_ITEMS } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

// Tiles are 4:5 and about 280 px wide on desktop (a quarter of the content) and 72% wide in the phone swipe row.
const TILE_SIZES = '(max-width: 767px) 72vw, 25vw';

// alt="" because the tile's h3 already names the link (S0.12.6). Local photos go through next/image (tk-highway-3.jpg
// alone is 650 KB); Cloudinary photos go through SmartImage for the shimmer and the fallback tile (ST-PART). The tile
// background is --c-aspal, so the dark tone keeps the white text readable when a photo fails.
function TileImage({ src }: { src: string }) {
  if (!src.includes('res.cloudinary.com')) {
    return <Image src={src} alt="" width={320} height={400} sizes={TILE_SIZES} />;
  }
  return <SmartImage src={src} alt="" tone="dark" sizes={TILE_SIZES} widths={[320, 640, 960]} width={640} />;
}

// "Taruh tas di mana?" (F-016 S1.5). Each tile is one link to the catalog filtered by its position (S0.4.3). The
// starting price is the lowest effective price of that position's active products at render (S1.5.1); without an
// active product the price line is left out and the empty span keeps the arrow on the right (S1.5.2).
export default function Positions({ minPrices }: { minPrices: Record<BagPosition, number | null> }) {
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head">
          <h2 className="t-h2-landing">Taruh tas di mana?</h2>
        </div>
        <div className="iz-grid-4 iz-cats" data-reveal-stagger="">
          {POSITION_ITEMS.map(item => {
            const min = minPrices[item.value];
            return (
              <Link key={item.value} className="iz-cat" href={`/produk?posisi=${item.value}`}>
                <TileImage src={item.image} />
                <div className="iz-cat__body">
                  <h3>{item.tileTitle}</h3>
                  <p>{item.tileText}</p>
                  <div className="iz-cat__foot">
                    {min !== null ? <span>Mulai {formatRupiah(min)}</span> : <span />}
                    <span className="iz-arrow">
                      <ArrowRight />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
