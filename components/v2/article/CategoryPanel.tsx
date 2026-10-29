import Image from 'next/image';
import CategoryLink from '@/components/v2/CategoryLink';
import { MOTOR_CATEGORIES } from '@/lib/v2/home-content';
import { PHOTO_QUALITY } from '@/lib/v2/image';

// "Cari tas untuk motor Anda" (F-016 S6.4, blog.dc.html:60-70). Example photos keep the "Foto contoh" tag (P-1);
// the tiles use the shared category link, which navigates and stores the category (S0.4.3, S6.4.2).
export default function CategoryPanel() {
  return (
    <section className="iz-panel" style={{ marginTop: 56 }}>
      <h2 className="t-h2-shop" style={{ marginBottom: 20 }}>Cari tas untuk motor Anda</h2>
      <div className="iz-grid-4">
        {MOTOR_CATEGORIES.map(c => (
          <CategoryLink key={c.value} value={c.value} className="iz-mtile">
            <Image src={c.image} alt={c.alt} width={512} height={384} sizes="(max-width: 767px) 50vw, 270px" quality={PHOTO_QUALITY} />
            <span className="iz-tag">Foto contoh</span>
            <div className="iz-mtile__body">
              <div>
                <b>{c.label}</b>
                <span>Lihat tas →</span>
              </div>
            </div>
          </CategoryLink>
        ))}
      </div>
    </section>
  );
}
