import type { MotorCategory } from '@/types';
import { HIRES, MOTOR_CATEGORIES } from '@/lib/v2/home-content';
import Link from 'next/link';
import SmartImage from '@/components/v2/ui/SmartImage';
import { LEAD_PLACEHOLDER } from '@/components/v2/motor/motor-page';

// S5.1: Retro uses INZTA's own road-01. The canvas alt names a Yamaha XSR 155, but the photo shows an adventure bike
// with a tall screen and crash bars, so the corrected alt of S8.1 is used (design.md §11, §17). Other categories use
// their example photo with the "Foto contoh" tag (P-1).
const RETRO_PHOTO = { src: HIRES.road01, alt: 'Rider dengan side bag kuning INZTA di jalan berkelok yang hijau', example: false };

// Matic uses INZTA's own road-04 (a big scooter with a tail bag); the 512 px example photo looked soft at hero width
// (Sehan, 2026-10-29). Adventure and Trail keep their example photos until INZTA photos exist.
const MATIC_PHOTO = { src: HIRES.road04, alt: 'Skuter matik dengan tail bag di tepi pantai saat matahari terbenam', example: false };

function heroPhoto(c: MotorCategory) {
  if (c === 'retro') return RETRO_PHOTO;
  if (c === 'matic') return MATIC_PHOTO;
  const item = MOTOR_CATEGORIES.find(m => m.value === c);
  return { src: item?.image ?? null, alt: item?.alt ?? '', example: true };
}

// Short hero of the category page (S5.1). The photo is the only eager image and is never animated (S5.1.4); the
// anchors are plain in-page links (S5.1.2). The sentinel tells SiteNav when to switch to the light navbar.
export default function CategoryHero({ category, label, lead }: { category: MotorCategory; label: string; lead: string | null }) {
  const photo = heroPhoto(category);
  return (
    <section className="iz-hero iz-hero--short iz-on-photo">
      <SmartImage
        src={photo.src}
        alt={photo.alt}
        className="iz-hero__img"
        imgClassName="iz-hero__img"
        tone="dark"
        priority
        sizes="100vw"
        widths={[640, 1080, 1600, 2000]}
        width={1600}
      />
      {photo.example && <span className="iz-tag iz-hero__tag">Foto contoh</span>}
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
