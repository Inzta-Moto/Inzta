'use client';

import Image from 'next/image';
import { MOTOR_CATEGORIES, categoryLabel } from '@/lib/v2/home-content';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import CategoryLink from '@/components/v2/CategoryLink';
import { Check } from '@/components/v2/icons';
import Bounce from '@/components/v2/motion/Bounce';
import { PHOTO_QUALITY } from '@/lib/v2/image';

// F-016 S1.2. The server render is "not chosen" (S0.6.2); the stored choice arrives through useMotorCategory after
// mount and updates the navbar chip and the "Motor saya" marks through the same provider (S1.2.1). Tile photos get
// alt="" because the label already names the button (S0.12.6); they are INZTA's own photos, so no "Foto contoh" tag.
// Choosing never navigates or scrolls (S1.2.2).
export default function Garasi() {
  const { category, setCategory } = useMotorCategory();
  const chosen = category ? categoryLabel(category) : null;

  return (
    <section className="iz-section" id="garasi">
      <div className="iz-wrap">
        <div className="iz-head iz-head--center">
          <h2 className="t-h2-landing">Motor Anda apa?</h2>
          <p className="t-body">Pilih kategori motor Anda sekali. Kami tandai tas yang cocok di seluruh toko.</p>
        </div>
        <div className="iz-garasi" data-reveal-stagger="">
          {MOTOR_CATEGORIES.map((c, i) => {
            const pressed = category === c.value;
            // F-028: from 768 px three tiles on top and two wider ones below; on phones two columns and an odd last
            // tile across both (v2-overrides.css). sizes follows those widths (content box at most 1440 px).
            const lower = i >= 3;
            const wide = i === MOTOR_CATEGORIES.length - 1 && i % 2 === 0;
            const sizes = `(max-width: 767px) ${wide ? '100vw' : '50vw'}, (max-width: 1023px) ${lower ? '50vw' : '34vw'}, ${lower ? '700px' : '460px'}`;
            return (
              <button
                key={c.value}
                className="iz-gtile"
                type="button"
                aria-pressed={pressed}
                onClick={() => setCategory(c.value)}
              >
                <Image src={c.image} alt="" width={512} height={384} sizes={sizes} quality={PHOTO_QUALITY} />
                <span className="iz-gtile__label">{c.label}</span>
                {pressed && (
                  <span className="iz-gtile__check">
                    <Check />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          {category && chosen ? (
            <CategoryLink value={category} className="iz-btn iz-btn--primary iz-btn--block iz-garasi__cta">
              <Bounce text={`Lihat tas untuk motor ${chosen}`} />
            </CategoryLink>
          ) : (
            // S1.2.3: same box, kept in the layout but invisible and out of the tab order, so a choice made after
            // mount (or restored from storage) does not shift the page.
            <span className="iz-btn iz-btn--primary iz-btn--block iz-garasi__cta" data-hidden="true" aria-hidden="true">
              Lihat tas untuk motor
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
