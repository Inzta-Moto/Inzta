import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import '@/app/(v2)/v2-article.css';
import '@/app/(v2)/v2-article-body.css';
import V2Layout from '@/components/v2/V2Layout';
import ArticlePage from '@/components/v2/article/ArticlePage';
import { requireAdmin } from '@/lib/auth';
import { getArticleForAdmin } from '@/lib/admin-articles';
import { renderArticle } from '@/lib/markdown';
import { resolveEmbeds, shownArticleSlugs } from '@/lib/article-embeds';
import { statusOf } from '@/lib/article-format';
import { getArticles } from '@/lib/public-content';
import { OTHER_ARTICLES_MAX, articleReadingMinutes, motorArticles, otherArticles } from '@/lib/v2/article-v2';

// Stored article (draft or published) in the public layout, for admins only. Never cached and never
// indexed: a draft must not reach a CDN or a search engine through this page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pratinjau artikel — Admin INZTA',
  robots: { index: false, follow: false },
};

export default async function AdminArticlePreviewPage({ params }: { params: { slug: string } }) {
  // The middleware only checks that a cookie exists; this checks that it belongs to an admin.
  const auth = await requireAdmin();
  if (!auth.ok) redirect('/admin/login');

  const article = await getArticleForAdmin(params.slug);
  if (!article) notFound();

  const { blocks } = renderArticle(article);
  // Same cards as the public page would show (published articles and active products only).
  const embeds = await resolveEmbeds(blocks, { exclude: article.slug });
  const { content, ...rest } = article;
  // F-016 S7.8: same v2 frame and ArticlePage as /blog/{slug}, all blocks with the missing-card notes, no share row,
  // and "Artikel lain" from published articles only (S7.8.4).
  const published = await getArticles();
  const others = otherArticles(article, published, OTHER_ARTICLES_MAX, shownArticleSlugs(blocks, embeds));
  return (
    <V2Layout current="artikel">
      <ArticlePage
        article={rest}
        blocks={blocks}
        embeds={embeds}
        minutes={articleReadingMinutes(content)}
        others={others}
        motorPicks={motorArticles(article, published)}
        shareUrl={null}
        adminPreview
        previewBanner={statusOf(article) !== 'published'}
      />
    </V2Layout>
  );
}
