import Link from 'next/link';
import type { MotorCategory } from '@/types';
import { ArrowRight } from '@/components/v2/icons';
import SmartImage from '@/components/v2/ui/SmartImage';
import { MOTOR_CATEGORIES } from '@/lib/v2/home-content';

// "Semua motor (strap)" (S5.5): the whole card is one link to the catalog. The four category photos in mini form say
// "semua motor" in pictures; they are decorative (the title names the link), and the current category is ringed so the
// card ties back to "Bisa juga untuk motor X". The photos are INZTA's own category photos, so no "Foto contoh" tag.
// On desktop a tile can be a strip about 119 x 308 px; a square photo covers it about 308 px wide and the 4:3
// Adventure photo about 411 px, so the hint asks for 420px (160px served a variant enlarged about 1.6 times).
export default function MoreCard({ current }: { current?: MotorCategory }) {
  return (
    <Link className="iz-morecard" href="/produk">
      <span className="iz-morecard__tiles" aria-hidden="true">
        {MOTOR_CATEGORIES.map(c => (
          <span key={c.value} className={`iz-morecard__tile${c.value === current ? ' is-current' : ''}`}>
            <SmartImage src={c.image} alt="" sizes="(max-width: 767px) 45vw, 420px" />
            <b>{c.label}</b>
          </span>
        ))}
      </span>
      <div className="iz-morecard__body">
        <h3>Semua motor (strap)</h3>
        <p>Tas dengan strap untuk banyak motor.</p>
      </div>
      <span className="iz-link iz-morecard__cta">
        Lihat semua produk <ArrowRight size={18} />
      </span>
    </Link>
  );
}
