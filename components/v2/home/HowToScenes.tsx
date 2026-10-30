import type { ReactElement } from 'react';
import Image from 'next/image';
import { Check, WhatsApp } from '@/components/v2/icons';
import { buildWaLink } from '@/lib/utils';
import { fitLabel } from '@/lib/v2/home-data';
import { PHOTO_QUALITY } from '@/lib/v2/image';

export type Scene = 'pick' | 'send' | 'reply';

// The product the three scenes follow (Sehan, 2026-10-29: real UI, not empty states). A real INZTA product: the name is
// the catalogue name of /produk/side-bag-inzta-xsr-155, the chip comes from the same fitLabel rule as its product card,
// and the photo is image 3 of its gallery (the bag on a Yamaha XSR 155), cropped square. Its page sells one piece per
// side ("kiri atau kanan", "sepasang klik 2"), so the quantity goes to 2 with a "Sepasang" tag.
const PRODUCT = { slug: 'side-bag-inzta-xsr-155', name: 'Side bag Inzta XSR 155', photo: '/images/v2/side-bag-inzta-xsr-155-3.webp' };
const FIT = fitLabel(PRODUCT)?.text ?? null;
const QUANTITY = 2;

// The WhatsApp text comes from buildWaLink, the function the product page uses, so the wording cannot drift from the
// real message. Prices and the order ID are not known here (they change, and the ID is made per order), so the amounts
// read "Rp xxx.xxx" and the ID "ORD-XXXXXX" instead of numbers that could go stale.
const MESSAGE = (() => {
  const href = buildWaLink(
    'ORD-XXXXXX',
    [{ productName: PRODUCT.name, selectedVariantLabel: null, sku: null, quantity: QUANTITY, price: 1, subtotal: QUANTITY }],
    { totalPrice: QUANTITY, discountAmount: 0, voucherCode: null, finalPrice: QUANTITY },
  );
  const text = new URL(href).searchParams.get('text') ?? '';
  return text.replace(/Rp [\d.]+/g, 'Rp xxx.xxx').split('\n');
})();

// The first lines of the message as WhatsApp shows them; an empty line becomes a short gap.
function MessageLines({ count, className }: { count: number; className: string }) {
  const out: ReactElement[] = [];
  let shown = 0;
  MESSAGE.forEach((line, i) => {
    if (shown >= count) return;
    if (!line.trim()) {
      if (out.length) out.push(<span key={i} className={`${className} ${className}--gap`} />);
      return;
    }
    shown++;
    out.push(
      <span key={i} className={className}>
        {line}
      </span>,
    );
  });
  return <>{out}</>;
}

function Cursor() {
  return (
    <span className="iz-vig-cursor">
      <svg viewBox="0 0 16 22" focusable="false">
        <path d="M1 1v16.2l4.3-4.1 2.9 6.8 2.9-1.3-2.9-6.6h6.1z" />
      </svg>
      <span className="iz-vig-cursor__ring" />
    </span>
  );
}

function Avatar() {
  return (
    <span className="iz-vig-avatar">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo, the same file as the closing chat */}
      <img src="/logo-inzta.png" alt="" width={18} height={21} loading="lazy" decoding="async" />
    </span>
  );
}

// WhatsApp's double tick; the blue copy on top turns the sent message into a read one.
function Ticks() {
  return (
    <span className="iz-vig-ticks">
      <svg viewBox="0 0 18 11" focusable="false">
        <path d="M1 6l3 3L10.5 2M7 8.5l.6.6L14 2.5" />
      </svg>
      <svg className="iz-vig-ticks__read" viewBox="0 0 18 11" focusable="false">
        <path d="M1 6l3 3L10.5 2M7 8.5l.6.6L14 2.5" />
      </svg>
    </span>
  );
}

