import Link from 'next/link';
import { HIRES } from '@/lib/v2/home-content';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight, Chat, CircleCheck, Road, Scissors } from '@/components/v2/icons';
import '@/app/(v2)/v2-why.css';

// The 1200 px square photo fills a portrait panel, so object-fit: cover renders it as wide as the panel is tall (about
// 1.4x the panel width); the sizes hint stays generous so 2x screens get the full source.
const PANEL_SIZES = '(max-width: 767px) 170vw, 70vw';

// "Mengapa pilih INZTA" (F-016 S1.4). Items 1, 3, 4 are team copy waiting for INZTA's G2 approval (P-8, listed by
// check:f016-release, S1.4.3); "sejak 2023" waits for P-10. The photo sits on the dark panel, so it uses the dark
// tone: on error the fallback is --c-aspal and the H2 stays readable (S0.12.5). The photo is INZTA's Foldpack Z10 on a
// Yamaha retro (photo catalog row 159, plate blurred) instead of road-02, which the filmstrip of the same page already
// shows; the alt describes it. The example chips are plain text (S1.4.2).
export default function WhyInzta({ gasberHref, waHref }: { gasberHref: string; waHref: string }) {
  return (
    <section className="iz-section" id="mengapa">
      <div className="iz-wrap iz-why">
        <div className="iz-why__photo" data-reveal-clip="">
          <SmartImage
            src={HIRES.foldpackZ10}
            alt="Motor Yamaha bergaya retro dengan Sidebag Foldpack Z10, tank bag INZTA, dan tas touring lain terpasang, parkir di tepi jalan"
            imgClassName="iz-why__img"
            tone="dark"
            sizes={PANEL_SIZES}
            widths={[800, 1200, 1600]}
            width={1200}
          />
          <span className="iz-eyebrow">Mengapa pilih INZTA</span>
          <h2 className="t-h2-landing">Dibuat di Indonesia. Dipakai di jalan Indonesia.</h2>
        </div>
        <ul className="iz-why__list iz-why__list--tiles" data-reveal-stagger="">
          <li className="iz-why__item">
            <span className="iz-why__icon"><CircleCheck /></span>
            <h3>Jujur soal kecocokan</h3>
            <p>Kami tandai tas yang dibuat untuk motor tertentu, dan bilang terus terang bila belum yakin.</p>
            <div className="iz-why__proof">
              <span className="iz-fit">Dibuat untuk Yamaha XSR 155</span>
              <span className="iz-fit iz-fit--universal">Universal, pakai strap</span>
            </div>
          </li>
          <li className="iz-why__item">
            <span className="iz-why__icon"><Scissors /></span>
            <h3>Dibuat sendiri sejak 2023</h3>
            <p>Kami merancang dan memproduksi sendiri, lalu mengirim dari gudang INZTA.</p>
            <div className="iz-why__proof">
              <Link className="iz-link" href="/tentang">
                Tentang INZTA <ArrowRight size={18} />
              </Link>
            </div>
          </li>
          <li className="iz-why__item">
            <span className="iz-why__icon"><Chat /></span>
            <h3>Dibalas manusia</h3>
            <p>Pesanan dan pertanyaan dijawab admin INZTA lewat WhatsApp.</p>
            <div className="iz-why__proof">
              <a className="iz-link" href={waHref} target="_blank" rel="noopener noreferrer">
                Chat admin <ArrowRight size={18} />
              </a>
            </div>
          </li>
          <li className="iz-why__item">
            <span className="iz-why__icon"><Road /></span>
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
