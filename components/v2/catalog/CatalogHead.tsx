import type { ReactNode } from 'react';
import Link from 'next/link';

// Breadcrumb, H1, and lead of the Katalog (S2.1). The client island renders it so the H1 and the one count follow the
// applied filters; CatalogPage renders it for the empty catalogue. Its own section keeps the sections direct children
// of main#isi, as in the canvas (design.md §19). `aside` (the F-019 search) sits right of the heading from 1024 px and
// under the lead below that.
export default function CatalogHead({ title, lead, aside }: { title: string; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="iz-wrap" style={{ paddingTop: 128 }}>
      <nav className="iz-crumb" aria-label="Breadcrumb">
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Produk</span>
      </nav>
      <div className="iz-catalog__headrow">
        <div className="iz-head">
          <h1 className="t-h1-shop">{title}</h1>
          {lead && <p className="t-lead">{lead}</p>}
        </div>
        {aside}
      </div>
    </section>
  );
}
