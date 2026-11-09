import Link from 'next/link';
import { PARTNER_STORES, STORE_COPY } from '@/lib/v2/partner-stores';
import { ArrowRight } from '@/components/v2/icons';
import SmartImage from '@/components/v2/ui/SmartImage';
import '@/app/(v2)/v2-store.css';

// Beranda row after "Cara pesan" (F-027 B5): order online, see the bags in a shop, then the closing chat panel. It
// names the first shop only; /toko lists them all. The photo shows only when that shop has one.
export default function StoreTeaser() {
  const store = PARTNER_STORES[0];
  if (!store) return null;
  const photo = store.photos?.[0];
  return (
    <section className="iz-section" style={{ paddingTop: 0 }} aria-labelledby="toko-teaser">
      <div className="iz-wrap">
        <div className="iz-storeteaser">
          {photo && (
            <div className="iz-photo iz-storeteaser__photo">
              <SmartImage src={photo.src} alt={photo.alt} sizes="(max-width: 767px) 90vw, 120px" widths={[240, 480, 960]} width={240} />
            </div>
          )}
          <div className="iz-storeteaser__body">
            <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
              {STORE_COPY.teaser.eyebrow}
            </span>
            <h2 id="toko-teaser" className="t-h3-landing">
              {STORE_COPY.teaser.title}
            </h2>
            <p className="iz-storeteaser__area">{store.area}</p>
          </div>
          <Link className="iz-link" href="/toko">
            {STORE_COPY.teaser.link} <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
