import Image from 'next/image';
import Link from 'next/link';
import { formatRupiah } from '@/lib/v2/home-data';
import { TOURMAX_NOTES, TOURMAX_SIZE, TOURMAX_SLUG } from '@/lib/v2/home-content';

// Tourmax 30 band (F-016 10). Renders only when the product is active in Firestore (10.2).
// A variable product without priceFrom yields price 0; "Rp0" would be a wrong price, so it is treated as missing.
// The size note has no unit because cm is unconfirmed (10.3, P-11).
export default function TourmaxBand({ tourmax }: { tourmax: { price: number; compareAt: number | null } | null }) {
  if (!tourmax || tourmax.price <= 0) return null;
  return (
    <section className="iz-band iz-on-photo">
      <Image
        src="/images/v2/tail-bag-inzta-tourmax-30-2.jpg"
        alt="Tourmax 30 terpasang di skuter matik besar"
        width={1000}
        height={1333}
        sizes="100vw"
      />
      <div className="iz-band__body">
        <h2 className="t-h2-landing">
          Tourmax 30, <span className="iz-tone2">dari dekat.</span>
        </h2>
        <ul className="iz-notes">
          {TOURMAX_NOTES.map(note => (
            <li key={note} className="iz-note">{note}</li>
          ))}
          <li className="iz-note">
            <span>
              Tinggi bisa ditambah: <span className="iz-nowrap">{TOURMAX_SIZE.from}</span> menjadi{' '}
              <span className="iz-nowrap">{TOURMAX_SIZE.to}</span>
            </span>
          </li>
        </ul>
        <div className="iz-band__foot">
          <b className="iz-num" style={{ fontSize: 32 }}>{formatRupiah(tourmax.price)}</b>
          <Link className="iz-btn iz-btn--primary" href={`/produk/${TOURMAX_SLUG}`}>Lihat Tourmax 30</Link>
        </div>
      </div>
    </section>
  );
}
