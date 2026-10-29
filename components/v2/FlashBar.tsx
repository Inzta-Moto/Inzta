'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { FlashSaleState } from '@/types';
import { endsAtMs, formatBarLong, formatBarShort } from '@/lib/v2/flash-time';
import { useFlashCountdown } from '@/components/v2/useFlashCountdown';
import { ArrowRight, Close } from '@/components/v2/icons';

const CLOSED_KEY = 'inzta.flashBarClosed';

// Promo bar above the navbar (F-016 24.3, 24.6, 24.7). It must stay the direct sibling before .iz-navwrap
// (`.iz-promobar + .iz-navwrap` sets the navbar offset) and renders nothing at all when hidden.
export default function FlashBar({ flash }: { flash: FlashSaleState }) {
  const end = endsAtMs(flash);
  // No clock comparison during render: server and client clocks differ, so comparing here could break hydration.
  // The time check happens after mount in useFlashCountdown.
  const eligible = flash.isActive === true && end !== null;
  const { ended } = useFlashCountdown(eligible ? flash.endsAt : null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!eligible || !flash.endsAt) return;
    try {
      setClosed(window.sessionStorage.getItem(CLOSED_KEY) === flash.endsAt);
    } catch {
      // Storage blocked (private mode, cookies off): the bar simply stays visible.
    }
  }, [eligible, flash.endsAt]);

  if (!eligible || end === null || ended || closed) return null;

  // The close button disappears with the bar, so keyboard focus moves to the brand link instead of body (S0.3.9).
  const close = () => {
    const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('iz-promobar__close');
    setClosed(true);
    if (hadFocus) requestAnimationFrame(() => document.querySelector<HTMLElement>('.iz-nav .iz-brand')?.focus());
    try {
      if (flash.endsAt) window.sessionStorage.setItem(CLOSED_KEY, flash.endsAt);
    } catch {
      // Without storage the bar is hidden for this page view only.
    }
  };

  return (
    <div className="iz-promobar" role="region" aria-label="Flash sale">
      <span className="iz-promobar__dot" aria-hidden="true" />
      <span className="iz-only-desk">
        <b>Flash sale</b> · Diskon harga produk di website sampai {formatBarLong(end)}
      </span>
      <span className="iz-only-mob">
        <b>Flash sale</b> sampai {formatBarShort(end)}
      </span>
      <Link href="/produk">
        Lihat produk <ArrowRight />
      </Link>
      <button className="iz-promobar__close" type="button" aria-label="Tutup info flash sale" onClick={close}>
        <Close />
      </button>
    </div>
  );
}
