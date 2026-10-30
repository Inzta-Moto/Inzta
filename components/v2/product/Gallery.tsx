'use client';

import { useRef, type KeyboardEvent } from 'react';
import SmartImage from '@/components/v2/ui/SmartImage';
import { CameraIcon } from '@/components/v2/product/product-icons';

// A thumbnail: a photo button, or the dashed placeholder of produk-sisi.dc.html (not interactive, S4.4.1, S4.4.2).
export type GalleryTile =
  | { kind: 'photo'; src: string; label: string; crop?: string | null }
  | { kind: 'placeholder'; text: string; label: string };

/**
 * Gallery of produk-detail.dc.html (F-016 S3.2, S4.4). Thumbnails are buttons with roving tabindex: Left/Right move,
 * Home/End jump, and moving also selects (S3.2.1). The main image is the LCP image (eager, no shimmer, S3.2.3) and is
 * not interactive (S3.2.6). It crossfades only after the visitor switches photos, so the first paint never fades.
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

  return (
    <div className="iz-gallery">
      <div className={`iz-gallery__main${switched ? ' iz-gallery__main--switched' : ''}`}>
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
      </div>
      {tiles.length > 1 && (
        <div className="iz-thumbs">
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
