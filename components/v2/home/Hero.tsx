import Link from 'next/link';
import HeroImage from '@/components/v2/home/HeroImage';
import { Motorcycle } from '@/components/v2/icons';
import Bounce from '@/components/v2/motion/Bounce';

// F-016 S1.1. Server component so the H1 and the LCP photo are in the server HTML (S1.1.1); HeroImage is the only
// client part (failure handling, S1.1.4). The hero sits under the zero-height sticky navbar wrapper; the sentinel at the
// end tells SiteNav when to switch to the light navbar (S0.4.4). data-reveal* attributes are hooks for the phase C
// motion only; nothing is hidden by them.
export default function Hero() {
  return (
    <section className="iz-hero iz-on-photo" data-motion="hero">
      <HeroImage />
      <div className="iz-hero__body">
        {/* Copy from the owner, Om Fahrul (2026-11-02, via Sehan). One sentence per line; the space between the spans
            keeps the accessible name "Carry Your Gear. Create Your Adventure." */}
        <h1 className="t-display iz-hero__title--home" data-reveal-lines="">
          <span className="iz-hero__line">Carry Your Gear.</span>{' '}
          <span className="iz-hero__line iz-tone2">Create Your Adventure.</span>
        </h1>
        <p className="t-lead" data-reveal="">
          INZTA Motobag hadir sejak 2023, lebih dari sekadar tas motor: dibuat untuk perjalanan, terinspirasi oleh
          petualangan.
        </p>
        <div className="iz-row" data-reveal="">
          <a className="iz-btn iz-btn--primary" href="#garasi">
            <Motorcycle width={20} height={20} />
            <Bounce text="Pilih motor Anda" />
          </a>
          <Link className="iz-btn iz-btn--secondary" href="/produk">
            <Bounce text="Lihat semua tas" />
          </Link>
        </div>
      </div>
      <span className="iz-hero__cue" aria-hidden="true" />
      <div data-hero-end aria-hidden="true" />
    </section>
  );
}
