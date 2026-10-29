import Link from 'next/link';
import { FILMSTRIP, INSTAGRAM } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

// Desktop boxes are 520 x 360 (wide) and 280 x 360 (tall). The photos are landscape, so in a tall box object-fit:
// cover renders them about twice the box width; the sizes hints ask for the rendered width.
const FILM_SIZES = { wide: '(max-width: 767px) 82vw, 540px', tall: '(max-width: 767px) 120vw, 700px' } as const;

// "Dari jalan, bersama rider." (F-016 S1.7). Every photo owned by the Gasber organiser carries the credit tag and
// INZTA's own photos carry none (S1.7.2); alts describe the photos (S1.7.3).
export default function Community({ gasberHref }: { gasberHref: string }) {
  return (
    <section className="iz-section" style={{ paddingBottom: 0 }}>
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div>
            <span className="iz-eyebrow">Komunitas</span>
            <h2 className="t-h2-landing">Dari jalan, bersama rider.</h2>
          </div>
          <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p className="t-body iz-muted">
              INZTA ikut turun ke jalur bersama komunitas rider. Terakhir: Gasber 16 Indonesia Ride Adventure, 24 Oktober
              2026, jalur tanah Banten dan Bogor.
            </p>
            <Link className="iz-link" href={gasberHref}>
              Baca catatan Gasber 16 <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
      {/* S1.7.1: a focusable, labelled scroll region, so keyboard users scroll it with the arrow keys. Without
          JavaScript a thin scrollbar shows on fine pointers; under reduced motion at 1024 px and wider it becomes a
          static wrapped grid (S1.7.4, v2-home.css). The phase C scrub targets data-motion="film". */}
      <div className="iz-film" tabIndex={0} role="region" aria-label="Foto dari jalan" data-motion="film">
        {FILMSTRIP.map(photo => (
          <div key={photo.src} className={`iz-photo iz-photo--${photo.shape}`}>
            <SmartImage src={photo.src} alt={photo.alt} sizes={FILM_SIZES[photo.shape]} widths={[540, 800, 1200]} width={800} />
            {photo.credit && <span className="iz-tag">{photo.credit}</span>}
          </div>
        ))}
      </div>
      <div className="iz-wrap">
        <p className="iz-muted" style={{ textAlign: 'center', fontSize: 15, marginTop: 24 }}>
          Pakai tas INZTA di perjalanan? Tandai {INSTAGRAM.handle}.
        </p>
      </div>
    </section>
  );
}
