import { STORE_COPY, type PartnerStore } from '@/lib/v2/partner-stores';
import SmartImage from '@/components/v2/ui/SmartImage';

// Phones: 82% of the row, so the next photo peeks in; desktop: the first photo spans two columns of four.
const SIZES = '(max-width: 1023px) 82vw, (max-width: 1439px) 50vw, 600px';
const WIDTHS = [480, 640, 960, 1280];

// Shop photos (F-027 B4): any number, alt from the data. Below 1024 px a focusable, labelled scroll region with
// scroll-snap, so keyboard users scroll it with the arrow keys (same pattern as the Beranda film strip); from 1024 px
// the first photo is large and the rest fill a grid laid out per photo count (data-count, v2-store.css), so 2 to 5
// photos leave no empty cell. Only photos sent through INZTA (ADR-0038 point 5);
// without photos nothing renders.
export default function StoreGallery({ store }: { store: PartnerStore }) {
  const photos = store.photos ?? [];
  if (photos.length === 0) return null;
  return (
    <div className="iz-storegallery">
      <h3 className="t-h3">{STORE_COPY.gallery.title(store.name)}</h3>
      <div className="iz-storegallery__grid" data-count={photos.length > 5 ? 'many' : photos.length} tabIndex={0} role="region" aria-label={STORE_COPY.gallery.regionLabel(store.name)}>
        {photos.map((photo, i) => (
          <div key={photo.src} className="iz-photo iz-storegallery__item">
            <SmartImage src={photo.src} alt={photo.alt} sizes={SIZES} widths={WIDTHS} width={i === 0 ? 960 : 640} />
            {photo.credit && <span className="iz-tag">{photo.credit}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
