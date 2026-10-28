import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import BlogDetailClient from '@/app/blog/[slug]/BlogDetailClient';
import { requireAdmin } from '@/lib/auth';
import { getArticleForAdmin } from '@/lib/admin-articles';
import { renderArticle } from '@/lib/markdown';
import { resolveEmbeds } from '@/lib/article-embeds';
import { statusOf } from '@/lib/article-format';

// Stored article (draft or published) in the public layout, for admins only. Never cached and never
// indexed: a draft must not reach a CDN or a search engine through this page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pratinjau artikel — Admin INZTA',
  robots: { index: false, follow: false },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

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
  return (
    <BlogDetailClient
      article={rest}
      blocks={blocks}
      embeds={embeds}
      adminPreview
      articleUrl={`${siteUrl}/blog/${params.slug}`}
      previewBanner={statusOf(article) !== 'published'}
    />
  );
}
