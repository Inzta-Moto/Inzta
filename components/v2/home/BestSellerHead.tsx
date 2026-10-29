'use client';

import Link from 'next/link';
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

// "--" until mount so the server HTML and the first client render match (24.5).
function digits(value: Countdown | null, key: UnitKey): string {
  return value ? String(value[key]).padStart(2, '0') : '--';
}

// Minute resolution on purpose: the string changes once per minute, so the attribute is only touched that often
// and screen readers are not handed a new value every second (24.5).
function timerLabel(value: Countdown | null, endMs: number): string {
  if (!value) return `Berakhir ${formatPanel(endMs)}`;
  const { days, hours, minutes } = value;
  if (days === 0 && hours === 0 && minutes === 0) return 'Berakhir dalam kurang dari 1 menit';
  const out: string[] = [];
  if (days > 0) out.push(`${days} hari`);
  if (days > 0 || hours > 0) out.push(`${hours} jam`);
  out.push(`${minutes} menit`);
  return `Berakhir dalam ${out.join(' ')}`;
}

// F-016 7.1 and 24.4: normal "Pilihan best seller INZTA." heading with ScrollerArrows, or the flash-sale countdown panel.
// hasCards: after a sale ends with no best seller, the plain heading would sit above nothing, so render nothing (7.2).
export default function BestSellerHead({ flash, scrollerId, hasCards = true }: { flash: FlashSaleState; scrollerId: string; hasCards?: boolean }) {
  const end = endsAtMs(flash);
  // Same rule as FlashBar: no clock comparison during render (hydration); an ended sale is caught after mount.
  const eligible = flash.isActive === true && end !== null;
  const { value, ended } = useFlashCountdown(eligible ? flash.endsAt : null);

  if (!eligible || end === null || ended) {
    if (!hasCards) return null;
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

  // Digits are plain text swaps without a transition, so reduced motion needs nothing extra (24.9).
  return (
    <div className="iz-flashhead">
      <div className="iz-flashhead__text">
        <span className="iz-eyebrow">
          <Bolt />
          Flash sale
        </span>
        <h2 className="t-h2-landing">Flash sale INZTA.</h2>
        <p>Diskon dari harga produk di website. Berakhir {formatPanel(end)}.</p>
      </div>
      <div className="iz-flashhead__side">
        <div className="iz-countdown" role="timer" aria-label={timerLabel(value, end)}>
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
