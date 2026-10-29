import Link from 'next/link';
import type { HomeProductCard } from '@/types';
import { generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';
import { formatRupiah } from '@/lib/v2/home-data';
import { POSITION_CHIP } from '@/lib/v2/home-content';

// Card widths: 282 px on desktop, 70% of the viewport on phones (bundle.css .iz-row-cards).
const CARD_SIZES = '(max-width: 767px) 70vw, 282px';

// ProductCard of the Design System (F-016 7.3, 7.6): the whole card is one link, no order button. The photo gets alt=""
// because the h3 already names the link (20.5, D-9). Width-only Cloudinary transforms keep the aspect ratio, which
// iz-crop-top needs to hide the printed claim at the bottom (17.4).
export default function ProductCardV2({ card, best = false }: { card: HomeProductCard; best?: boolean }) {
  const { slug, name, image, position, fit, price, compareAt, cropClass } = card;
  const srcSet = image ? generateCloudinarySrcSet(image, [300, 600, 900]) : '';
  const chips = (
    <>
      {position && <span className="iz-pcard__pos">{POSITION_CHIP[position]}</span>}
      {best && <span className="iz-pcard__best">Best seller</span>}
    </>
  );

  return (
    <Link className="iz-pcard" href={`/produk/${slug}`}>
      {image ? (
        <div className="iz-pcard__tile">
          <img
            className={cropClass ?? undefined}
            src={optimizeCloudinaryUrl(image, 600)}
            srcSet={srcSet || undefined}
            sizes={srcSet ? CARD_SIZES : undefined}
            alt=""
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
          />
          {chips}
        </div>
      ) : (
        <div className="iz-pcard__tile" style={{ display: 'grid', placeItems: 'center' }}>
          <span className="iz-for iz-placeholder">Foto produk: PLACEHOLDER</span>
          {chips}
        </div>
      )}
      <h3 className="iz-pcard__name">{name}</h3>
      {fit?.kind === 'model' && <span className="iz-fit">{fit.text}</span>}
      {fit?.kind === 'universal' && <span className="iz-fit iz-fit--universal">{fit.text}</span>}
      {fit?.kind === 'for' && <p className="iz-for">{fit.text}</p>}
      <div className="iz-price">
        <b>{formatRupiah(price)}</b>
        {compareAt !== null && <s>{formatRupiah(compareAt)}</s>}
      </div>
    </Link>
  );
}
