import type { Metadata } from 'next';
import Link from 'next/link';
import V2StaticFrame from '@/components/v2/V2StaticFrame';

// F-005 6.6: rendered by notFound() in [slug]/layout.tsx, so an unknown product answers 404 instead of 200.
// It lives one level up because a segment's own not-found does not catch its layout.
// F-016 S0.11.3: same v2 frame and markup as app/not-found.tsx, with the product wording.
export const metadata: Metadata = {
  title: 'Produk tidak ditemukan',
  robots: { index: false },
};

export default function ProductNotFound() {
  return (
    <V2StaticFrame current="produk">
      <section className="iz-state">
        <div className="iz-wrap">
          <h1 className="t-h1-shop">Produk tidak ditemukan</h1>
          <p>Produk yang Anda cari tidak ada atau sudah dipindah.</p>
          <div className="iz-row">
            <Link className="iz-btn iz-btn--primary" href="/produk">Lihat produk</Link>
            <Link className="iz-btn iz-btn--secondary" href="/">Ke Beranda</Link>
          </div>
        </div>
      </section>
    </V2StaticFrame>
  );
}
