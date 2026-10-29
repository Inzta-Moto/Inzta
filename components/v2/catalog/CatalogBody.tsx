'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import EmptyState from '@/components/v2/ui/EmptyState';
import { Close } from '@/components/v2/icons';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { categoryLabel } from '@/lib/v2/home-content';
import FilterBar from '@/components/v2/catalog/FilterBar';
import FilterSheet from '@/components/v2/catalog/FilterSheet';
import HelpCard from '@/components/v2/catalog/HelpCard';
import type { FieldGroup } from '@/components/v2/catalog/FilterFields';
import {
  DEFAULT_STATE,
  PAGE_SIZE,
  activeChips,
  applyCatalog,
  clearFilters,
  helpCardIndex,
  removeValue,
  sameState,
  stateKey,
  writeQuery,
  type CatalogItem,
  type FilterState,
} from '@/components/v2/catalog/filter';

// Grid columns: 4 from 768 px, 2 below (bundle.css .iz-grid-4); the content column is at most 1280 px.
const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1279px) 25vw, 300px';

type PendingFocus = { kind: 'chip'; index: number } | { kind: 'posisi' } | { kind: 'card'; index: number } | null;

// Filter bar, active filters, count, and grid of the Katalog (S2.2–S2.6). Rendered twice: as the Suspense fallback
// without `onApply` (server HTML: every product, no filter applied) and under CatalogQuery with the URL state.
// Before mount every matching card is rendered, so the server HTML and the no-JS page list them all (S2.5.1,
// S2.5.3); after mount only the first 12 show.
export default function CatalogBody({
  items,
  state = DEFAULT_STATE,
  search = '',
  waHref,
  onApply,
}: {
  items: readonly CatalogItem[];
  state?: FilterState;
  search?: string;
  waHref: string;
  onApply?: (next: FilterState) => void;
}) {
  const { category } = useMotorCategory();
  const categoryText = category ? categoryLabel(category) : null;
  const key = stateKey(state);
  const result = useMemo(() => applyCatalog(items, state), [items, state]);

  const [mounted, setMounted] = useState(false);
  const [reveal, setReveal] = useState({ key, n: PAGE_SIZE });
  const [sheet, setSheet] = useState<{ group: FieldGroup | null } | null>(null);
  const [anim, setAnim] = useState<'' | 'a' | 'b'>('');
  const sheetOpener = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<PendingFocus>(null);
  const prevKey = useRef(key);
  const metaRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // S2.5.2: any filter or sort change resets to 12; the stored count belongs to one state key only.
  const limit = reveal.key === key ? reveal.n : PAGE_SIZE;
  const shown = mounted ? Math.min(limit, result.length) : result.length;
  const visible = result.slice(0, shown);
  const helpAt = helpCardIndex(visible.length);
  const chips = activeChips(state, categoryLabel);

  // S2.4.4: restart the 200 ms fade on every result change (two keyframe names, no remount of the images).
  useEffect(() => {
    if (prevKey.current === key) return;
    prevKey.current = key;
    setAnim(a => (a === 'a' ? 'b' : 'a'));
  }, [key]);

  // S2.3.3 and S2.5.1: move focus once the new state or the new cards are in the DOM.
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    if (p.kind === 'card') {
      gridRef.current?.querySelectorAll<HTMLElement>(':scope > .iz-pcard')[p.index]?.focus();
      return;
    }
    const posisiChip = filtersRef.current?.querySelector<HTMLElement>('[data-fchip="posisi"]');
    if (p.kind === 'chip') {
      const removes = metaRef.current?.querySelectorAll<HTMLElement>('.iz-activechip button') ?? [];
      const next = removes[p.index] ?? (removes.length ? metaRef.current?.querySelector<HTMLElement>('[data-clear]') : null);
      (next ?? posisiChip)?.focus();
      return;
    }
    posisiChip?.focus();
  }, [key, shown]);

  const apply = (next: FilterState) => {
    if (!onApply || sameState(next, state)) return;
    onApply(next);
  };

  const clearAll = () => {
    pendingFocus.current = { kind: 'posisi' };
    apply(clearFilters(state));
  };

  const clearQuery = writeQuery(search, clearFilters(state));
  const clearHref = clearQuery ? `/produk?${clearQuery}` : '/produk';

  // EmptyState only renders links; "Hapus semua filter" is handled here so it replaces the URL like every other
  // filter change (S2.2.2) instead of adding a history entry.
  const onEmptyClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.getAttribute('href') !== clearHref || !onApply) return;
    e.preventDefault();
    clearAll();
  };

  const closeSheet = () => {
    setSheet(null);
    const opener = sheetOpener.current;
    requestAnimationFrame(() => opener?.focus());
  };

  return (
    <>
      <section className="iz-wrap" ref={filtersRef}>
        <FilterBar
          items={items}
          state={state}
          category={category}
          categoryText={categoryText}
          sheetOpen={sheet !== null}
          onApply={apply}
          onOpenSheet={(group, opener) => {
            sheetOpener.current = opener;
            setSheet({ group });
          }}
        />
        <div className="iz-filters__meta" style={{ marginBottom: 32 }} ref={metaRef}>
          <div className="iz-row" style={{ gap: 10 }} hidden={chips.length === 0}>
            <span>Filter aktif:</span>
            {chips.map((c, i) => (
              <span key={`${c.group}-${c.value}`} className="iz-activechip">
                {c.label}
                <button
                  type="button"
                  aria-label={`Hapus filter ${c.label}`}
                  onClick={() => {
                    pendingFocus.current = { kind: 'chip', index: i };
                    apply(removeValue(state, c.group, c.value));
                  }}
                >
                  <Close size={16} />
                </button>
              </span>
            ))}
            <button className="iz-link" type="button" data-clear onClick={clearAll}>
              Hapus semua
            </button>
          </div>
          <span aria-live="polite">
            Menampilkan {visible.length} dari {result.length} produk
          </span>
        </div>
      </section>

      <section className="iz-wrap iz-catalog__results">
        {result.length > 0 ? (
          <>
            <div className="iz-grid-4 iz-catalog__grid" ref={gridRef} data-anim={anim || undefined}>
              {visible.map((it, i) => (
                <Fragment key={it.card.slug}>
                  <ProductCardV2 card={it.card} headingLevel={2} sizes={GRID_SIZES} />
                  {/* Only between cards: as the last row it doubled the closing panel right below (Sehan, 2026-10-29). */}
                  {i === helpAt && i < visible.length - 1 && <HelpCard waHref={waHref} />}
                </Fragment>
              ))}
            </div>
            <div className="iz-catalog__more" hidden={shown >= result.length}>
              <button
                className="iz-btn iz-btn--secondary"
                type="button"
                onClick={() => {
                  pendingFocus.current = { kind: 'card', index: shown };
                  setReveal({ key, n: limit + PAGE_SIZE });
                }}
              >
                Muat 12 produk lagi
              </button>
            </div>
          </>
        ) : (
          <div onClickCapture={onEmptyClick}>
            <EmptyState
              title="Tidak ada tas yang sesuai filter."
              actions={[
                { label: 'Hapus semua filter', href: clearHref },
                { label: 'Chat admin', href: waHref, external: true, primary: false },
              ]}
            />
          </div>
        )}
      </section>

      {sheet && (
        <FilterSheet
          items={items}
          state={state}
          category={category}
          categoryText={categoryText}
          startGroup={sheet.group}
          onApply={next => {
            closeSheet();
            apply(next);
          }}
          onClose={closeSheet}
        />
      )}
    </>
  );
}
