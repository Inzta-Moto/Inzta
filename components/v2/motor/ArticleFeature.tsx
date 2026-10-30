import Link from 'next/link';
import { cldWebp } from '@/lib/v2/image';
import SmartImage from '@/components/v2/ui/SmartImage';
import type { CategoryArticle } from '@/components/v2/motor/motor-page';

// "Baca sebelum memilih." (S5.6): the newest per-motor article of this category. The whole card is one link, so
// "Baca panduan" is drawn as a button but rendered as a span (no nested interactive element). Alts follow S5.6
// (cover alt, product names on the thumbnails).
export default function ArticleFeature({ article }: { article: CategoryArticle }) {
  const { slug, title, cover, coverAlt, meta, topics, thumbs } = article;
  return (
    <section className="iz-section iz-wrap" style={{ paddingBottom: 0 }}>
      <div className="iz-head">
        <h2 className="t-h2-landing">Baca sebelum memilih.</h2>
      </div>
      <Link className="iz-afeature" href={`/blog/${slug}`}>
        <div className="iz-photo">
          {cover ? (
            <SmartImage src={cover} alt={coverAlt} sizes="(max-width: 767px) 100vw, 680px" widths={[400, 700, 1000, 1400]} width={1000} fallbackLabel="Foto artikel" />
          ) : (
            <span className="iz-fallback">
              <span className="iz-placeholder">Foto belum tersedia</span>
            </span>
          )}
        </div>
        <div className="iz-afeature__body">
          <div className="iz-row" style={{ gap: 10 }}>
            <span className="iz-cat-chip">Per motor</span>
            <span className="iz-meta">{meta}</span>
          </div>
          <h3 className="t-h2-shop iz-afeature__title">{title}</h3>
          {topics.length > 0 && (
            <div className="iz-afeature__topics">
              <span className="iz-afeature__label">Yang dibahas</span>
              <ul>
                {topics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {thumbs.length > 0 && (
            <div>
              <span className="iz-afeature__label">Tas yang dibahas</span>
              <div className="iz-afeature__thumbs">
                {thumbs.map(t => (
                  <img key={t.slug} src={cldWebp(t.image, 160, 160)} alt={t.name} width={64} height={64} loading="lazy" decoding="async" />
                ))}
              </div>
            </div>
          )}
          <span className="iz-btn iz-btn--secondary">Baca panduan</span>
        </div>
      </Link>
    </section>
  );
}
