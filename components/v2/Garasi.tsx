'use client';

import Image from 'next/image';
import { MOTOR_CATEGORIES, categoryLabel } from '@/lib/v2/home-content';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { Check } from '@/components/v2/icons';

// F-016 5. The server render is "not chosen" (5.2); the stored choice arrives through useMotorCategory after mount.
// Tile photos get alt="" because the label already names the button (20.5, D-9). The WhatsApp button stays in the
// DOM, hidden, while nothing is chosen so a choice never shifts the layout (5.2, 5.3).
export default function Garasi({ waNumber }: { waNumber: string }) {
  const { category, setCategory } = useMotorCategory();
  const chosen = category ? categoryLabel(category) : null;
  const waHref = chosen
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(
        `Halo INZTA, motor saya kategori ${chosen}. Tas mana yang dibuat untuk motor ini?`,
      )}`
    : undefined;

  return (
    <section className="iz-section" id="garasi">
      <div className="iz-wrap">
        <div className="iz-head iz-head--center">
          <h2 className="t-h2-landing">Motor Anda apa?</h2>
          <p className="t-body">Pilih kategori motor Anda sekali. Kami tandai tas yang cocok di seluruh toko.</p>
        </div>
        <div className="iz-garasi">
          {MOTOR_CATEGORIES.map(c => {
            const pressed = category === c.value;
            return (
              <button
                key={c.value}
                className="iz-gtile"
                type="button"
                aria-pressed={pressed}
                onClick={() => setCategory(c.value)}
              >
                <Image src={c.image} alt="" width={512} height={384} sizes="(max-width: 767px) 50vw, 282px" />
                <span className="iz-gtile__label">{c.label}</span>
                {pressed && (
                  <span className="iz-gtile__check">
                    <Check />
                  </span>
                )}
                <span className="iz-tag" aria-hidden="true">
                  Foto contoh
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          <a
            className="iz-btn iz-btn--primary iz-btn--block iz-garasi__cta"
            href={waHref}
            target={waHref ? '_blank' : undefined}
            rel={waHref ? 'noopener noreferrer' : undefined}
            data-hidden={chosen ? undefined : 'true'}
            aria-hidden={chosen ? undefined : true}
            tabIndex={chosen ? undefined : -1}
          >
            {chosen ? `Lihat tas untuk motor ${chosen}` : 'Lihat tas untuk motor'}
          </a>
        </div>
      </div>
    </section>
  );
}
