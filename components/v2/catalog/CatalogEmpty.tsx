'use client';

import { Bag } from '@/components/v2/icons';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import type { EmptyCopy, Nearest } from '@/components/v2/catalog/filter';

const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1279px) 25vw, 300px';

// Empty result of the Katalog (S2.6.1). Same .iz-empty look as the shared EmptyState, which stays untouched because
// S5 and S6 use it; this one needs buttons that change the filter in place (no new history entry) and a row of the
// nearest products, so the visitor is never left with nothing to tap.
export default function CatalogEmpty({
  copy,
  nearest,
  waHref,
  onRelax,
  onClearAll,
  onNearest,
}: {
  copy: EmptyCopy;
  nearest: Nearest | null;
  waHref: string;
  onRelax: () => void;
  onClearAll: () => void;
  onNearest: () => void;
}) {
  return (
    <>
      <div className="iz-empty">
        <span className="iz-empty__ico" aria-hidden="true">
          <Bag width={28} height={28} />
        </span>
        <h2 className="iz-empty__title">{copy.title}</h2>
        {copy.text && <p className="iz-empty__text">{copy.text}</p>}
        <div className="iz-row">
          {copy.relaxLabel && (
            <button className="iz-btn iz-btn--primary" type="button" onClick={onRelax}>
              {copy.relaxLabel}
            </button>
          )}
          {/* Primary when no single removal brings products back (relaxLabel null), so the first button never leads to
              a second empty state. */}
          {copy.showClearAll && (
            <button className={`iz-btn ${copy.relaxLabel ? 'iz-btn--secondary' : 'iz-btn--primary'}`} type="button" onClick={onClearAll}>
              Hapus semua filter
            </button>
          )}
        </div>
        <a className="iz-link" href={waHref} target="_blank" rel="noopener noreferrer">
          Chat admin
        </a>
      </div>
      {nearest && (
        <div className="iz-catalog__near">
          <h2 className="iz-catalog__near-title">{nearest.heading}</h2>
          <div className="iz-grid-4">
            {nearest.items.map(it => (
              <ProductCardV2 key={it.card.slug} card={it.card} headingLevel={3} sizes={GRID_SIZES} />
            ))}
          </div>
          <button className="iz-link" type="button" onClick={onNearest}>
            {`Lihat ${nearest.total} produk`}
          </button>
        </div>
      )}
    </>
  );
}
