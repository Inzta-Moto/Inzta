import type { MotorCategory } from '@/types';
import { MOTOR_CATEGORIES } from '@/lib/v2/home-content';
import CategoryLink from '@/components/v2/CategoryLink';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';

// "Kategori lain" (S5.7): the other three categories in D1 order, whatever their index state (S5.7.2). Each tile is
// a real link that also stores the category (S0.6); the photo is decorative because the name labels the link.
export default function OtherCategories({ current }: { current: MotorCategory }) {
  return (
    <section className="iz-section iz-wrap" id="motor-lain">
      <div className="iz-head">
        <h2 className="t-h2-landing">Kategori lain</h2>
      </div>
      <div className="iz-grid-3">
        {MOTOR_CATEGORIES.filter(c => c.value !== current).map(c => (
          <CategoryLink key={c.value} value={c.value} className="iz-mtile">
            <SmartImage src={c.image} alt="" sizes="(max-width: 767px) 100vw, 400px" fallbackLabel="Foto contoh" />
            <span className="iz-tag" aria-hidden="true">Foto contoh</span>
            <div className="iz-mtile__body">
              <b>{c.label}</b>
              <span className="iz-arrow">
                <ArrowRight />
              </span>
            </div>
          </CategoryLink>
        ))}
      </div>
    </section>
  );
}
