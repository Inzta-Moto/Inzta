import Link from 'next/link';
import type { HomeProductCard, MotorCategory } from '@/types';
import { ArrowRight, WhatsApp } from '@/components/v2/icons';
import SmartImage from '@/components/v2/ui/SmartImage';
import { MOTOR_CATEGORIES } from '@/lib/v2/home-content';

// .iz-grid-4 has four columns from 768 px and two below (v2-components.css).
const COLS = 4;
const COLS_PHONE = 2;
const FAN_MAX = 3;

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

// Photos for the "Lihat semua produk" fan: products already on this page, once each, so the card shows no new item.
export function fanThumbs(products: readonly HomeProductCard[], max = FAN_MAX): { slug: string; image: string }[] {
  const seen = new Set<string>();
  const out: { slug: string; image: string }[] = [];
  for (const p of products) {
    if (!p.image || seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push({ slug: p.slug, image: p.image });
    if (out.length === max) break;
  }
  return out;
}

// Helper cards in the free slots of the first row of "Tas yang ditandai untuk motor X" (Sehan, 2026-10-29: one card
// in a four-column row looked unfinished, and the flat panels looked empty). Copy is reused from Closing and MoreCard,
// and the visuals reuse the category example photo and the product photos of this page, so the cards add no claim.
// The wrapper is the grid item because the motion engine leaves an inline transform on grid items, which would cancel
// a hover lift on them. PositionTabs gives these items no position, so they show under "Semua" only.
export default function GridFill({
  count,
  waHref,
  category,
  products = [],
}: {
  count: number;
  waHref: string;
  category?: MotorCategory;
  products?: readonly HomeProductCard[];
}) {
  const photo = MOTOR_CATEGORIES.find(c => c.value === category)?.image ?? null;
  const thumbs = fanThumbs(products);
  return (
    <>
      {fillSlots(count).map(({ kind, wide, phone }) => {
        const cls = `iz-mfill iz-mfill--${kind}${wide ? ' iz-mfill--wide' : ''}${phone ? '' : ' iz-only-desk'}`;
        return kind === 'wa' ? (
          <div key={kind} className={cls}>
            <div className="iz-mfill__card iz-dark">
              {/* The question mark echoes the title, drawn as an outline like the Tourmax "30" of the Beranda band. */}
              <span className="iz-mfill__bg" aria-hidden="true">
                <span className="iz-mfill__glyph">?</span>
              </span>
              {/* "Kirim foto motor Anda": the WhatsApp chip sends a photo of a motor of this category. */}
              <span className="iz-mfill__art" aria-hidden="true">
                <span className="iz-mfill__icon">
                  <WhatsApp />
                </span>
                {photo && (
                  <>
                    <svg className="iz-mfill__route" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <path d="M0 8 C 30 8, 45 34, 100 30" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {/* Plate and frame are siblings: a rotated frame is its own stacking context, so a plate drawn
                        as its pseudo-element would paint over the frame border. */}
                    <span className="iz-mfill__photo">
                      <span className="iz-mfill__plate" />
                      <span className="iz-mfill__frame">
                        <SmartImage src={photo} alt="" tone="dark" sizes="200px" fallbackLabel="Foto contoh" />
                        <span className="iz-tag">Foto contoh</span>
                      </span>
                    </span>
                  </>
                )}
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
              {thumbs.length > 0 && (
                <span className={`iz-mfill__fan iz-mfill__fan--${thumbs.length}`} aria-hidden="true">
                  {thumbs.map(t => (
                    <span key={t.slug} className="iz-mfill__thumb">
                      <SmartImage src={t.image} alt="" sizes="160px" widths={[160, 320]} width={240} />
                    </span>
                  ))}
                </span>
              )}
              <span className="iz-mfill__foot">
                <span className="iz-mfill__label">Lihat semua produk</span>
                <span className="iz-arrow">
                  <ArrowRight />
                </span>
              </span>
            </Link>
          </div>
        );
      })}
    </>
  );
}
