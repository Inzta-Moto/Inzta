import Link from 'next/link';
import { formatRupiah } from '@/lib/v2/home-data';
import { TOURMAX_NOTES, TOURMAX_SIZE, TOURMAX_SLUG } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';

// Tourmax 30 band (F-016 S1.6). Renders only when the product is active with an effective price above 0 (S1.6.1);
// a variable product without priceFrom yields 0, and "Rp0" would be a wrong price. Only the effective price shows, no
// struck price (S1.6.2). The size note has no unit because cm is unconfirmed (P-11). The photo is on the dark band, so
// it uses the dark tone (S0.12.5). The desktop pin of S1.6.3 belongs to the phase C motion; data-* are its hooks.
export default function TourmaxBand({ tourmax }: { tourmax: { price: number; compareAt: number | null } | null }) {
  if (!tourmax || tourmax.price <= 0) return null;
  return (
    <section className="iz-band iz-on-photo" data-motion="tourmax">
      <SmartImage
        src="/images/v2/tail-bag-inzta-tourmax-30-2.jpg"
        alt="Tourmax 30 terpasang di skuter matik besar"
        tone="dark"
        sizes="100vw"
      />
      <div className="iz-band__body">
        <h2 className="t-h2-landing">
          Tourmax 30, <span className="iz-tone2">dari dekat.</span>
        </h2>
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
          <b className="iz-num" style={{ fontSize: 32 }}>
            {formatRupiah(tourmax.price)}
          </b>
          <Link className="iz-btn iz-btn--primary" href={`/produk/${TOURMAX_SLUG}`}>
            Lihat Tourmax 30
          </Link>
        </div>
      </div>
    </section>
  );
}
