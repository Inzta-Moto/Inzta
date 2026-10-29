import Link from 'next/link';
import type { HomeGuideCard } from '@/types';
import { formatShortDate } from '@/lib/v2/home-data';
import { generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';
import { ArrowRight } from '@/components/v2/icons';

// Same pattern as the design's "Foto produk: PLACEHOLDER" tile (design.md 4, inventory P-14).
function EmptyPhoto() {
  return (
    <div className="iz-photo iz-photo--empty">
      <span className="iz-for iz-placeholder">Foto artikel: PLACEHOLDER</span>
    </div>
  );
}

// Card images get alt="" because the h3 in the same link already names the article (D-9, 20.5).
function Feature({ guide, wide }: { guide: HomeGuideCard; wide: boolean }) {
  const srcSet = guide.image ? generateCloudinarySrcSet(guide.image, [480, 800, 1200]) : '';
  return (
    <Link className="iz-gfeature" href={`/blog/${guide.slug}`}>
      {guide.image ? (
        <img
          src={optimizeCloudinaryUrl(guide.image, 1200)}
          srcSet={srcSet || undefined}
          sizes={wide ? '(max-width: 1280px) 100vw, 1200px' : '(max-width: 767px) 100vw, 58vw'}
          alt=""
          width={1200}
          height={800}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <EmptyPhoto />
      )}
      {guide.credit && <span className="iz-tag" aria-hidden="true">{guide.credit}</span>}
      {guide.chip && <span className="iz-cat-chip">{guide.chip}</span>}
      <h3>{guide.title}</h3>
      <div className="iz-gmeta">
        <span>
          {guide.author}
          {guide.date !== null && (
            <>
              {' · '}
              <span className="iz-nowrap">{formatShortDate(guide.date)}</span>
            </>
          )}
        </span>
        <span className="iz-link">
          Baca catatan <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

// Side cards keep the design exactly: chip, title, "Baca panduan", no author or date (D-7).
function Row({ guide }: { guide: HomeGuideCard }) {
  return (
    <Link className="iz-grow" href={`/blog/${guide.slug}`}>
      {guide.image ? (
        <div className="iz-photo">
          <img src={optimizeCloudinaryUrl(guide.image, 352, 352)} alt="" width={176} height={176} loading="lazy" decoding="async" />
          {guide.credit && <span className="iz-tag" aria-hidden="true">{guide.credit}</span>}
        </div>
      ) : (
        <EmptyPhoto />
      )}
      <div className="iz-grow__body">
        {guide.chip && <span className="iz-cat-chip">{guide.chip}</span>}
        <h3>{guide.title}</h3>
        <span className="iz-link">
          Baca panduan <ArrowRight size={18} />
        </span>
      </div>
    </Link>
  );
}

// "Sebelum memilih, baca ini dulu." (F-016 12): newest published articles, the newest one featured.
export default function Guides({ guides }: { guides: HomeGuideCard[] }) {
  if (guides.length === 0) return null;
  const [first, ...rest] = guides;
  const side = rest.slice(0, 2);
  // With one article the side column is dropped so no empty box remains (12.4).
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div>
            <span className="iz-eyebrow">Panduan rider</span>
            <h2 className="t-h2-landing">Sebelum memilih, baca ini dulu.</h2>
          </div>
          <Link className="iz-link" href="/blog">
            Semua artikel <ArrowRight size={18} />
          </Link>
        </div>
        <div className={side.length === 0 ? 'iz-guides iz-guides--single' : 'iz-guides'}>
          <Feature guide={first} wide={side.length === 0} />
          {side.length > 0 && (
            <div className="iz-guides__side">
              {side.map(g => (
                <Row key={g.slug} guide={g} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
