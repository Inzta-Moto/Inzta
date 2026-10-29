import Image from 'next/image';
import { WhatsApp } from '@/components/v2/icons';

// Closing panel (F-016 S0.8). The chat mock is decorative and holds no invented admin reply; CSS hides it below
// 768 px and stops the typing dots under reduced motion. S5 sets its own button label and places the section
// directly in main (motor.dc.html), so `wrapped` and `className` cover that layout (S5.9.3).
export default function Closing({
  waHref,
  label = 'Chat admin via WhatsApp',
  wrapped = true,
  className,
}: {
  waHref: string;
  label?: string;
  wrapped?: boolean;
  className?: string;
}) {
  const panel = (
      <section className={`iz-closing iz-closing--split iz-dark${className ? ` ${className}` : ''}`}>
        <div className="iz-closing__body">
          <h2 className="t-h2-landing">Belum yakin tas mana yang pas untuk motor Anda?</h2>
          <p className="t-body">Kirim foto motor Anda ke admin INZTA. Kami bantu pilihkan tas dan ukurannya.</p>
          <div className="iz-wa">
            <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
            <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>{label}</span>
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
  return wrapped ? <div className="iz-wrap">{panel}</div> : panel;
}
