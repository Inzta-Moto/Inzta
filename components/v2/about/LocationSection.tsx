import { BUSINESS_ADDRESS, BUSINESS_MAPS_EMBED_URL, BUSINESS_MAPS_URL, BUSINESS_NAME } from '@/lib/constants';
import { ArrowUpRight } from '@/components/v2/icons';
import AboutMap from '@/components/v2/about/AboutMap';
import { LOCATION_COPY } from '@/components/v2/about/about-content';

// "Lokasi INZTA." (F-032): the business address with the Maps button on a dark panel that carries the /tentang route
// map, next to the real map of the listing. The iframe is the keyless Google embed with loading="lazy": the section is
// the last one on the page, so it never competes with the hero, and it needs no client code or API key. The button is
// the primary path, so a blocked or failed embed still leaves the link; the map box keeps its tint while it loads.
export default function LocationSection() {
  return (
    <section id="lokasi" className="iz-wrap" aria-labelledby="lokasi-judul">
      <div className="iz-head">
        <h2 id="lokasi-judul" className="t-h2-landing">
          {LOCATION_COPY.title}
        </h2>
      </div>
      <div className="iz-location">
        <div className="iz-location__info iz-dark">
          <AboutMap variant="location" />
          <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
            {LOCATION_COPY.addressLabel}
          </span>
          <p className="iz-location__area">{LOCATION_COPY.area}</p>
          <address className="iz-location__address">
            <span className="iz-location__name">{BUSINESS_NAME}</span>
            {BUSINESS_ADDRESS.map(line => (
              <span key={line}>{line}</span>
            ))}
          </address>
          <div className="iz-wa iz-location__cta">
            <span className="iz-wa__note">{LOCATION_COPY.mapsNote}</span>
            <a className="iz-btn iz-btn--primary" href={BUSINESS_MAPS_URL} target="_blank" rel="noopener noreferrer">
              <span>{LOCATION_COPY.mapsButton}</span>
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
        <div className="iz-location__map">
          <iframe
            src={BUSINESS_MAPS_EMBED_URL}
            title={LOCATION_COPY.mapTitle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
