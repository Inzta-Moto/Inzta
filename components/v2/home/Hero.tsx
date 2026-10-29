import Image from 'next/image';
import Link from 'next/link';
import { PHOTOS } from '@/lib/v2/home-content';
import { Motorcycle } from '@/components/v2/icons';

// F-016 6. Server component so the H1 and the LCP photo are in the server HTML (6.2, 6.3). The hero sits under the
// zero-height sticky navbar wrapper; its top padding in CSS clears the capsule. The sentinel at the end tells SiteNav
// when to switch from the dark to the light navbar (4.2).
export default function Hero() {
  return (
    <section className="iz-hero iz-on-photo">
      <Image
        className="iz-hero__img"
        src={PHOTOS.hero}
        alt="Rider petualang Indonesia di jalur gunung"
        fill
        priority
        sizes="100vw"
      />
      <div className="iz-hero__body">
        <h1 className="t-display">
          Tas motor untuk <span className="iz-tone2">perjalanan Anda.</span>
        </h1>
        <p className="t-lead">
          Tank bag, side bag, dan tail bag buatan INZTA sejak 2023. Beri tahu motor Anda, kami tandai tas yang dibuat
          untuknya.
        </p>
        <div className="iz-row">
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
