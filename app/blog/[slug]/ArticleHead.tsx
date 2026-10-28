import type { PublicArticle } from '@/types';
import { formatDate, optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';
import { publicDate } from '@/lib/article-format';
import { DEFAULT_AUTHOR } from '@/lib/article-input';

type HeadFields = Pick<
  PublicArticle,
  'title' | 'excerpt' | 'author' | 'coverImage' | 'coverAlt' | 'coverCaption' | 'showCover' | 'publishedAt' | 'createdAt'
>;

// F-013 phase A2: head of a Markdown article, in the order of the naskah PDF (title, subtitle, byline,
// cover + credit). No hooks, so /blog/{slug}, /admin/pratinjau/{slug}, and the editor's Pratinjau tab
// render the same markup (requirement 16.1). Plain articles keep their own head (P-4).
export default function ArticleHead({ article: a }: { article: HeadFields }) {
  const date = publicDate(a);
  const subtitle = a.excerpt?.trim();
  const caption = a.coverCaption?.trim();
  return (
    <div className="blog-detail-header">
      <h1 className="blog-detail-title">{a.title}</h1>
      {subtitle && <p className="blog-detail-subtitle">{subtitle}</p>}
      <p className="blog-detail-byline">
        Oleh {a.author?.trim() || DEFAULT_AUTHOR}
        {date !== null && (
          <>
            {' · '}
            <time dateTime={new Date(date).toISOString()}>{formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
          </>
        )}
      </p>
      {a.showCover !== false && a.coverImage && (
        <figure className="blog-detail-cover">
          {/* Largest element on the first screen, so never lazy. The 16:9 box reserves its space (H-1, H-8). */}
          <img
            src={optimizeCloudinaryUrl(a.coverImage, 800)}
            srcSet={generateCloudinarySrcSet(a.coverImage, [480, 800, 1200, 1600])}
            sizes="(max-width: 767px) calc(100vw - 48px), 45.5rem"
            alt={a.coverAlt || ''}
          />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      )}
    </div>
  );
}
