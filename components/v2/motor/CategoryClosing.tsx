import Image from 'next/image';
import { WhatsApp } from '@/components/v2/icons';

// Closing panel of S0.8 with the S5 label and prefilled text (S5.9.3). Same markup as components/v2/Closing.tsx,
// which has no label prop yet; the section sits directly in main as in motor.dc.html, so v2-motor.css gives it the
// width of .iz-wrap. Remove this file once Closing accepts `label`.
export default function CategoryClosing({ waHref }: { waHref: string }) {
  return (
    <section className="iz-closing iz-closing--split iz-dark iz-motor-closing">
      <div className="iz-closing__body">
        <h2 className="t-h2-landing">Belum yakin tas mana yang pas untuk motor Anda?</h2>
        <p className="t-body">Kirim foto motor Anda ke admin INZTA. Kami bantu pilihkan tas dan ukurannya.</p>
        <div className="iz-wa">
          <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
          <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
            <span className="iz-btn__icon">
              <WhatsApp />
            </span>
            <span>Tanya admin soal motor Anda</span>
          </a>
        </div>
      </div>
      <div className="iz-chat" aria-hidden="true">
        <div className="iz-chat__head">
          <span className="iz-chat__avatar">
            <img src="/logo-inzta.png" alt="" width={22} height={22} loading="lazy" decoding="async" />
          </span>
          <span className="iz-chat__who">
            <b>Admin INZTA</b>
            <span>WhatsApp</span>
          </span>
        </div>
        <div className="iz-chat__out">
          <div className="iz-photo">
            <Image src="/images/v2/contoh/contoh-motor-xsr-155.jpg" alt="" width={382} height={512} sizes="320px" />
            <span className="iz-tag">Foto contoh</span>
          </div>
          <p>Yamaha XSR 155</p>
        </div>
        <div className="iz-chat__typing">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </section>
  );
}
