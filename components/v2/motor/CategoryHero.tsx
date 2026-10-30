import type { MotorCategory } from '@/types';
import { HIRES } from '@/lib/v2/home-content';
import Link from 'next/link';
import SmartImage from '@/components/v2/ui/SmartImage';
import { LEAD_PLACEHOLDER } from '@/components/v2/motor/motor-page';

interface HeroPhoto {
  src: string;
  alt: string;
  // Modifier of .iz-hero__img that sets the object-position for this photo (v2-motor.css).
  position: string | null;
}

// S5.1: each category has its own hero photo and never falls back to the square category tile, which is too small for
// a full-width hero. Adventure uses INZTA's road-01 (an adventure bike with a tall screen and crash bars, design.md §11,
// §17); Retro uses photo catalog row 159 (a Yamaha retro with the Foldpack Z10 and other INZTA bags, plate blurred);
// Matic uses road-04 (a big scooter with a tail bag). Trail has no usable INZTA photo yet, so its hero is the plain
// --c-aspal band with a placeholder tag until INZTA sends one.
const HERO_PHOTOS: Record<MotorCategory, HeroPhoto | null> = {
  matic: { src: HIRES.road04, alt: 'Skuter matik dengan tail bag di tepi pantai saat matahari terbenam', position: null },
  adventure: {
    src: HIRES.road01,
    alt: 'Rider dengan motor adventure bertas samping kuning INZTA di jalan berkelok pegunungan',
    position: 'iz-hero__img--adventure',
  },
  retro: {
    src: HIRES.foldpackZ10,
    alt: 'Motor Yamaha bergaya retro dengan Sidebag Foldpack Z10, tank bag INZTA, dan tas touring lain terpasang, parkir di tepi jalan',
    position: 'iz-hero__img--retro',
  },
  trail: null,
};

// Short hero of the category page (S5.1). The photo is the only eager image and is never animated (S5.1.4); the
// anchors are plain in-page links (S5.1.2). The sentinel tells SiteNav when to switch to the light navbar.
export default function CategoryHero({ category, label, lead }: { category: MotorCategory; label: string; lead: string | null }) {
  const photo = HERO_PHOTOS[category];
  return (
    <section className="iz-hero iz-hero--short iz-on-photo">
      {photo ? (
        <SmartImage
          src={photo.src}
          alt={photo.alt}
          className="iz-hero__img"
          imgClassName={photo.position ? `iz-hero__img ${photo.position}` : 'iz-hero__img'}
          tone="dark"
          priority
          sizes="100vw"
          widths={[640, 1080, 1600, 2000]}
          width={1600}
        />
      ) : (
        <span className="iz-tag iz-hero__tag">{`Foto motor ${label.toLowerCase()}: PLACEHOLDER`}</span>
      )}
      <div className="iz-hero__body">
        <nav className="iz-crumb" aria-label="Breadcrumb">
          <Link href="/">Beranda</Link>
          <span aria-hidden="true">/</span>
          <a href="#motor-lain">Pilih motor</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{label}</span>
        </nav>
        <h1 className="t-display">
          Tas untuk <span className="iz-tone2">motor {label}.</span>
        </h1>
        {/* S5.1.1: without an approved line the lead is the placeholder and names no motor model. */}
        <p className={`t-lead${lead ? '' : ' iz-placeholder'}`}>{lead ?? LEAD_PLACEHOLDER}</p>
        <div className="iz-row">
          <a className="iz-btn iz-btn--primary" href="#produk">Lihat tas motor {label}</a>
          <a className="iz-btn iz-btn--secondary" href="#motor-lain">Bukan {label}? Ganti kategori</a>
        </div>
      </div>
      <div data-hero-end aria-hidden="true" />
    </section>
  );
}
