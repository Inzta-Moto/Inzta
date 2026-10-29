import Link from 'next/link';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { PHOTOS } from '@/lib/v2/home-content';
import { ArrowRight, Chat, CircleCheck, Road, Scissors } from '@/components/v2/icons';

// The panel is portrait while road-02 is 1200 x 630 landscape, so object-fit: cover needs the full width.
const PANEL_PHOTO = optimizeCloudinaryUrl(PHOTOS.road02, 1200);

// "Mengapa pilih INZTA" (F-016 8). Items 1, 3, 4 are team copy waiting for INZTA's G2 approval (P-8).
// "Tentang INZTA" uses the temporary target /#mengapa until a Tentang page exists (4.9, P-12).
export default function WhyInzta({ gasberHref, waHref }: { gasberHref: string; waHref: string }) {
  return (
    <section className="iz-section" id="mengapa">
      <div className="iz-wrap iz-why">
        <div className="iz-why__photo">
          <img
            src={PANEL_PHOTO}
            alt="Dua rider touring berpose di samping motor di padang pasir"
            width={1200}
            height={630}
            loading="lazy"
            decoding="async"
          />
          <span className="iz-eyebrow">Mengapa pilih INZTA</span>
          <h2 className="t-h2-landing">Dibuat di Indonesia. Dipakai di jalan Indonesia.</h2>
        </div>
        <ul className="iz-why__list">
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
