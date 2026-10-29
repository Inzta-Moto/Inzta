import Image from 'next/image';
import Link from 'next/link';
import { PHOTOS } from '@/lib/v2/home-content';
import { Motorcycle } from '@/components/v2/icons';

// F-016 S1.1. Server component so the H1 and the LCP photo are in the server HTML (S1.1.1). The photo stays a plain
// next/image with priority and no shimmer layer (S0.12.7); if it fails, the section's own --c-aspal background is the
// dark fallback and next/image hides the alt text, so the H1 and buttons stay readable (S1.1.4). The hero sits under
// the zero-height sticky navbar wrapper; the sentinel at the end tells SiteNav when to switch to the light navbar
// (S0.4.4). data-reveal* attributes are hooks for the phase C motion only; nothing is hidden by them.
export default function Hero() {
  return (
    <section className="iz-hero iz-on-photo" data-motion="hero">
      <Image
        className="iz-hero__img"
        src={PHOTOS.hero}
        alt="Rider petualang Indonesia di jalur gunung"
        fill
        priority
        sizes="100vw"
        data-parallax=""
      />
      <div className="iz-hero__body">
        <h1 className="t-display" data-reveal-lines="">
          Tas motor untuk <span className="iz-tone2">perjalanan Anda.</span>
        </h1>
        <p className="t-lead" data-reveal="">
          Tank bag, side bag, dan tail bag buatan INZTA sejak 2023. Beri tahu motor Anda, kami tandai tas yang dibuat
          untuknya.
        </p>
        <div className="iz-row" data-reveal="">
          <a className="iz-btn iz-btn--primary" href="#garasi">
            <Motorcycle width={20} height={20} />
            Pilih motor Anda
          </a>
          <Link className="iz-btn iz-btn--secondary" href="/produk">
            Lihat semua tas
          </Link>
        </div>
      </div>
      <div data-hero-end aria-hidden="true" />
    </section>
  );
}
