import Image from 'next/image';
import { WhatsApp } from '@/components/v2/icons';
import Bounce from '@/components/v2/motion/Bounce';
import ClosingStage from '@/components/v2/ClosingStage';
import { PHOTO_QUALITY } from '@/lib/v2/image';
import '@/app/(v2)/v2-closing.css';

// The way to the right bag in three stops, worded only from existing copy: the panel's own line and the order-flow step
// "Admin membalas" (HowToOrder). No reply time or other promise is added (rules: no new claims).
const ROUTE = ['Kirim foto motor Anda', 'Admin membalas', 'Kami bantu pilihkan tas dan ukurannya'] as const;

// One closing panel per page, so the SVG ids can be fixed.
const PATCH_PATH = 'iz-closing-patch-path';
const TRAIL_MASK = 'iz-closing-trail-mask';
const EXIT_MASK = 'iz-closing-exit-mask';

// The touring route on the band's map, in the 1152 x 566 design box of the 1440 px band. The main leg runs under the
// button, climbs the gap between copy and chat and goes in behind the card; the exit leg comes out past the card's top
// right corner. Each SVG keeps the aspect of its slice of that box, so both stay in place as the band scales.
const TRAIL = 'M-12 548C120 556 220 532 330 545S520 562 600 532S668 452 666 392S690 322 744 302';
const EXIT = 'M1040 158C1084 146 1114 118 1130 88S1152 30 1176 8';

// The real product of the admin's reply: its own name says what it is made for and the site already labels it
// "Dibuat untuk Yamaha XSR 155" (fitLabel), so the reply adds no fit claim. The thumbnail is photo 3 of its gallery.
const PICK = { name: 'Side bag Inzta XSR 155', fit: 'Dibuat untuk Yamaha XSR 155', image: '/images/v2/closing-side-bag-xsr-155.webp' };

function Ticks() {
  return (
    <svg className="iz-chat__ticks" viewBox="0 0 18 11" focusable="false">
      <path d="M1.2 6.2 4.3 9.2 10.8 1.8M7.4 8.4 8.3 9.2 14.8 1.8" />
    </svg>
  );
}

// Closing panel (F-016 S0.8). Behind the copy lies a route map: topographic contours with a kuning route that runs
// into the chat, lit by a warm glow and, on fine pointers, by a headlight that follows the cursor (v2-closing.css).
// The chat is a decorative illustration: aria-hidden, nothing focusable, the photo keeps its "Foto contoh" tag, and
// every label reuses words already on the site ("Dibalas admin INZTA" from the product page pill, the fit chip of the
// recommended product). Only the visitor's message carries a time, so no reply time is implied (rules: no new
// claims). Motion and the pointer effects come from ClosingStage. S5 sets its own button label and places
// the section directly in main (motor.dc.html), so `wrapped` and `className` cover that layout (S5.9.3).
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
      <div className="iz-closing__map" aria-hidden="true">
        <div className="iz-closing__topo">
          <span className="iz-closing__glow" />
          <span className="iz-closing__lamp" />
        </div>
        <svg className="iz-closing__trail" viewBox="0 280 1152 286" focusable="false">
          <mask id={TRAIL_MASK} maskUnits="userSpaceOnUse" x="-40" y="260" width="1232" height="326">
            <path className="iz-closing__reveal" d={TRAIL} pathLength={1} />
          </mask>
          <path className="iz-closing__road" d={TRAIL} mask={`url(#${TRAIL_MASK})`} />
        </svg>
        <svg className="iz-closing__trail iz-closing__trail--exit" viewBox="1040 0 112 170" focusable="false">
          <mask id={EXIT_MASK} maskUnits="userSpaceOnUse" x="1020" y="-20" width="172" height="210">
            <path className="iz-closing__reveal" d={EXIT} pathLength={1} />
          </mask>
          <path className="iz-closing__road" d={EXIT} mask={`url(#${EXIT_MASK})`} />
        </svg>
      </div>
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
            <img src="/logo-inzta.png" alt="" width={22} height={26} loading="lazy" decoding="async" />
          </span>
          <span className="iz-chat__who">
            <b>Admin INZTA</b>
            <span className="iz-chat__status">
              <span className="iz-chat__status-idle">Akun bisnis</span>
              <span className="iz-chat__status-typing">mengetik…</span>
            </span>
          </span>
          <span className="iz-chat__app">
            <WhatsApp />
          </span>
        </div>
        <div className="iz-chat__thread">
          <div className="iz-chat__out">
            <div className="iz-photo">
              <Image
                src="/images/v2/contoh/contoh-motor-xsr-155.jpg"
                alt=""
                width={382}
                height={512}
                sizes="(max-width: 767px) 220px, 250px"
                quality={PHOTO_QUALITY}
              />
              <span className="iz-tag">Foto contoh</span>
            </div>
            <span className="iz-chat__text">
              Tas apa yang pas untuk motor ini?
              <span className="iz-chat__meta">
                10.12
                <Ticks />
              </span>
            </span>
          </div>
          <div className="iz-chat__slot">
            <span className="iz-chat__typing iz-chat__typing--pre">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <div className="iz-chat__in">
              <span className="iz-chat__text">Ini XSR 155 ya, Kak. Coba yang ini:</span>
              <span className="iz-chat__pick">
                <img src={PICK.image} alt="" width={46} height={46} loading="lazy" decoding="async" />
                <span className="iz-chat__pick-text">
                  <b>{PICK.name}</b>
                  <span className="iz-chat__fit">{PICK.fit}</span>
                </span>
              </span>
            </div>
          </div>
          <div className="iz-chat__typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
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
