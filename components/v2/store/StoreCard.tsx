import Link from 'next/link';
import { WA_NUMBER } from '@/lib/constants';
import { STORE_COPY, type PartnerStore } from '@/lib/v2/partner-stores';
import { ArrowRight, ArrowUpRight, WhatsApp } from '@/components/v2/icons';
import AboutMap from '@/components/v2/about/AboutMap';
import StoreGallery from '@/components/v2/store/StoreGallery';

// One shop (F-027 B2, B3): the dark panel carries the facts already checked (name, kind, address, Maps link) over the
// /tentang route map, so the card has weight without a stand-in photo; the light panel says what to check before the
// trip and hands questions to the INZTA admin. Hours, products, and the gallery render only when their data exists.
// Link to the listing, no embedded map (ADR-0038 point 7).
export default function StoreCard({ store, products = [] }: { store: PartnerStore; products?: { slug: string; name: string }[] }) {
  const nameId = `toko-${store.slug}`;
  const waHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(store.waText)}`;
  const hours = store.hours ?? [];
  return (
    <article className="iz-store" aria-labelledby={nameId}>
      <div className="iz-store__card">
        <div className="iz-store__main iz-dark">
          <AboutMap variant="contact" />
          <h2 id={nameId} className="t-h2-landing iz-store__name">
            {store.name}
          </h2>
          <p className="iz-store__kind">{store.kind}</p>
          <div className="iz-store__where">
            <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
              {STORE_COPY.card.addressLabel}
            </span>
            <address className="iz-store__address">
              {store.addressLines.map(line => (
                <span key={line}>{line}</span>
              ))}
            </address>
          </div>
          <a className="iz-btn iz-btn--primary iz-store__maps" href={store.mapsUrl} target="_blank" rel="noopener noreferrer">
            <span>{STORE_COPY.card.mapsButton}</span>
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="iz-store__side">
          <ul className="iz-store__notes">
            {hours.length > 0 ? (
              <li>
                <span className="iz-store__label">{STORE_COPY.card.hoursLabel}</span>
                <dl className="iz-store__hours">
                  {hours.map(h => (
                    <div key={h.days}>
                      <dt>{h.days}</dt>
                      <dd>{h.time}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ) : (
              <li>{STORE_COPY.card.hoursNote}</li>
            )}
            <li>{STORE_COPY.card.displayNote}</li>
            {products.length > 0 && (
              <li>
                <span className="iz-store__label">{STORE_COPY.card.productsLabel}</span>
                <ul className="iz-store__products">
                  {products.map(p => (
                    <li key={p.slug}>
                      <Link className="iz-link" href={`/produk/${p.slug}`}>
                        {p.name} <ArrowRight size={16} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
          <div className="iz-wa iz-store__wa">
            <span className="iz-wa__note">{STORE_COPY.card.waNote}</span>
            <a className="iz-btn iz-btn--secondary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>{STORE_COPY.card.waButton}</span>
            </a>
          </div>
        </div>
      </div>
      <StoreGallery store={store} />
    </article>
  );
}
