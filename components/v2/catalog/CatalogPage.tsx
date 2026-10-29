import { Suspense } from 'react';
import Link from 'next/link';
import EmptyState from '@/components/v2/ui/EmptyState';
import Closing from '@/components/v2/Closing';
import CatalogBody from '@/components/v2/catalog/CatalogBody';
import CatalogQuery from '@/components/v2/catalog/CatalogQuery';
import type { CatalogItem } from '@/components/v2/catalog/filter';

// Without JavaScript the filters cannot apply, so they are hidden and every product stays listed (S2.2.10).
const NOSCRIPT_STYLE = '<style>.iz-filters, .iz-filters__meta > .iz-row { display: none !important; }</style>';

// Katalog of produk.dc.html (F-016 S2). The head and the closing panel are server markup; the filter bar and grid
// are a client island whose Suspense fallback is the full unfiltered grid, so the server HTML lists every product
// name and price (S2.2.8, G-S2). The sections stay direct children of main#isi, as in the canvas (design.md §19).
export default function CatalogPage({ items, waHref }: { items: readonly CatalogItem[]; waHref: string }) {
  const total = items.length;
  return (
    <>
      <section className="iz-wrap" style={{ paddingTop: 128 }}>
        <nav className="iz-crumb" aria-label="Breadcrumb">
          <Link href="/">Beranda</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Produk</span>
        </nav>
        <div className="iz-head" style={{ marginTop: 16, marginBottom: 8 }}>
          <h1 className="t-h1-shop">Semua tas motor INZTA</h1>
          {total > 0 && <p className="t-lead">{total} produk. Tas yang dibuat untuk motor Anda ditandai hijau.</p>}
        </div>
      </section>

      {total > 0 ? (
        <>
          <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_STYLE }} />
          <Suspense fallback={<CatalogBody items={items} waHref={waHref} />}>
            <CatalogQuery items={items} waHref={waHref} />
          </Suspense>
        </>
      ) : (
        <section className="iz-wrap iz-catalog__results">
          <EmptyState title="Belum ada produk." actions={[{ label: 'Chat admin', href: waHref, external: true }]} />
        </section>
      )}

      <Closing waHref={waHref} />
    </>
  );
}
