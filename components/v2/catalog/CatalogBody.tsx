'use client';

import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import { Close } from '@/components/v2/icons';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { categoryLabel } from '@/lib/v2/home-content';
import { jumpTo } from '@/lib/v2/motion/runtime';
import CatalogHead from '@/components/v2/catalog/CatalogHead';
import CatalogEmpty from '@/components/v2/catalog/CatalogEmpty';
import FilterBar from '@/components/v2/catalog/FilterBar';
import FilterSheet from '@/components/v2/catalog/FilterSheet';
import HelpCard from '@/components/v2/catalog/HelpCard';
import type { FieldGroup } from '@/components/v2/catalog/FilterFields';
import {
  DEFAULT_STATE,
  PAGE_SIZE,
  activeChips,
  applyCatalog,
  availability,
  LEAD_MOTOR_NOTE,
  catalogHeading,
  emptyCopy,
  facetCounts,
  helpCardIndex,
  nearestItems,
  relaxGroup,
  resultStatus,
  selectionKeys,
  stateKey,
  writeQuery,
  type CatalogItem,
  type FilterChange,
  type FilterState,
  type KeptSelection,
} from '@/components/v2/catalog/filter';

// Grid columns: 4 from 768 px, 2 below (bundle.css .iz-grid-4); the content column is at most 1280 px.
const GRID_SIZES = '(max-width: 767px) 50vw, (max-width: 1279px) 25vw, 300px';

type PendingFocus = { kind: 'chip'; index: number } | { kind: 'posisi' } | { kind: 'card'; index: number } | null;

const noSubscribe = () => () => {};

