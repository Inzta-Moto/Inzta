import Link from 'next/link';
import { PARTNER_STORES, STORE_COPY } from '@/lib/v2/partner-stores';
import { ArrowRight, ArrowUpRight } from '@/components/v2/icons';
import SmartImage from '@/components/v2/ui/SmartImage';
import '@/app/(v2)/v2-store.css';

// The large photo fills about half the content width on desktop and the full width on phones; the two small ones
// half of that. The shop photos are portrait, so cover-cropping renders them at the box width.
const BIG_SIZES = '(max-width: 767px) 92vw, (max-width: 1023px) 62vw, 470px';
const SMALL_SIZES = '(max-width: 767px) 46vw, (max-width: 1023px) 31vw, 230px';

// Beranda section after "Cara pesan" (F-027 B5): order online, see the bags in a shop, then the closing chat panel.
// It names the first shop only; /toko lists them all. With photos it is a collage of up to three of them next to the
// address, hours, and links; without photos it falls back to a text card. Every string comes from STORE_COPY, so it
// adds no new claim.
export default function StoreTeaser() {
  const store = PARTNER_STORES[0];
  if (!store) return null;
  const photos = (store.photos ?? []).slice(0, 3);
  const hours = store.hours ?? [];
  return (
    <section className="iz-section" style={{ paddingTop: 0 }} aria-labelledby="toko-teaser">
      <div className={`iz-wrap iz-storeband${photos.length ? '' : ' iz-storeband--text'}`}>
        {photos.length > 0 && (
          <div className="iz-storeband__photos" data-count={photos.length}>
            {photos.map((photo, i) => (
              <div key={photo.src} className="iz-photo iz-storeband__photo">
                <SmartImage
                  src={photo.src}
                  alt={photo.alt}
                  sizes={i === 0 ? BIG_SIZES : SMALL_SIZES}
                  widths={i === 0 ? [480, 800, 1200] : [320, 480, 640]}
                  width={i === 0 ? 800 : 480}
                />
                {i === 0 && photo.credit && <span className="iz-tag">{photo.credit}</span>}
              </div>
            ))}
          </div>
        )}
        <div className="iz-storeband__body">
          <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
            {STORE_COPY.page.eyebrow}
          </span>
          <h2 id="toko-teaser" className="t-h2-landing">
            {STORE_COPY.page.title}
          </h2>
          <p className="t-body iz-muted">{STORE_COPY.teaser.title}</p>
          <dl className="iz-storeband__facts">
            <div>
              <dt>{STORE_COPY.card.addressLabel}</dt>
              <dd>
                {store.name}
                <span>{store.area}</span>
              </dd>
            </div>
            {hours.length > 0 && (
              <div>
                <dt>{STORE_COPY.card.hoursLabel}</dt>
                <dd>
                  {hours.map(h => (
                    <span key={h.days} className="iz-storeband__hour">
                      <span>{h.days}</span> <span className="iz-nowrap">{h.time}</span>
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <div className="iz-storeband__actions">
            <Link className="iz-btn iz-btn--primary" href="/toko">
              <span>{STORE_COPY.teaser.link}</span>
              <ArrowRight size={18} />
            </Link>
            <a className="iz-btn iz-btn--secondary" href={store.mapsUrl} target="_blank" rel="noopener noreferrer">
              <span>{STORE_COPY.card.mapsButton}</span>
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
