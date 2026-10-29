import Header from '@/components/Header';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Footer = dynamic(() => import('@/components/Footer'));

// F-005 6.6: rendered by notFound() in [slug]/layout.tsx, so an unknown product answers 404 instead of 200.
// It lives one level up because a segment's own not-found does not catch its layout.
// Same markup as the error branch of DetailClient.
export default function ProductNotFound() {
  return (
    <>
      <Header active="produk" />
      {/* Same top spacing as a product page, below the fixed header. */}
      <section className="detail-page-header" />
      <section className="detail-section">
        <div className="container">
          <div className="empty-state">
            <p>Produk tidak ditemukan</p>
            <Link href="/produk" style={{ marginTop: '1rem', display: 'inline-block', color: '#0070f3' }}>Kembali ke halaman produk</Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