// Head, filter bar, active filters, and grid of the Katalog (S2.1–S2.6). Rendered twice: as the Suspense fallback
// without `onApply` (server HTML: every product, no filter applied) and under CatalogQuery with the URL state.
// In server HTML and while hydrating it, every matching card is rendered, so the no-JS page lists them all (S2.5.1,
// S2.5.3); a client render (CatalogQuery replacing the fallback) starts with the first `shown` cards right away,
// instead of mounting the whole catalogue once and then trimming it.
//
// Scale: the option counts (one pass, facetCounts) follow the urgent state so the ticked box and its badge answer at
// once; the grid, H1, and lead follow a deferred copy, so a large grid re-renders without blocking the next tick.
// Nothing here runs on scroll.
export default function CatalogBody({
  items,
  state = DEFAULT_STATE,
  shown: requested = PAGE_SIZE,
  search = '',
  waHref,
  onApply,
  onMore,
}: {
  items: readonly CatalogItem[];
  state?: FilterState;
  // Cards asked for by "Muat lagi" (?tampil=), whole pages of 12.
  shown?: number;
  search?: string;
  waHref: string;
  // Returns false when the change left the state as it was.
  onApply?: (change: FilterChange) => boolean;
  onMore?: (next: number) => void;
}) {
  const { category } = useMotorCategory();
  const categoryText = category ? categoryLabel(category) : null;
  const key = stateKey(state);

  const avail = useMemo(() => availability(items), [items]);
  const facets = useMemo(() => facetCounts(items, state), [items, state]);

  // Values selected at any point since mount, so an option or chip that only shows because it was selected (an old
  // ad link to a label nothing has now) stays put after it is unticked instead of unmounting under focus. The render
  // reads the union with the current state; the effect only stores it.
  const [kept, setKept] = useState<KeptSelection>(() => new Set(selectionKeys(state)));
  const basis = useMemo<KeptSelection>(() => {
    const keys = selectionKeys(state);
    return keys.every(k => kept.has(k)) ? kept : new Set([...kept, ...keys]);
  }, [kept, state]);
  useEffect(() => {
    if (basis !== kept) setKept(basis);
  }, [basis, kept]);

  const view = useDeferredValue(state);
  const viewKey = stateKey(view);
  const result = useMemo(() => applyCatalog(items, view), [items, view]);
  const empty = result.length === 0;
  const relax = useMemo(() => (empty ? relaxGroup(items, view) : null), [empty, items, view]);
  const nearest = useMemo(() => (empty ? nearestItems(items, view, 4) : null), [empty, items, view]);

  // false on the server and during hydration, true in a client render (useSyncExternalStore's server snapshot).
  const live = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [sheet, setSheet] = useState<{ group: FieldGroup | null } | null>(null);
  const [anim, setAnim] = useState<'' | 'a' | 'b'>('');
  const [status, setStatus] = useState('');
  const statusRef = useRef('');
  const sheetOpener = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<PendingFocus>(null);
  const pendingResult = useRef<'filter' | 'more' | null>(null);
  const prevKey = useRef(viewKey);
  const metaRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLElement>(null);
  const statusFrame = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const shown = live ? Math.min(requested, result.length) : result.length;
  const visible = result.slice(0, shown);
  const helpAt = helpCardIndex(visible.length);
  const chips = activeChips(state, categoryLabel);
  const heading = catalogHeading(view, categoryLabel);

  // S2.4.4: restart the 200 ms fade on every result change (two keyframe names, no remount of the images).
  useEffect(() => {
    if (prevKey.current === viewKey) return;
    prevKey.current = viewKey;
    setAnim(a => (a === 'a' ? 'b' : 'a'));
  }, [viewKey]);

  // S2.3.3: focus moves once the new chips are in the DOM (they follow the urgent state).
  useEffect(() => {
    const p = pendingFocus.current;
    if (!p || p.kind === 'card') return;
    pendingFocus.current = null;
    const posisiChip = filtersRef.current?.querySelector<HTMLElement>('[data-fchip="posisi"]');
    if (p.kind === 'chip') {
      const removes = metaRef.current?.querySelectorAll<HTMLElement>('.iz-activechip button') ?? [];
      const next = removes[p.index] ?? (removes.length ? metaRef.current?.querySelector<HTMLElement>('[data-clear]') : null);
      (next ?? posisiChip)?.focus();
      return;
    }
    posisiChip?.focus();
  }, [key]);

  useEffect(() => () => cancelAnimationFrame(statusFrame.current), []);

  // React makes no DOM change for the same string, and screen readers announce only changes, so a repeated message
  // (two changes with the same heading, count, and sort) is cleared first and set again on the next frame.
  const announce = (text: string) => {
    cancelAnimationFrame(statusFrame.current);
    if (text !== statusRef.current) {
      statusRef.current = text;
      setStatus(text);
      return;
    }
    setStatus('');
    statusFrame.current = requestAnimationFrame(() => setStatus(text));
  };

  // Work that waits for the deferred grid to catch up with the applied state: card focus (S2.5.1, empty-state
  // actions), the status line, and keeping the results in view.
  useEffect(() => {
    if (viewKey !== key) return;
    const p = pendingFocus.current;
    if (p?.kind === 'card') {
      pendingFocus.current = null;
      gridRef.current?.querySelectorAll<HTMLElement>(':scope > .iz-pcard')[p.index]?.focus();
    }
    const done = pendingResult.current;
    if (!done) return;
    pendingResult.current = null;
    if (done === 'more') {
      announce(`Menampilkan ${shown} dari ${result.length} produk`);
      return;
    }
    announce(resultStatus(heading, result.length, view.urut));
    // A visitor who had scrolled into the grid would otherwise be left looking at the closing panel after a shorter
    // result: jump, without animation, so the filter bar (it scrolls with the page) sits just under the navbar with
    // the results below it. Never on "Muat lagi".
    const bar = filtersRef.current;
    if (!bar) return;
    const navBottom = window.matchMedia('(max-width: 767px)').matches ? 80 : 96;
    const barTop = bar.getBoundingClientRect().top;
    if (barTop < navBottom) jumpTo(Math.max(0, window.scrollY + barTop - navBottom));
    // `heading`, `result`, and `view` belong to the same render as viewKey, so they are not listed.
  }, [viewKey, key, shown]);

  const apply = (change: FilterChange, focus: PendingFocus = null): boolean => {
    if (!onApply) return false;
    // Set before applying: the state update may render synchronously.
    const prevFocus = pendingFocus.current;
    const prevResult = pendingResult.current;
    pendingFocus.current = focus;
    pendingResult.current = 'filter';
    const changed = onApply(change);
    if (!changed) {
      pendingFocus.current = prevFocus;
      pendingResult.current = prevResult;
    }
    return changed;
  };

  const closeSheet = () => {
    setSheet(null);
    const opener = sheetOpener.current;
    requestAnimationFrame(() => opener?.focus());
  };

  const nextShown = Math.ceil((shown + PAGE_SIZE) / PAGE_SIZE) * PAGE_SIZE;
  const moreQuery = writeQuery(search, view, nextShown);
  const onMoreClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!onMore || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    pendingFocus.current = { kind: 'card', index: shown };
    pendingResult.current = 'more';
    onMore(nextShown);
  };

  return (
    <>
      <CatalogHead
        title={heading}
        lead={
          <>
            {`${result.length} produk.`}
            {/* Always in the markup: CSS shows it once a category is known, from React or from the inline script in
                CatalogPage that reads the stored category before the first paint (no layout shift on phones). */}
            <span className={`iz-lead-motor${category ? ' iz-lead-motor--on' : ''}`}>{` ${LEAD_MOTOR_NOTE}`}</span>
          </>
        }
      />

      <section className="iz-wrap iz-catalog__filters" ref={filtersRef}>
        <FilterBar
          state={state}
          facets={facets}
          avail={avail}
          kept={basis}
          category={category}
          categoryText={categoryText}
          sheetOpen={sheet !== null}
          onChange={change => apply(change)}
          onOpenSheet={(group, opener) => {
            sheetOpener.current = opener;
            setSheet({ group });
          }}
        />
      </section>

      <section className="iz-wrap iz-catalog__results" ref={resultsRef}>
        <div className="iz-filters__meta" style={{ marginBottom: 32 }} ref={metaRef}>
          <div className="iz-row" style={{ gap: 10 }} hidden={chips.length === 0}>
            <span>Filter aktif:</span>
            {chips.map((c, i) => (
              <span key={`${c.group}-${c.value}`} className="iz-activechip">
                {c.label}
                <button
                  type="button"
                  aria-label={`Hapus filter ${c.label}`}
                  onClick={() => apply({ type: 'remove', group: c.group, value: c.value }, { kind: 'chip', index: i })}
                >
                  <Close size={16} />
                </button>
              </span>
            ))}
            <button className="iz-link" type="button" data-clear onClick={() => apply({ type: 'clearAll' }, { kind: 'posisi' })}>
              Hapus semua
            </button>
          </div>
          {/* Empty until the visitor changes something, so nothing is announced on load; the H1 and lead are not live. */}
          <p className="iz-sr" role="status" aria-live="polite">
            {status}
          </p>
        </div>
        {!empty ? (
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
              {shown < result.length && <p className="iz-catalog__progress">{`Menampilkan ${shown} dari ${result.length} produk`}</p>}
              {/* A real link, so a new tab or a page without JavaScript still gets the next page (?tampil=). */}
              <a className="iz-btn iz-btn--secondary" href={`/produk?${moreQuery}`} onClick={onMoreClick}>
                Muat 12 produk lagi
              </a>
            </div>
          </>
        ) : (
          <CatalogEmpty
            copy={emptyCopy(view, relax, categoryLabel)}
            nearest={nearest}
            waHref={waHref}
            onRelax={() => relax && apply({ type: 'clearGroup', group: relax }, { kind: 'card', index: 0 })}
            onClearAll={() => apply({ type: 'clearAll' }, { kind: 'card', index: 0 })}
            onNearest={() => nearest && apply({ type: 'replace', state: nearest.state }, { kind: 'card', index: 0 })}
          />
        )}
      </section>

      {/* Portaled to the page root: inside main the fixed overlay sat under the sticky navbar, which stayed tappable
          above an aria-modal dialog. .iz-page, not body, because the v2 tokens and fonts are scoped to it. */}
      {sheet &&
        createPortal(
          <FilterSheet
            items={items}
            state={state}
            avail={avail}
            kept={basis}
            category={category}
            categoryText={categoryText}
            startGroup={sheet.group}
            onApply={next => {
              closeSheet();
              apply({ type: 'replace', state: next });
            }}
            onClose={closeSheet}
          />,
          filtersRef.current?.closest<HTMLElement>('.iz-page') ?? document.body,
        )}
    </>
  );
}
