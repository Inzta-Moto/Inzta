import type { MotorCategory } from '@/types';
import { HIRES } from '@/lib/v2/home-content';
import Link from 'next/link';
import SmartImage from '@/components/v2/ui/SmartImage';
import { fallbackLead } from '@/components/v2/motor/motor-page';

interface HeroPhoto {
  src: string;
  alt: string;
  // Modifier of .iz-hero__img that sets the object-position for this photo (v2-motor.css).
  position: string | null;
  // The phone hero is taller than wide, so object-fit: cover renders the photo wider than the viewport by its own
  // ratio (about 260vw for 4:3, 135vw for 3:4, 120vw for 2:3); 100vw made the browser fetch an enlarged variant.
  sizes: string;
  // The bike stands on the left of the photo, so on desktop the copy moves to the right half (v2-motor.css).
  flip?: boolean;
}

// S5.1: each category has its own hero photo and never falls back to the square category tile, which is too small for
// a full-width hero. Adventure uses INZTA's road-01 (an adventure bike with a tall screen and crash bars, design.md §11,
// §17; road-09 would be sharper but it is the Adventure tile, which MoreCard shows on this page). Retro uses hero-99
// (a Yamaha XSR with INZTA's yellow bags, 3200 px, plate blurred), the Beranda hero, once on this page; the 1200 px
// Foldpack Z10 photo was enlarged about 2.4 times on retina. Matic uses road-04 at its own 1200 x 1600, plate blurred,
// framed low so the whole XMAX shows. Trail uses road-09, a dual-sport bike with INZTA bags on a sea cliff (Sehan,
// 2026-10-30); the bike is on the left, so the copy sits on the right over the sea.
const HERO_PHOTOS: Record<MotorCategory, HeroPhoto | null> = {
  matic: {
    src: HIRES.road04,
    alt: 'Yamaha XMAX bertas belakang dengan stiker INZTAMOTO terparkir di tepi pantai saat matahari terbenam',
    position: 'iz-hero__img--matic',
    sizes: '(max-width: 767px) 135vw, 100vw',
  },
  adventure: {
    src: HIRES.road01,
    alt: 'Rider dengan motor adventure bertas samping kuning INZTA di jalan berkelok pegunungan',
    position: 'iz-hero__img--adventure',
    sizes: '(max-width: 767px) 120vw, 100vw',
  },
  retro: {
    src: HIRES.hero99,
    alt: 'Rider berjaket INZTAMOTO di atas motor retro Yamaha XSR dengan tas kuning INZTA di jalan tanah berdebu',
    position: 'iz-hero__img--retro',
    sizes: '(max-width: 767px) 260vw, (max-width: 1023px) 135vw, 100vw',
  },
  trail: {
    src: HIRES.heroTrail,
    alt: 'Motor trail dengan side bag, tank bag, dan tas crashbar INZTA terparkir di tebing di tepi laut',
    position: 'iz-hero__img--trail',
    sizes: '(max-width: 767px) 330vw, 100vw',
    flip: true,
  },
};

// Short hero of the category page (S5.1). The photo is the only eager image and is never animated (S5.1.4); the
// anchors are plain in-page links (S5.1.2). The sentinel tells SiteNav when to switch to the light navbar.
export default function CategoryHero({ category, label, lead }: { category: MotorCategory; label: string; lead: string | null }) {
  const photo = HERO_PHOTOS[category];
  return (
    <section className={`iz-hero iz-hero--short iz-on-photo${photo?.flip ? ' iz-hero--flip' : ''}`}>
      {photo ? (
        <SmartImage
          src={photo.src}
          alt={photo.alt}
          className="iz-hero__img"
          imgClassName={photo.position ? `iz-hero__img ${photo.position}` : 'iz-hero__img'}
          tone="dark"
          priority
          sizes={photo.sizes}
          widths={[640, 1080, 1600, 2000]}
          width={1600}
        />
      ) : (
        <span className="iz-tag iz-hero__tag">{`Foto motor ${label.toLowerCase()} belum tersedia`}</span>
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
        {/* S5.1.1: without an approved line the lead is neutral and names no motor model. */}
        <p className="t-lead">{lead ?? fallbackLead(label)}</p>
        <div className="iz-row">
          <a className="iz-btn iz-btn--primary" href="#produk">Lihat tas motor {label}</a>
          <a className="iz-btn iz-btn--secondary" href="#motor-lain">Bukan {label}? Ganti kategori</a>
        </div>
      </div>
      <div data-hero-end aria-hidden="true" />
    </section>
  );
}
