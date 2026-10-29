import Link from 'next/link';
import type { HomeProductCard } from '@/types';
import { formatRupiah } from '@/lib/v2/home-data';
import SmartImage from '@/components/v2/ui/SmartImage';

// Card widths: 282 px on desktop, 70% of the viewport on phones (bundle.css .iz-row-cards); grids use 25% / 50%.
const CARD_SIZES = '(max-width: 767px) 70vw, 282px';

// ProductCard of the Design System (F-016 S0.9): the whole card is one link, no order button. The photo gets alt=""
// because the name heading already names the link (S0.12.6). Width-only Cloudinary transforms keep the aspect
// ratio, which iz-crop-top needs to hide the printed claim at the bottom (S0.9.5). The name is h3 under a section
// h2 and h2 where the grid has no section heading (S0.9.6).
export default function ProductCardV2({
  card,
  best = false,
  headingLevel = 3,
  sizes = CARD_SIZES,
}: {
  card: HomeProductCard;
  best?: boolean;
  headingLevel?: 2 | 3;
  sizes?: string;
}) {
  const { slug, name, image, positionLabel, badge, fit, price, compareAt, cropClass } = card;
  const Name = headingLevel === 2 ? 'h2' : 'h3';
  const chip = best || badge === 'best' ? 'Best seller' : badge === 'baru' ? 'Baru' : null;

  return (
    <Link className="iz-pcard" href={`/produk/${slug}`} data-transition-label={name}>
      <div className="iz-pcard__tile">
        {image ? (
          <SmartImage src={image} alt="" sizes={sizes} imgClassName={cropClass ?? undefined} className="iz-pcard__img" fallbackLabel="Foto produk" />
        ) : (
          <span className="iz-pcard__noimg">
            <span className="iz-for iz-placeholder">Foto produk: PLACEHOLDER</span>
          </span>
        )}
        {positionLabel && <span className="iz-pcard__pos">{positionLabel}</span>}
        {chip && <span className="iz-pcard__best">{chip}</span>}
      </div>
      <Name className="iz-pcard__name">{name}</Name>
      {fit?.kind === 'model' && <span className="iz-fit">{fit.text}</span>}
      {fit?.kind === 'universal' && <span className="iz-fit iz-fit--universal">{fit.text}</span>}
      {fit?.kind === 'for' && <p className="iz-for">{fit.text}</p>}
      {price > 0 && (
        <div className="iz-price">
          <b>{formatRupiah(price)}</b>
          {compareAt !== null && compareAt > price && <s>{formatRupiah(compareAt)}</s>}
        </div>
      )}
    </Link>
  );
}
