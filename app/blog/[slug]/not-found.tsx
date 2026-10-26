import Header from '@/components/Header';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Footer = dynamic(() => import('@/components/Footer'));

// Rendered by notFound() in page.tsx, so a missing article answers 404 instead of 200.
export default function ArticleNotFound() {
  return (
    <>
      <Header active="blog" />
      <section className="section">
        <div className="container">
          <div className="empty-state">
            <p>Artikel tidak ditemukan</p>
            <Link href="/blog" style={{ marginTop: '1rem', display: 'inline-block', color: '#0070f3' }}>Kembali ke Blog</Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
