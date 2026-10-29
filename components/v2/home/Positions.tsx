import Image from 'next/image';
import Link from 'next/link';
import type { BagPosition } from '@/types';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { formatRupiah } from '@/lib/v2/home-data';
import { POSITION_ITEMS } from '@/lib/v2/home-content';
import { ArrowRight } from '@/components/v2/icons';

// Tiles are 4:5 and about 280 px wide on desktop (a quarter of the content) and on phones (72% scroller item).
const TILE_W = 320;
const TILE_H = 400;
const TILE_SIZES = '(max-width: 767px) 72vw, 25vw';

// alt="" because the tile's h3 already names the position (20.5, D-9).
// Local photos go through next/image (design.md 6); tk-highway-3.jpg alone is 650 KB.
function TileImage({ src }: { src: string }) {
  if (!src.includes('res.cloudinary.com')) {
    return <Image src={src} alt="" width={TILE_W} height={TILE_H} sizes={TILE_SIZES} />;
  }
  const src1x = optimizeCloudinaryUrl(src, TILE_W, TILE_H);
  const src2x = optimizeCloudinaryUrl(src, TILE_W * 2, TILE_H * 2);
  return (
    <img
      src={src1x}
      srcSet={`${src1x} 1x, ${src2x} 2x`}
      alt=""
      width={TILE_W}
      height={TILE_H}
      loading="lazy"
      decoding="async"
    />
  );
}

// "Taruh tas di mana?" (F-016 9). Every tile links to /produk until the Katalog has a position filter (P-16).
// Without an active product the price line is left out (9.3); the empty span keeps the arrow on the right.
export default function Positions({ minPrices }: { minPrices: Record<BagPosition, number | null> }) {
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head">
          <h2 className="t-h2-landing">Taruh tas di mana?</h2>
        </div>
        <div className="iz-grid-4 iz-cats">
          {POSITION_ITEMS.map(item => {
            const min = minPrices[item.value];
            return (
              <Link key={item.value} className="iz-cat" href="/produk">
                <TileImage src={item.image} />
                <div className="iz-cat__body">
                  <h3>{item.tileTitle}</h3>
                  <p>{item.tileText}</p>
                  <div className="iz-cat__foot">
                    {min !== null ? <span>Mulai {formatRupiah(min)}</span> : <span />}
                    <span className="iz-arrow"><ArrowRight /></span>
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
