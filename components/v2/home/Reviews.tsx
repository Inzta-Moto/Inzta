import Image from 'next/image';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { ArrowRight } from '@/components/v2/icons';
import {
  REVIEW_FEATURED,
  REVIEW_FEATURED_PHOTO,
  REVIEWS,
  REVIEWS_ARE_PLACEHOLDERS,
  SHOPEE_REVIEWS_URL,
  type ReviewItem,
} from '@/lib/v2/home-content';
import { CROP_HALF_SLUGS, CROP_TOP_SLUGS } from '@/lib/v2/product-copy';

function cropClass(slug: string): string | undefined {
  if (CROP_TOP_SLUGS.includes(slug)) return 'iz-crop-top';
  if (CROP_HALF_SLUGS.includes(slug)) return 'iz-crop-half';
  return undefined;
}

// Thumbnail beside the product name, so alt="" (20.5). Width only, no square crop at Cloudinary,
// so iz-crop-top can keep the printed claim at the bottom of the photo out of view (17.4).
function ProductChip({ review, images }: { review: ReviewItem; images: Record<string, string> }) {
  const src = images[review.productSlug];
  return (
    <span className="iz-rprod">
      {src && (
        <img
          className={cropClass(review.productSlug)}
          src={optimizeCloudinaryUrl(src, 64)}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
        />
      )}
      {review.productName}
    </span>
  );
}

function Meta({ review }: { review: ReviewItem }) {
  return (
    <div className="iz-rmeta">
      <b>{review.name}</b>
      <span>Shopee · {review.month}</span>
    </div>
  );
}

// "Kata pembeli INZTA." (F-016 13). No stars, rating, count, or Review structured data (13.3).
export default function Reviews({ productImages }: { productImages: Record<string, string> }) {
  // Placeholders show on Preview and local builds only; production waits for reviews with recorded permission (13.2, C-8).
  if (REVIEWS_ARE_PLACEHOLDERS && process.env.VERCEL_ENV === 'production') return null;
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div>
            <span className="iz-eyebrow">Ulasan di Shopee</span>
            <h2 className="t-h2-landing">Kata pembeli INZTA.</h2>
          </div>
          {SHOPEE_REVIEWS_URL ? (
            <a className="iz-link" href={SHOPEE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
              Lihat semua ulasan di Shopee <ArrowRight size={18} />
            </a>
          ) : (
            // Store URL unknown: plain text, never a link to "#" (13.5).
            <span className="iz-link">Lihat semua ulasan di Shopee</span>
          )}
        </div>
        <div className="iz-reviews">
          <figure className="iz-rfeature">
            <div className="iz-photo">
              <Image
                src={REVIEW_FEATURED_PHOTO.src}
                alt={REVIEW_FEATURED_PHOTO.alt}
                width={1000}
                height={1333}
                sizes="(max-width: 767px) 100vw, 40vw"
              />
            </div>
            <span className="iz-rfeature__mark" aria-hidden="true">“</span>
            <blockquote>{REVIEW_FEATURED.quote}</blockquote>
            <ProductChip review={REVIEW_FEATURED} images={productImages} />
            <Meta review={REVIEW_FEATURED} />
          </figure>
          {/* A horizontal scroller on phones; focusable so it can be scrolled by keyboard. */}
          <div className="iz-reviews__wall" tabIndex={0} role="region" aria-label="Ulasan pembeli">
            {REVIEWS.map((r, i) => (
              <figure className="iz-rcard" key={`${r.productSlug}-${i}`}>
                <blockquote>{r.quote}</blockquote>
                <ProductChip review={r} images={productImages} />
                <Meta review={r} />
              </figure>
            ))}
          </div>
        </div>
        <div className="iz-reviews__foot">
          <p>Dikutip apa adanya dari ulasan toko INZTA di Shopee, tanpa diubah.</p>
        </div>
      </div>
    </section>
  );
}
