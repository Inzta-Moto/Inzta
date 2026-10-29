import Image from 'next/image';
import { WhatsApp } from '@/components/v2/icons';
import Bounce from '@/components/v2/motion/Bounce';
import ClosingStage from '@/components/v2/ClosingStage';
import { PHOTO_QUALITY } from '@/lib/v2/image';
import '@/app/(v2)/v2-closing.css';

// The way to the right bag in three stops, worded only from existing copy: the panel's own line and the order-flow step
// "Admin membalas" (HowToOrder). No reply time or other promise is added (rules: no new claims).
const ROUTE = ['Kirim foto motor Anda', 'Admin membalas', 'Kami bantu pilihkan tas dan ukurannya'] as const;

// One closing panel per page, so the patch text path can use a fixed id.
const PATCH_PATH = 'iz-closing-patch-path';

// Closing panel (F-016 S0.8). The chat mock is a decorative illustration: aria-hidden, nothing focusable, no admin reply,
// the photo keeps its "Foto contoh" tag, and the label and patch around it reuse words already on the site ("Foto
// motor Anda", the product page pill "Dibalas admin INZTA"). CSS hides the mock below 768 px; the route list carries
// the story there. Motion and the pointer lean come from ClosingStage and v2-closing.css. S5 sets its own button label
// and places the section directly in main (motor.dc.html), so `wrapped` and `className` cover that layout (S5.9.3).
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
    <ClosingStage className={`iz-closing iz-closing--split iz-dark${className ? ` ${className}` : ''}`}>
      <div className="iz-closing__body">
        <h2 className="t-h2-landing">Belum yakin tas mana yang pas untuk motor Anda?</h2>
        <p className="t-body">Kirim foto motor Anda ke admin INZTA. Kami bantu pilihkan tas dan ukurannya.</p>
        <ol className="iz-closing__route">
          {ROUTE.map((text, i) => (
            <li key={text}>
              <span className="iz-closing__n">{i + 1}</span>
              <span className="iz-closing__stop">{text}</span>
            </li>
          ))}
        </ol>
        <div className="iz-wa">
          <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
          <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
            <span className="iz-btn__icon">
              <WhatsApp />
            </span>
            <span>
              <Bounce text={label} />
            </span>
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
            <Image src="/images/v2/contoh/contoh-motor-xsr-155.jpg" alt="" width={382} height={512} sizes="320px" quality={PHOTO_QUALITY} />
            <span className="iz-tag">Foto contoh</span>
          </div>
          <p>Yamaha XSR 155</p>
        </div>
        <div className="iz-chat__typing">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span className="iz-chat__label">Foto motor Anda</span>
        <span className="iz-chat__patch">
          <svg viewBox="0 0 100 100" focusable="false">
            <path id={PATCH_PATH} d="M50 50m-35 0a35 35 0 1 1 70 0a35 35 0 1 1-70 0" fill="none" />
            <circle className="iz-chat__patch-disc" cx="50" cy="50" r="48" />
            <circle className="iz-chat__patch-stitch" cx="50" cy="50" r="44" />
            <text className="iz-chat__patch-text">
              <textPath href={`#${PATCH_PATH}`} textLength="218" lengthAdjust="spacing">
                Dibalas admin INZTA ·
              </textPath>
            </text>
            <WhatsApp x={37} y={37} width={26} height={26} />
          </svg>
        </span>
      </div>
    </ClosingStage>
  );
  return wrapped ? <div className="iz-wrap">{panel}</div> : panel;
}
