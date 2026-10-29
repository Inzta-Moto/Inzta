import Link from 'next/link';
import { formatRupiah } from '@/lib/v2/home-data';
import { PHOTOS, TOURMAX_NOTES, TOURMAX_SIZE, TOURMAX_SLUG } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';
import Bounce from '@/components/v2/motion/Bounce';

// Tourmax 30 band (F-016 S1.6). Renders only when the product is active with an effective price above 0 (S1.6.1);
// a variable product without priceFrom yields 0, and "Rp0" would be a wrong price. Only the effective price shows, no
// struck price (S1.6.2). The size note has no unit because cm is unconfirmed (P-11).
// The only Tourmax lifestyle photo is portrait (1440 x 1920); stretched across the full band it was upscaled about
// twice and looked soft, so the band is a split (copy left, photo card right) that shows it near its own size, and the
// pin of S1.6.3 is replaced by an unpinned scroll scene (Sehan, 2026-10-29; lib/v2/motion/engine.ts tourmax()).
export default function TourmaxBand({ tourmax }: { tourmax: { price: number; compareAt: number | null } | null }) {
  if (!tourmax || tourmax.price <= 0) return null;
  return (
    <section className="iz-band iz-band--split iz-on-photo" data-scene="tourmax">
      <span className="iz-band__num" aria-hidden="true">
        30
      </span>
      <div className="iz-band__body">
        <span className="iz-eyebrow">Tail bag</span>
        <h2 className="t-h2-landing">Tourmax 30, dari dekat.</h2>
        <ul className="iz-notes" data-reveal-stagger="">
          {TOURMAX_NOTES.map(note => (
            <li key={note} className="iz-note">
              {note}
            </li>
          ))}
          <li className="iz-note">
            <span>
              Tinggi bisa ditambah: <span className="iz-nowrap">{TOURMAX_SIZE.from}</span> menjadi{' '}
              <span className="iz-nowrap">{TOURMAX_SIZE.to}</span>
            </span>
          </li>
        </ul>
        <div className="iz-band__foot" data-reveal="">
          <b className="iz-num iz-band__price">{formatRupiah(tourmax.price)}</b>
          <Link className="iz-btn iz-btn--primary" href={`/produk/${TOURMAX_SLUG}`} data-transition-label="Tourmax 30">
            <Bounce text="Lihat Tourmax 30" />
          </Link>
        </div>
      </div>
      <div className="iz-band__media">
        <div className="iz-band__photo">
          <SmartImage
            src={PHOTOS.tourmax}
            alt="Tourmax 30 terpasang di skuter matik besar"
            tone="dark"
            sizes="(max-width: 1023px) 92vw, 460px"
            widths={[480, 720, 960, 1440]}
            width={960}
          />
        </div>
      </div>
    </section>
  );
}
