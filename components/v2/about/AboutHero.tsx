import SmartImage from '@/components/v2/ui/SmartImage';
import { HERO_PHOTO, SHOW_SINCE_2023 } from '@/components/v2/about/about-content';

// Tentang hero (F-016 S8.1). The photo is the only eager image and is never animated (S8.1.1); .iz-hero keeps the
// --c-aspal background under it, so the text stays readable while it loads or after it fails (S8.1.2). The sentinel
// tells SiteNav when to switch to the light navbar.
export default function AboutHero() {
  return (
    <section className="iz-hero iz-on-photo">
      <SmartImage
        src={HERO_PHOTO.src}
        alt={HERO_PHOTO.alt}
        className="iz-hero__img"
        imgClassName="iz-hero__img"
        tone="dark"
        priority
        sizes="100vw"
        widths={[640, 1080, 1600, 2000]}
        width={1600}
      />
      <div className="iz-hero__body">
        <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
          {SHOW_SINCE_2023 ? 'Tentang INZTA · sejak 2023' : 'Tentang INZTA'}
        </span>
        <h1 className="t-display">
          Dibuat untuk <span className="iz-tone2">jalan Indonesia.</span>
        </h1>
        <p className="t-lead">
          INZTA adalah brand lokal tas dan perlengkapan motor dari PT Inzta Gear Indonesia. Kami membuat tank bag, side bag,
          tail bag, dan aksesori touring untuk rider Indonesia.
        </p>
      </div>
      <div data-hero-end aria-hidden="true" />
    </section>
  );
}
