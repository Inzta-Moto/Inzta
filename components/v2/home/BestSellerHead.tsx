'use client';

import Link from 'next/link';
import { useEffect, useRef, type RefObject } from 'react';
import type { FlashSaleState } from '@/types';
import { endsAtMs, formatPanel, type Countdown } from '@/lib/v2/flash-time';
import { useFlashCountdown } from '@/components/v2/useFlashCountdown';
import ScrollerArrows from '@/components/v2/ScrollerArrows';
import { Bolt } from '@/components/v2/icons';

type UnitKey = 'days' | 'hours' | 'minutes' | 'seconds';

const UNITS: { key: UnitKey; label: string }[] = [
  { key: 'days', label: 'Hari' },
  { key: 'hours', label: 'Jam' },
  { key: 'minutes', label: 'Menit' },
  { key: 'seconds', label: 'Detik' },
];

// "--" until mount so the server HTML and the first client render match (S1.3.1). Days of 100 or more keep every
// digit; zero units show "00" (S1.3.2).
function digits(value: Countdown | null, key: UnitKey): string {
  return value ? String(value[key]).padStart(2, '0') : '--';
}

// S1.3.2: "Berakhir dalam" until mount, then the canvas form. Minute resolution on purpose: the string changes once
// per minute, so React touches the attribute only that often and screen readers are not handed a value every second.
export function timerLabel(value: Countdown | null): string {
  if (!value) return 'Berakhir dalam';
  return `Berakhir dalam ${value.days} hari ${value.hours} jam ${value.minutes} menit`;
}

// Same rule as FlashBar: no clock comparison during render (hydration); an ended sale is caught after mount by the
// shared countdown, on the same clock as the promo bar (S0.3.2).
function useFlash(flash: FlashSaleState) {
  const end = endsAtMs(flash);
  const eligible = flash.isActive === true && end !== null;
  const { value, ended } = useFlashCountdown(eligible ? flash.endsAt : null);
  return { end, live: eligible && end !== null && !ended, value, ended };
}

/**
 * S1.3.3: when the panel disappears while focus is inside it, focus moves to the section that follows the best-seller
 * section. The next section is remembered while the panel is mounted because, without cards, the whole section is
 * removed together with the panel. A click or focus outside the panel forgets the last focused element, so a sale
 * that ends while the visitor is elsewhere never steals focus.
 */
function useFocusRescue(live: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<Element | null>(null);
  const lastRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!live) return;
    nextRef.current = panelRef.current?.closest('section')?.nextElementSibling ?? null;
    const onIn = (e: Event) => {
      lastRef.current = panelRef.current?.contains(e.target as Node) ? (e.target as Element) : null;
    };
    const onDown = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) lastRef.current = null;
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [live]);

  useEffect(() => {
    if (live) return;
    const last = lastRef.current;
    const next = nextRef.current as HTMLElement | null;
    lastRef.current = null;
    if (!last || last.isConnected || !next?.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    if (!next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1');
    next.focus();
  }, [live]);

  return panelRef;
}

// The Main-flash panel (S1.3, FlashSale README): no rotating text, no flash label on cards (S1.3.7). Digits are plain
// text swaps without a transition, so reduced motion needs nothing extra.
function FlashPanel({ end, value, panelRef }: { end: number; value: Countdown | null; panelRef: RefObject<HTMLDivElement> }) {
  return (
    <div className="iz-flashhead" ref={panelRef} data-reveal="">
      <div className="iz-flashhead__text">
        <span className="iz-eyebrow">
          <Bolt />
          Flash sale
        </span>
        <h2 className="t-h2-landing">Flash sale INZTA.</h2>
        <p>Diskon dari harga produk di website. Berakhir {formatPanel(end)}.</p>
      </div>
      <div className="iz-flashhead__side">
        <div className="iz-countdown" role="timer" aria-label={timerLabel(value)}>
          <span className="iz-countdown__label">Berakhir dalam</span>
          {UNITS.map((u, i) => (
            <UnitBox key={u.key} withSep={i > 0} digits={digits(value, u.key)} label={u.label} />
          ))}
        </div>
        <Link className="iz-btn iz-btn--primary" href="/produk">
          Lihat semua produk
        </Link>
      </div>
    </div>
  );
}

// S1.3 with cards: the "Pilihan best seller INZTA." heading with arrows, or the flash panel while the sale runs. When
// the sale ends in the browser the heading returns in the panel's place.
export default function BestSellerHead({ flash, scrollerId }: { flash: FlashSaleState; scrollerId: string }) {
  const { end, live, value } = useFlash(flash);
  const panelRef = useFocusRescue(live);

  if (!live || end === null) {
    return (
      <div className="iz-head iz-head--split">
        <div>
          <span className="iz-eyebrow">Best seller</span>
          <h2 className="t-h2-landing">Pilihan best seller INZTA.</h2>
        </div>
        <ScrollerArrows targetId={scrollerId} />
      </div>
    );
  }
  return <FlashPanel end={end} value={value} panelRef={panelRef} />;
}

// S1.3.4: a sale without any best-seller card renders the panel alone; when that sale ends the whole section goes
// (S1.3.3), because a heading above nothing would be an empty section.
export function FlashOnlySection({ flash }: { flash: FlashSaleState }) {
  const { end, live, value } = useFlash(flash);
  const panelRef = useFocusRescue(live);
  if (!live || end === null) return null;
  return (
    <section className="iz-section--tight" style={{ paddingTop: 0 }} data-motion="best">
      <div className="iz-wrap">
        <FlashPanel end={end} value={value} panelRef={panelRef} />
      </div>
    </section>
  );
}

function UnitBox({ withSep, digits, label }: { withSep: boolean; digits: string; label: string }) {
  return (
    <>
      {withSep && (
        <span className="iz-countdown__sep" aria-hidden="true">
          :
        </span>
      )}
      <div className="iz-countdown__unit">
        <b aria-hidden="true">{digits}</b>
        <span>{label}</span>
      </div>
    </>
  );
}
