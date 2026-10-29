import Link from 'next/link';
import type { PublicArticle } from '@/types';
import { formatDate } from '@/lib/utils';
import { formatOf, publicDate } from '@/lib/article-format';
import { DEFAULT_AUTHOR } from '@/lib/constants';
import { topicLabel } from '@/lib/v2/article-v2';
import SmartImage from '@/components/v2/ui/SmartImage';

type HeadFields = Pick<
  PublicArticle,
  'title' | 'excerpt' | 'author' | 'coverImage' | 'coverAlt' | 'coverCaption' | 'showCover' | 'publishedAt' | 'createdAt' | 'topik' | 'contentFormat' | 'images' | 'imageUrl'
>;

// S7.2.2: the figure is at most 1120 px inside the page padding, so `sizes` follows the rendered width at every BP.
const COVER_SIZES = '(max-width: 767px) calc(100vw - 40px), (max-width: 1167px) calc(100vw - 48px), 1120px';

/**
 * Article head of v2 pages (F-016 S7.1, S7.2; artikel.dc.html:28-34): breadcrumb, topic chip, H1, meta row, lead.
 * On v2 pages this order replaces F-013 12.1/12.3 (C-12). No hooks, so the public page and the preview share it.
 */
export function ArticleHeadV2({ article: a, minutes }: { article: HeadFields; minutes: number }) {
  const topic = topicLabel(a.topik);
  const date = publicDate(a);
  const lead = a.excerpt?.trim();
  return (
    <header style={{ maxWidth: 920, marginInline: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* S7.1.1: the topic is plain text and the article title is not repeated here. */}
      <nav className="iz-crumb" aria-label="Breadcrumb">
        <Link href="/">Beranda</Link>
        <span aria-hidden="true">/</span>
        <Link href="/blog">Artikel</Link>
        {topic && (
          <>
            <span aria-hidden="true">/</span>
            <span>{topic}</span>
          </>
        )}
      </nav>
      {topic && <span className="iz-cat-chip">{topic}</span>}
      <h1 className="t-h1-article iz-balance">{a.title}</h1>
      <div className="iz-row" style={{ gap: 12, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <img src="/logo-inzta.png" alt="" width={24} height={28} style={{ height: 28, width: 'auto', flex: 'none' }} />
        {/* S7.2.1: no "Terbit" without a date; reading time is the F-012 helper the editor footer uses. */}
        <span className="iz-meta">
          {a.author?.trim() || DEFAULT_AUTHOR}
          {date !== null && (
            <>
              {' · Terbit: '}
              <time dateTime={new Date(date).toISOString()}>{formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
            </>
          )}
          {` · Waktu baca: ${minutes} menit`}
        </span>
      </div>
      {lead && <p className="t-lead iz-muted">{lead}</p>}
    </header>
  );
}

/**
 * Cover below the head (S7.2.2, artikel.dc.html:36-39), or for plain (legacy) articles the old gallery in the same
 * 16:9 box with nothing cropped (S7.2.5). Renders nothing when there is no image or the cover is switched off.
 */
export function ArticleCover({ article: a }: { article: HeadFields }) {
  if (formatOf(a) !== 'markdown') {
    const images = (a.images?.length ? a.images : a.imageUrl ? [a.imageUrl] : []).filter(Boolean);
    if (images.length === 0) return null;
    return (
      <figure className="iz-figure iz-figure--cover iz-figure--legacy">
        <div className="iz-photo iz-aphoto">
          <SmartImage src={images[0]} alt={`${a.title} - Cover`} priority sizes={COVER_SIZES} widths={[480, 800, 1200, 1600]} width={1200} />
        </div>
        {images.length > 1 && (
          <ul className="iz-athumbs">
            {images.slice(1).map((src, i) => (
              <li key={`${src}-${i}`}>
                <div className="iz-photo iz-aphoto">
                  <SmartImage src={src} alt={`${a.title} - ${i + 2}`} sizes="(max-width: 767px) 30vw, 180px" widths={[200, 400, 600]} width={400} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </figure>
    );
  }
  if (a.showCover === false || !a.coverImage) return null;
  const caption = a.coverCaption?.trim();
  return (
    <figure className="iz-figure iz-figure--cover">
      <div className="iz-photo iz-aphoto">
        <SmartImage src={a.coverImage} alt={a.coverAlt || ''} priority sizes={COVER_SIZES} widths={[480, 800, 1200, 1600]} width={1200} />
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
