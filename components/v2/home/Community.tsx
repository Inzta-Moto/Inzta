import Link from 'next/link';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { FILMSTRIP, INSTAGRAM } from '@/lib/v2/home-content';
import { ArrowRight } from '@/components/v2/icons';

// Desktop filmstrip boxes are 520 x 360 (wide) and 280 x 360 (tall); Cloudinary c_fill crops like object-fit: cover.
const FILM_SIZE = { wide: { w: 520, h: 360 }, tall: { w: 280, h: 360 } } as const;

// "Dari jalan, bersama rider." (F-016 11). Every Gasber photo carries the organiser's credit (D-3).
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
      <div className="iz-film">
        {FILMSTRIP.map(photo => {
          const { w, h } = FILM_SIZE[photo.shape];
          const src1x = optimizeCloudinaryUrl(photo.src, w, h);
          const src2x = optimizeCloudinaryUrl(photo.src, w * 2, h * 2);
          return (
            <div key={photo.src} className={`iz-photo iz-photo--${photo.shape}`}>
              <img
                src={src1x}
                srcSet={`${src1x} 1x, ${src2x} 2x`}
                alt={photo.alt}
                width={w}
                height={h}
                loading="lazy"
                decoding="async"
              />
              {photo.credit && <span className="iz-tag">{photo.credit}</span>}
            </div>
          );
        })}
      </div>
      <div className="iz-wrap">
        <p className="iz-muted" style={{ textAlign: 'center', fontSize: 15, marginTop: 24 }}>
          Pakai tas INZTA di perjalanan? Tandai {INSTAGRAM.handle}.
        </p>
      </div>
    </section>
  );
}
