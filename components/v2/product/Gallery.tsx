'use client';

import { useEffect, useRef, type KeyboardEvent, type TouchEvent } from 'react';
import SmartImage from '@/components/v2/ui/SmartImage';
import { CameraIcon } from '@/components/v2/product/product-icons';
import { ChevronLeft, ChevronRight } from '@/components/v2/icons';
import { photoPosition, stepPhoto, swipeDirection, thumbScrollLeft } from '@/lib/product-images';
import { motionOn } from '@/lib/v2/motion/runtime';

// A thumbnail: a photo button, or the dashed placeholder of produk-sisi.dc.html (not interactive, S4.4.1, S4.4.2).
export type GalleryTile =
  | { kind: 'photo'; src: string; label: string; crop?: string | null }
  | { kind: 'placeholder'; text: string; label: string };

/**
 * Gallery of produk-detail.dc.html (F-016 S3.2, S4.4). Thumbnails are buttons with roving tabindex: Left/Right move,
 * Home/End jump, and moving also selects (S3.2.1). The main image is the LCP image (eager, no shimmer, S3.2.3) and is
 * not a link or zoom (S3.2.6). It crossfades only after the visitor switches photos, so the first paint never fades.
 * F-022 (up to 10 product photos): a "3/10" counter on the main photo, previous/next buttons (JavaScript only) and a
 * horizontal swipe on the main photo step through the photos and wrap around, and the active thumbnail is scrolled
 * into view, so photos beyond the visible thumbnails are never hidden.
 */
export default function Gallery({
  tiles,
  active,
  onSelect,
  name,
  positionLabel,
  switched,
}: {
  tiles: GalleryTile[];
  active: number;
  onSelect: (index: number) => void;
  name: string;
  positionLabel: string | null;
  switched: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const photos = tiles.map((t, i) => (t.kind === 'photo' ? i : -1)).filter(i => i >= 0);
  const main = tiles[active]?.kind === 'photo' ? (tiles[active] as Extract<GalleryTile, { kind: 'photo' }>) : null;
  const first = tiles.find((t): t is Extract<GalleryTile, { kind: 'photo' }> => t.kind === 'photo') ?? null;
  const shown = main ?? first;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const at = photos.indexOf(index);
    let next = -1;
    if (e.key === 'ArrowRight') next = photos[Math.min(photos.length - 1, at + 1)];
    else if (e.key === 'ArrowLeft') next = photos[Math.max(0, at - 1)];
    else if (e.key === 'Home') next = photos[0];
    else if (e.key === 'End') next = photos[photos.length - 1];
    if (next === -1 || next === undefined) return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };

  // The tabbable thumbnail is the active one, or the first photo while a placeholder or nothing is active.
  const tabStop = photos.includes(active) ? active : photos[0];
  const position = photoPosition(photos, photos.includes(active) ? active : photos[0] ?? -1);
  const many = photos.length > 1;

  const step = (dir: -1 | 1) => {
    const next = stepPhoto(photos, active, dir);
    if (next >= 0 && next !== active) onSelect(next);
  };

  // Keeps the active thumbnail visible in the strip (variant pick, arrows, swipe, keyboard), without moving the page.
  useEffect(() => {
    const strip = stripRef.current;
    const thumb = refs.current[active];
    if (!strip || !thumb) return;
    const s = strip.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    const left = thumbScrollLeft({ scrollLeft: strip.scrollLeft, clientWidth: strip.clientWidth }, { left: t.left - s.left + strip.scrollLeft, width: t.width });
    if (left === null) return;
    if (typeof strip.scrollTo === 'function') strip.scrollTo({ left, behavior: motionOn() ? 'smooth' : 'auto' });
    else strip.scrollLeft = left;
  }, [active]);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const p = e.touches[0];
    touch.current = e.touches.length === 1 && p ? { x: p.clientX, y: p.clientY } : null;
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touch.current;
    touch.current = null;
    const p = e.changedTouches[0];
    if (!start || !p) return;
    const dir = swipeDirection(p.clientX - start.x, p.clientY - start.y);
    if (dir) step(dir === 'next' ? 1 : -1);
  };

  return (
    <div className="iz-gallery">
      <div
        className={`iz-gallery__main${switched ? ' iz-gallery__main--switched' : ''}`}
        onTouchStart={many ? onTouchStart : undefined}
        onTouchEnd={many ? onTouchEnd : undefined}
      >
        {shown ? (
          <SmartImage
            key={shown.src}
            src={shown.src}
            alt={name}
            priority
            width={900}
            widths={[600, 900, 1200]}
            sizes="(max-width: 767px) 100vw, 58vw"
            imgClassName={shown.crop ?? undefined}
            fallbackLabel="Foto produk"
          />
        ) : (
          <span className="iz-gallery__noimg">
            <span className="iz-for iz-placeholder">Foto belum tersedia</span>
          </span>
        )}
        {positionLabel && <span className="iz-pcard__pos">{positionLabel}</span>}
        {many && position && (
          <span className="iz-gallery__count" aria-hidden="true">
            {position.index}/{position.total}
          </span>
        )}
        {/* Review REV-04: announces the photo after a switch; empty on the server and on load, so no hydration change. */}
        {many && (
          <span className="iz-gallery__live" aria-live="polite">
            {switched && position ? `Foto ${position.index} dari ${position.total}` : ''}
          </span>
        )}
        {many && (
          <div className="iz-gallery__nav iz-js-only">
            <button className="iz-iconbtn iz-gallery__step iz-gallery__step--prev" type="button" aria-label="Foto sebelumnya" onClick={() => step(-1)}>
              <ChevronLeft />
            </button>
            <button className="iz-iconbtn iz-gallery__step iz-gallery__step--next" type="button" aria-label="Foto berikutnya" onClick={() => step(1)}>
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
      {tiles.length > 1 && (
        <div className="iz-thumbs" ref={stripRef}>
          {tiles.map((t, i) =>
            t.kind === 'photo' ? (
              <button
                key={`${i}-${t.src}`}
                ref={el => {
                  refs.current[i] = el;
                }}
                className="iz-thumb"
                type="button"
                aria-label={t.label}
                aria-current={i === active ? 'true' : undefined}
                tabIndex={i === tabStop ? 0 : -1}
                onClick={() => onSelect(i)}
                onKeyDown={e => onKey(e, i)}
              >
                <SmartImage src={t.src} alt="" width={200} widths={[150, 300]} sizes="120px" imgClassName={t.crop ?? undefined} />
              </button>
            ) : (
              <span key={`${i}-${t.text}`} className="iz-thumb iz-thumb--placeholder" role="img" aria-label={t.label}>
                <span className="iz-thumb__ph" aria-hidden="true">
                  <CameraIcon />
                  {t.text}
                </span>
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
