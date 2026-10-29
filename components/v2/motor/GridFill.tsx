import Link from 'next/link';
import { ArrowRight, WhatsApp } from '@/components/v2/icons';

// .iz-grid-4 has four columns from 768 px and two below (v2-components.css).
const COLS = 4;
const COLS_PHONE = 2;

type FillKind = 'wa' | 'all';
const ORDER: readonly FillKind[] = ['wa', 'all'];

export interface FillSlot {
  kind: FillKind;
  // Also takes the spare column, so one product and two helper cards still fill a four-column row.
  wide: boolean;
  // Phones have only COLS_PHONE - count free slots; the other cards are hidden there.
  phone: boolean;
}

// First row only. Zero products keeps the empty state; a full row needs no helper.
export function fillSlots(count: number): FillSlot[] {
  if (count < 1 || count >= COLS) return [];
  const free = COLS - count;
  const freePhone = Math.max(0, COLS_PHONE - count);
  const kinds = ORDER.slice(0, free);
  return kinds.map((kind, i) => ({ kind, wide: i === 0 && free > kinds.length, phone: i < freePhone }));
}

// Helper cards in the free slots of the first row of "Tas yang ditandai untuk motor X" (Sehan, 2026-10-29: one card
// in a four-column row looked unfinished). Copy is reused from Closing and MoreCard, so the cards add no claim. The
// wrapper is the grid item because the motion engine leaves an inline transform on grid items, which would cancel a
// hover lift on them. PositionTabs gives these items no position, so they show under "Semua" only.
export default function GridFill({ count, waHref }: { count: number; waHref: string }) {
  return (
    <>
      {fillSlots(count).map(({ kind, wide, phone }) => {
        const cls = `iz-mfill iz-mfill--${kind}${wide ? ' iz-mfill--wide' : ''}${phone ? '' : ' iz-only-desk'}`;
        return kind === 'wa' ? (
          <div key={kind} className={cls}>
            <div className="iz-mfill__card iz-dark">
              <span className="iz-mfill__icon">
                <WhatsApp />
              </span>
              <h3 className="iz-mfill__title">Belum yakin tas mana yang pas untuk motor Anda?</h3>
              <p className="iz-mfill__text">Kirim foto motor Anda ke admin INZTA. Kami bantu pilihkan tas dan ukurannya.</p>
              <a className="iz-link iz-mfill__cta" href={waHref} target="_blank" rel="noopener noreferrer">
                Chat admin via <span className="iz-nowrap">WhatsApp <ArrowRight size={18} /></span>
              </a>
            </div>
          </div>
        ) : (
          <div key={kind} className={cls}>
            <Link className="iz-mfill__card" href="/produk">
              <span className="iz-arrow">
                <ArrowRight />
              </span>
              <span className="iz-mfill__label">Lihat semua produk</span>
            </Link>
          </div>
        );
      })}
    </>
  );
}
