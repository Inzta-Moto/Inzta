'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CatalogBody from '@/components/v2/catalog/CatalogBody';
import { changeView, readView, syncView, writeQuery, type CatalogItem, type CatalogView, type FilterChange } from '@/components/v2/catalog/filter';

// Owns the applied filters (F-016 S2.2). The URL stays the source of truth for sharing, reloads, and back/forward,
// but the page does not wait for it: a change is applied to the latest local state at once (a ref, so two quick
// ticks never start from the same stale state) and then written with window.history.replaceState, without a history
// entry or scroll (S2.2.2). Next 14.1+ syncs replaceState with useSearchParams, which avoids the server round trip and
// the route's loading.tsx that router.replace would trigger. The query is read on the client only (S2.2.8), so
// /produk stays a static ISR page; this component must sit inside <Suspense>. The decisions live in filter.ts
// (changeView, syncView) so tests/f016-catalog.cjs can replay write and re-sync sequences without a DOM.
export default function CatalogQuery({ items, waHref }: { items: readonly CatalogItem[]; waHref: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const search = params.toString();
  const [view, setView] = useState<CatalogView>(() => readView(params));
  const viewRef = useRef(view);

  useEffect(() => {
    const next = syncView(viewRef.current, search, window.location.search);
    if (!next) return;
    viewRef.current = next;
    setView(next);
  }, [search]);

  const write = useCallback(
    (next: CatalogView) => {
      viewRef.current = next;
      setView(next);
      const q = writeQuery(window.location.search, next.state, next.shown);
      window.history.replaceState(null, '', q ? `${pathname}?${q}` : pathname);
    },
    [pathname],
  );

  const onApply = useCallback(
    (change: FilterChange) => {
      const next = changeView(viewRef.current, change);
      if (!next) return false;
      write(next);
      return true;
    },
    [write],
  );

  const onMore = useCallback((shown: number) => write({ state: viewRef.current.state, shown }), [write]);

  return (
    <CatalogBody items={items} state={view.state} shown={view.shown} search={search} waHref={waHref} onApply={onApply} onMore={onMore} />
  );
}
