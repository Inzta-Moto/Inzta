import type { ArticleCardV2, ArticleEmbeds, PublicArticle, RenderBlock } from '@/types';
import ArticleBody from '@/components/ArticleBody';
import { formatOf } from '@/lib/article-format';
import { ArticleCover, ArticleHeadV2 } from './ArticleHeadV2';
import Toc, { type TocHeading } from './Toc';
import ShareRow from './ShareRow';
import ReadingProgress from './ReadingProgress';
import OtherArticles from './OtherArticles';
import Closing from '@/components/v2/Closing';
import { WA_NUMBER } from '@/lib/constants';

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// S7.3.1/S7.3.2: TOC entries are body h2 that already carry a bagian- id in the sanitized HTML. Read only, the block
// HTML is never changed (S7.3.7). Empty until the KS-01 renderer change lands, so the TOC stays hidden.
export function tocHeadings(blocks: RenderBlock[]): TocHeading[] {
  const out: TocHeading[] = [];
  for (const b of blocks) {
    if (b.type !== 'html') continue;
    for (const m of b.html.matchAll(/<h2\b[^>]*\bid="(bagian-[a-z0-9]+(?:-[a-z0-9]+)*)"[^>]*>([\s\S]*?)<\/h2>/g)) {
      out.push({ id: m[1], text: decode(m[2].replace(/<[^>]*>/g, '')).trim() });
    }
  }
  return out;
}

/**
 * Article page of v2 (F-016 S7, artikel.dc.html), shared by /blog/[slug] and /admin/pratinjau/[slug] (S7.8.2).
 * The body is components/ArticleBody.tsx unchanged, with the className BlogDetailClient passes (S7.3.7); the restyle
 * is CSS only (app/(v2)/v2-article-body.css). Client islands receive primitives only (S7.9.2).
 */
export default function ArticlePage({
  article,
  blocks,
  embeds,
  minutes,
  others,
  shareUrl,
  adminPreview = false,
  previewBanner = false,
}: {
  article: Omit<PublicArticle, 'content'>;
  blocks: RenderBlock[];
  embeds: ArticleEmbeds;
  minutes: number;
  others: ArticleCardV2[];
  // null on the preview: the row would share an admin URL or a draft that answers 404 (S7.5.4).
  shareUrl: string | null;
  adminPreview?: boolean;
  previewBanner?: boolean;
}) {
  const isMarkdown = formatOf(article) === 'markdown';
  const headings = isMarkdown ? tocHeadings(blocks) : [];
  const withToc = headings.length >= 2;
  return (
    <>
      <ReadingProgress />
      <div className="iz-wrap" style={{ paddingTop: 128 }}>
        {previewBanner && (
          <p className="iz-preview-banner" role="status">Pratinjau, belum tayang. Halaman ini hanya terlihat oleh admin.</p>
        )}
        <ArticleHeadV2 article={article} minutes={minutes} />
      </div>
      <ArticleCover article={article} />
      <div className={`iz-article iz-article--page${withToc ? '' : ' iz-article--solo'}`}>
        {withToc && <Toc headings={headings} />}
        <div className="iz-article__col">
          <div className="iz-article__text" data-article-body="">
            <ArticleBody
              blocks={blocks}
              embeds={embeds}
              className={`blog-detail-content article-body${isMarkdown ? '' : ' article-body-plain'}`}
              adminPreview={adminPreview}
            />
          </div>
          {shareUrl && <ShareRow title={article.title} excerpt={article.excerpt ?? ''} url={shareUrl} />}
        </div>
      </div>
      <OtherArticles cards={others} />
      <div style={{ marginTop: 72 }}>
        <Closing waHref={`https://wa.me/${WA_NUMBER}`} />
      </div>
    </>
  );
}
