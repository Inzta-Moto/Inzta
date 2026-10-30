import Link from 'next/link';
import { FILMSTRIP, INSTAGRAM } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

// Desktop boxes are 520 x 360 (wide) and 280 x 360 (tall). The photos are landscape, so in a tall box object-fit:
// cover renders them about twice the box width; the sizes hints ask for the rendered width. On phones the wide box is
// 82% x 280 px, so a 16:9 photo covers it about 500 px wide (128vw at 390, 156vw at 320), not 82vw.
const FILM_SIZES = { wide: '(max-width: 767px) 160vw, 540px', tall: '(max-width: 767px) 120vw, 700px' } as const;
// Cloudinary widths: 1280 lets Cangar (03_iwohfu, 1280 x 720) arrive at its own size; c_limit never enlarges, so
// road02 (1200 x 630) stops at 1200.
const FILM_WIDTHS = [540, 800, 1200, 1280];

// "Dari jalan, bersama rider." (F-016 S1.7). Every photo owned by the Gasber organiser carries the credit tag and
// INZTA's own photos carry none (S1.7.2); alts describe the photos (S1.7.3).
export default function Community({ gasberHref }: { gasberHref: string }) {
  return (
    <section className="iz-section iz-film-scene" style={{ paddingBottom: 0 }} data-scene="film">
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
          static wrapped grid (S1.7.4, v2-home.css). On desktop with motion the section pins and vertical scroll moves
          the strip sideways (lib/v2/motion/engine.ts film()). */}
      <div className="iz-film" tabIndex={0} role="region" aria-label="Foto dari jalan" data-motion="film">
        {FILMSTRIP.map(photo => (
          <div key={photo.src} className={`iz-photo iz-photo--${photo.shape}`}>
            <SmartImage src={photo.src} alt={photo.alt} sizes={FILM_SIZES[photo.shape]} widths={FILM_WIDTHS} width={800} />
            {photo.credit && <span className="iz-tag">{photo.credit}</span>}
          </div>
        ))}
      </div>
      <div className="iz-film__progress" aria-hidden="true">
        <span />
      </div>
      <div className="iz-wrap">
        <p className="iz-muted" style={{ textAlign: 'center', fontSize: 15, marginTop: 24 }}>
          Pakai tas INZTA di perjalanan? Tandai {INSTAGRAM.handle}.
        </p>
      </div>
    </section>
  );
}
