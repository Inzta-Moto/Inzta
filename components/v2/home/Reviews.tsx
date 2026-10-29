import type { Product, TokopediaReview } from '@/types';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { REVIEWS_PERMISSION_RECORDED } from '@/lib/v2/home-content';
import { TOKOPEDIA_REVIEWS, TOKOPEDIA_REVIEWS_URL, reviewChip, reviewMetaLine, splitReviews } from '@/lib/v2/reviews';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

type Chip = ReturnType<typeof reviewChip>;

// S1.9.7: the product chip is text, not a link. The 32 px thumbnail is decorative next to the name (alt=""); width-only
// Cloudinary transforms keep the ratio, so iz-crop-top can keep the printed claim out of view (S1.9.5). No photo:
// the chip shows the name only (S1.9.8).
function ProductChip({ chip }: { chip: Chip }) {
  return (
    <span className="iz-rprod">
      {chip.image && (
        <img
          className={chip.cropTop ? 'iz-crop-top' : undefined}
          src={optimizeCloudinaryUrl(chip.image, 64)}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
        />
      )}
      {chip.label}
    </span>
  );
}

// Masked Tokopedia name and "Ulasan di Tokopedia, sekitar <Bulan YYYY>" (S1.9.1, E4). No stars, rating, or count.
function Meta({ review }: { review: TokopediaReview }) {
  return (
    <div className="iz-rmeta">
      <b>{review.name}</b>
      <span>{reviewMetaLine(review)}</span>
    </div>
  );
}

// "Kata pembeli INZTA." (F-016 S1.9, D4): eight vetted Tokopedia reviews from the 2026-10-29 snapshot, quoted verbatim.
// The first is featured; the wall takes the largest even number of the rest (S1.9.4). No star, rating, count,
// aggregate, Review JSON-LD, or microdata anywhere (S1.9.2, G-C5); buyer photos are not copied. C-8: the section stays
// out of Production until permission is recorded (REVIEWS_PERMISSION_RECORDED).
export default function Reviews({ products }: { products: Product[] }) {
  if (!REVIEWS_PERMISSION_RECORDED && process.env.VERCEL_ENV === 'production') return null;
  const { featured, wall } = splitReviews(TOKOPEDIA_REVIEWS);
  if (!featured) return null;

  const featuredChip = reviewChip(featured, products);
  // Featured photo alt = the website product name; the chip label also carries the variant suffix (S1.9, S1.9.6).
  const featuredProduct = featured.productSlug ? products.find(p => p.slug === featured.productSlug && p.isActive !== false) : undefined;

  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div>
            <span className="iz-eyebrow">Ulasan di Tokopedia</span>
            <h2 className="t-h2-landing">Kata pembeli INZTA.</h2>
          </div>
          <a className="iz-link" href={TOKOPEDIA_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
            Lihat semua ulasan di Tokopedia <ArrowRight size={18} />
          </a>
        </div>
        <div className="iz-reviews" data-reveal-stagger="">
          <figure className="iz-rfeature">
            {featuredChip.image && featuredProduct && (
              <div className="iz-photo">
                <SmartImage
                  src={featuredChip.image}
                  alt={featuredProduct.name}
                  tone="dark"
                  sizes="(max-width: 767px) 100vw, 40vw"
                  widths={[480, 800, 1000]}
                  width={800}
                  imgClassName={featuredChip.cropTop ? 'iz-crop-top' : undefined}
                />
              </div>
            )}
            <span className="iz-rfeature__mark" aria-hidden="true">
              “
            </span>
            <blockquote>{featured.quote}</blockquote>
            <ProductChip chip={featuredChip} />
            <Meta review={featured} />
          </figure>
          {/* On phones the wall is a swipe row, so it is a focusable, labelled region for keyboard scrolling. */}
          <div className="iz-reviews__wall" tabIndex={0} role="region" aria-label="Ulasan pembeli">
            {wall.map((r, i) => (
              <figure className="iz-rcard" key={`${r.name}-${i}`}>
                <blockquote>{r.quote}</blockquote>
                <ProductChip chip={reviewChip(r, products)} />
                <Meta review={r} />
              </figure>
            ))}
          </div>
        </div>
        <div className="iz-reviews__foot">
          <p>Dikutip dari ulasan toko INZTA di Tokopedia, dipotong tanpa diubah.</p>
        </div>
      </div>
    </section>
  );
}
