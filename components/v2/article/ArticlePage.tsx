import type { ArticleCardV2, ArticleEmbeds, MotorCategory, ProductEmbed, PublicArticle, RenderBlock } from '@/types';
import type { MotorArticleV2 } from '@/lib/v2/article-v2';
import ArticleBody from '@/components/ArticleBody';
import { formatOf } from '@/lib/article-format';
import { ArticleCover, ArticleHeadV2 } from './ArticleHeadV2';
import Toc, { type TocHeading } from './Toc';
import ShareRow from './ShareRow';
import ReadingProgress from './ReadingProgress';
import ReadingLeft from './ReadingLeft';
import RailProducts, { railProducts } from './RailProducts';
import { MotorArticles, RailHelp } from './MotorRail';
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
// HTML is never changed (S7.3.7). F-017 (KS-01): lib/markdown.ts writes the bagian- ids.
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
 *
 * F-017: three columns from 1200 px (v2-article.css): the head and the cover over the reading column; on the left the
 * "Daftar isi", the time left, and share icons; on the right the products the body names, articles for the visitor's
 * motor, and a "Chat admin" card. Below 1200 px the right rail moves under the body, below 768 px everything is one
 * column. The reading line sits on the navbar (ReadingProgress).
 */
export default function ArticlePage({
  article,
  blocks,
  embeds,
  minutes,
  others,
  motorPicks = [],
  motorProducts = {},
  shareUrl,
  adminPreview = false,
  previewBanner = false,
}: {
  article: Omit<PublicArticle, 'content'>;
  blocks: RenderBlock[];
  embeds: ArticleEmbeds;
  minutes: number;
  others: ArticleCardV2[];
  // F-017: tagged articles and bags per motor category for the "Untuk motor <kategori>" box.
  motorPicks?: MotorArticleV2[];
  motorProducts?: Partial<Record<MotorCategory, ProductEmbed[]>>;
  // null on the preview: the row would share an admin URL or a draft that answers 404 (S7.5.4).
  shareUrl: string | null;
  adminPreview?: boolean;
  previewBanner?: boolean;
}) {
  const isMarkdown = formatOf(article) === 'markdown';
  const headings = isMarkdown ? tocHeadings(blocks) : [];
  const withToc = headings.length >= 2;
  const products = railProducts(blocks, embeds);
  const waHref = `https://wa.me/${WA_NUMBER}`;
  return (
    <>
      <ReadingProgress />
      <div className="iz-article iz-article--page">
        <div className="iz-article__head">
          {previewBanner && (
            <p className="iz-preview-banner" role="status">Pratinjau, belum tayang. Halaman ini hanya terlihat oleh admin.</p>
          )}
          <ArticleHeadV2 article={article} minutes={minutes} />
          <ArticleCover article={article} />
        </div>
        <aside className="iz-article__left" aria-label="Navigasi artikel">
          {withToc && <Toc headings={headings} />}
          <ReadingLeft minutes={minutes} />
          {shareUrl && <ShareRow title={article.title} excerpt={article.excerpt ?? ''} url={shareUrl} variant="icons" />}
        </aside>
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
        <aside className="iz-article__right" aria-label="Rekomendasi">
          <RailProducts products={products} />
          <MotorArticles items={motorPicks} products={motorProducts} />
          <RailHelp waHref={waHref} />
        </aside>
      </div>
      <OtherArticles cards={others} />
      <div>
        <Closing waHref={waHref} />
      </div>
    </>
  );
}
