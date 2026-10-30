import type { Metadata } from 'next';
import Link from 'next/link';
import V2StaticFrame from '@/components/v2/V2StaticFrame';

export const metadata: Metadata = {
  title: 'Halaman tidak ditemukan', // F-005 6.2: the root layout template adds " | INZTA Moto"
  robots: { index: false },
};

// F-016 S0.11.1, S0.11.3: unknown routes, products, and categories answer 404 inside the v2 frame.
export default function NotFound() {
  return (
    <V2StaticFrame>
      <section className="iz-state">
        <div className="iz-wrap">
          <h1 className="t-h1-shop">Halaman tidak ditemukan</h1>
          <p>Halaman yang Anda cari tidak ada atau sudah dipindah.</p>
          <div className="iz-row">
            <Link className="iz-btn iz-btn--primary" href="/">Ke Beranda</Link>
            <Link className="iz-btn iz-btn--secondary" href="/produk">Lihat produk</Link>
          </div>
        </div>
      </section>
    </V2StaticFrame>
  );
}
