import Link from 'next/link';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';
import { VALUES_PHOTO } from '@/components/v2/about/about-content';
import '@/app/(v2)/v2-why.css';

// "Yang kami pegang." (F-016 S8.3). Team copy waiting for G2 (P-8); the page hides this section through
// SHOW_VALUES_COPY. The two chips are static examples of the FitLabel styles, not links and not data (S8.3.1). The
// photo uses the dark tone so the H2 stays readable through the scrim on the fallback too (S8.3.5).

// F-024: the same 3D icons and --ikon list as "Mengapa pilih INZTA" on the home page (WhyInzta.tsx), so the two
// sections read as one set. Decorative (alt=""), 144 px for the 72 px phone size at 2x, 192 px for 96 px desktop; the
// fixed size keeps the row from shifting when the lazy image arrives.
const ICON_SIZES = '(max-width: 767px) 72px, 96px';
function ValuesIcon({ name }: { name: string }) {
  const base = `/images/v2/ikon/${name}`;
  return (
    <span className="iz-why__icon">
      <img src={`${base}-192.webp`} srcSet={`${base}-144.webp 144w, ${base}-192.webp 192w`} sizes={ICON_SIZES} width={96} height={96} alt="" loading="lazy" decoding="async" />
    </span>
  );
}

export default function ValuesList({ gasberHref }: { gasberHref: string }) {
  return (
    <section className="iz-section" style={{ paddingTop: 0 }}>
      <div className="iz-wrap iz-why">
        <div className="iz-why__photo" data-reveal-clip="">
          <SmartImage src={VALUES_PHOTO.src} alt={VALUES_PHOTO.alt} tone="dark" imgClassName="iz-why__img--values" sizes="(max-width: 767px) 100vw, 480px" widths={[480, 800, 1200]} width={800} />
          <h2 className="t-h2-landing" data-reveal-lines="">Yang kami pegang.</h2>
        </div>
        <ul className="iz-why__list iz-why__list--ikon" data-reveal-stagger="">
          <li className="iz-why__item">
            <ValuesIcon name="kecocokan" />
            <h3>Jujur soal kecocokan</h3>
            <p>Kami tandai tas yang dibuat untuk motor tertentu, dan bilang terus terang bila belum yakin.</p>
            <div className="iz-why__proof">
              <span className="iz-fit">Dibuat untuk Yamaha XSR 155</span>
              <span className="iz-fit iz-fit--universal">Universal, pakai strap</span>
            </div>
          </li>
          <li className="iz-why__item">
            <ValuesIcon name="chat" />
            <h3>Ngobrol langsung dengan tim INZTA</h3>
            <p>Pesanan dan pertanyaan dijawab admin INZTA lewat WhatsApp.</p>
            <div className="iz-why__proof">
              <a className="iz-link" href="#kontak">
                Chat admin <ArrowRight size={18} />
              </a>
            </div>
          </li>
          <li className="iz-why__item">
            <ValuesIcon name="ride-bareng" />
            <h3>Ikut turun ke jalan</h3>
            <p>Kami ikut ride bersama komunitas, bukan hanya berjualan.</p>
            <div className="iz-why__proof">
              <Link className="iz-link" href={gasberHref}>
                Baca catatan Gasber 16 <ArrowRight size={18} />
              </Link>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
