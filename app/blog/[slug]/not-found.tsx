import Link from 'next/link';
import V2StaticFrame from '@/components/v2/V2StaticFrame';

// Rendered by notFound() in page.tsx, so a missing or draft article answers 404 instead of 200. F-016 S7.9.3: v2 frame
// without data reads, so it renders even when Firestore is down.
export default function ArticleNotFound() {
  return (
    <V2StaticFrame current="artikel">
      <section className="iz-state">
        <div className="iz-wrap">
          <h1 className="t-h1-shop">Artikel tidak ditemukan</h1>
          <div className="iz-row">
            <Link className="iz-btn iz-btn--primary" href="/blog">Lihat semua artikel</Link>
          </div>
        </div>
      </section>
    </V2StaticFrame>
  );
}
