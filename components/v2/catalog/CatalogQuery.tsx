'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import CatalogBody from '@/components/v2/catalog/CatalogBody';
import { parseQuery, writeQuery, type CatalogItem, type FilterState } from '@/components/v2/catalog/filter';

// Reads the applied filters from the URL on the client only (S2.2.8), so /produk stays a static ISR page; it must
// sit inside <Suspense>. Applying replaces the URL without a history entry or scroll (S2.2.2). Next 14.1+ syncs
// window.history.replaceState with useSearchParams, which avoids the server round trip and the route's loading.tsx
// that router.replace would trigger for a new search string. Back/forward restore the state from the URL.
export default function CatalogQuery({ items, waHref }: { items: readonly CatalogItem[]; waHref: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const search = params.toString();
  const state = useMemo(() => parseQuery(new URLSearchParams(search)), [search]);

  const onApply = useCallback(
    (next: FilterState) => {
      const q = writeQuery(search, next);
      window.history.replaceState(null, '', q ? `${pathname}?${q}` : pathname);
    },
    [search, pathname],
  );

  return <CatalogBody items={items} state={state} search={search} waHref={waHref} onApply={onApply} />;
}
