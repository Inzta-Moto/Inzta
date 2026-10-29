import Image from 'next/image';
import { WhatsApp } from '@/components/v2/icons';

// Closing panel (F-016 15). The chat mock is decorative and holds no invented admin reply (15.2);
// CSS hides it below 768 px and stops the typing dots under reduced motion (15.3).
export default function Closing({ waHref }: { waHref: string }) {
  return (
    <div className="iz-wrap">
      <section className="iz-closing iz-closing--split iz-dark">
        <div className="iz-closing__body">
          <h2 className="t-h2-landing">Belum yakin tas mana yang pas untuk motor Anda?</h2>
          <p className="t-body">Kirim foto motor Anda ke admin INZTA. Kami bantu pilihkan tas dan ukurannya.</p>
          <div className="iz-wa">
            <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
            <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>Chat admin via WhatsApp</span>
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
    </div>
  );
}