function PickScene() {
  return (
    <div className="iz-vig iz-vig-pick">
      <span className="iz-vig-pick__photos">
        <span className="iz-vig-pick__photo iz-vig-pick__photo--back">
          <Image src={PRODUCT.photo} alt="" width={320} height={320} sizes="124px" quality={PHOTO_QUALITY} />
        </span>
        <span className="iz-vig-pick__photo">
          <Image src={PRODUCT.photo} alt="" width={320} height={320} sizes="124px" quality={PHOTO_QUALITY} />
        </span>
      </span>
      <span className="iz-vig-pick__info">
        <span className="iz-vig-pick__name">{PRODUCT.name}</span>
        {FIT && (
          <span className="iz-vig-pick__fit">
            <Check />
            {FIT}
          </span>
        )}
        <span className="iz-vig-pick__label">Jumlah</span>
        <span className="iz-vig-pick__row">
          <span className="iz-vig-pick__qty">
            <span className="iz-vig-pick__btn">
              <svg viewBox="0 0 12 12" focusable="false">
                <path d="M2.5 6h7" />
              </svg>
            </span>
            <span className="iz-vig-pick__num">
              <span>1</span>
              <span>{QUANTITY}</span>
            </span>
            <span className="iz-vig-pick__btn iz-vig-pick__btn--plus">
              <svg viewBox="0 0 12 12" focusable="false">
                <path d="M2.5 6h7M6 2.5v7" />
              </svg>
            </span>
          </span>
          <span className="iz-vig-pick__pair">Sepasang</span>
          <Cursor />
        </span>
      </span>
    </div>
  );
}

function SendScene() {
  return (
    <div className="iz-vig iz-vig-send">
      <span className="iz-vig-send__wa">
        <span className="iz-vig-head">
          <Avatar />
          <span className="iz-vig-head__who">
            <b>Admin INZTA</b>
            <span>WhatsApp</span>
          </span>
        </span>
        <span className="iz-vig-send__compose">
          <span className="iz-vig-send__field">
            <MessageLines count={5} className="iz-vig-send__line" />
          </span>
          <span className="iz-vig-send__go">
            <svg viewBox="0 0 16 16" focusable="false">
              <path d="M2.2 2.6 14.2 8 2.2 13.4 4.1 8z" />
            </svg>
          </span>
        </span>
      </span>
      <span className="iz-vig-send__cta">
        <span className="iz-vig-send__note">Anda akan diarahkan ke WhatsApp</span>
        <span className="iz-vig-send__btn">
          <span className="iz-vig-send__icon">
            <WhatsApp />
          </span>
          Pesan via WhatsApp
        </span>
        <Cursor />
      </span>
    </div>
  );
}

function ReplyScene() {
  return (
    <div className="iz-vig iz-vig-reply">
      <span className="iz-vig-head">
        <Avatar />
        <span className="iz-vig-head__who">
          <b>Admin INZTA</b>
          <span>WhatsApp</span>
        </span>
      </span>
      <span className="iz-vig-reply__chat">
        <span className="iz-vig-reply__out">
          <span className="iz-vig-reply__lines">
            <MessageLines count={3} className="iz-vig-reply__line" />
          </span>
          <Ticks />
        </span>
        <span className="iz-vig-reply__typing">
          <i />
          <i />
          <i />
        </span>
        <span className="iz-vig-reply__in">
          <span className="iz-vig-reply__text">Ongkir ke kota Anda kami hitung dulu, lalu kami kirim info pembayaran.</span>
          <span className="iz-vig-reply__chips">
            <span className="iz-vig-reply__chip">
              <Check />
              Ongkir
            </span>
            <span className="iz-vig-reply__chip">
              <Check />
              Pembayaran
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}

/**
 * Decorative scene of one "Cara pesan" step (F-016 S1.10; rendered inside an aria-hidden stage, nothing focusable).
 * The markup is each scene's last frame, so without JavaScript and under reduced motion it reads as a finished step;
 * HowToStage (howto-motion.ts) plays it from its first frame when the step becomes active.
 */
export default function StepScene({ scene }: { scene: Scene }) {
  if (scene === 'pick') return <PickScene />;
  if (scene === 'send') return <SendScene />;
  return <ReplyScene />;
}
