import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogDetailClient from './BlogDetailClient';
import { getArticle } from '@/lib/public-content';
import { renderArticle } from '@/lib/markdown';
import { resolveEmbeds, visibleBlocks } from '@/lib/article-embeds';
import { firstLineSummary } from '@/lib/article-format';
import { optimizeCloudinaryUrl } from '@/lib/utils';
import { articleJsonLd, breadcrumbJsonLd, canonicalUrl, jsonLdGraph, openGraph } from '@/lib/seo';
import JsonLd from '@/components/JsonLd';
import type { PublicArticle } from '@/types';

// ISR per slug: the first request renders and caches the page; admin writes call revalidatePath.
export const revalidate = 3600;

// Empty on purpose: no Firestore reads at build. Without generateStaticParams Next 14 renders this route
// on every request; with it, each slug is rendered on its first request and then served from the ISR cache.
export function generateStaticParams() {
  return [];
}

const DEFAULT_DESCRIPTION = 'Baca tips dan berita terbaru seputar dunia touring dan motor.';

// Link previews want a fixed 1200x630 JPEG: WhatsApp and Facebook do not all accept the AVIF that
// f_auto may serve. Non-Cloudinary images (legacy imageUrl, the logo) are passed through without sizes.
function toOgImage(url: string, alt: string) {
  if (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)) {
    return { url: optimizeCloudinaryUrl(url, 1200, 630, 'fill').replace('/f_auto,', '/f_jpg,'), width: 1200, height: 630, alt };
  }
  return { url, alt };
}

// metaDescription, else excerpt, else the first readable line; never the whole content (requirement 5.6).
function articleDescription(article: Pick<PublicArticle, 'metaDescription' | 'excerpt' | 'content'>): string {
  return article.metaDescription?.trim() || article.excerpt?.trim() || firstLineSummary(article.content || '') || DEFAULT_DESCRIPTION;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const defaultMeta: Metadata = { title: 'Artikel', description: DEFAULT_DESCRIPTION };

  // Shares the cached read with the page below, so one render costs one Firestore read.
  const article = await getArticle(params.slug);
  if (!article) return defaultMeta;

  // F-005 6.2: the layout template adds " | INZTA Moto"; a metaTitle is used as the whole title, unchanged.
  const metaTitle = article.metaTitle?.trim();
  const title = metaTitle ? { absolute: metaTitle } : article.title;
  const socialTitle = article.metaTitle?.trim() || article.title;
  const description = articleDescription(article);
  const image = toOgImage(
    article.coverImage || article.images?.[0] || article.imageUrl || '/logo.png',
    (article.coverImage && article.coverAlt) || article.title,
  );

  const url = canonicalUrl('blog', article.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: openGraph({ url, title: socialTitle, description, images: [image], type: 'article' }),
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [image.url],
    },
  };
}

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  // Rendered and sanitized here on the server; the raw content is not sent to the browser.
  const { blocks } = renderArticle(article);
  const embeds = await resolveEmbeds(blocks, { exclude: article.slug });
  const url = canonicalUrl('blog', article.slug);
  // One block: Article (needs content for the body-image fallback) + BreadcrumbList with the visible labels (7.1).
  const jsonLd = jsonLdGraph(
    articleJsonLd(article),
    breadcrumbJsonLd([
      { name: 'Home', url: canonicalUrl() },
      { name: 'Blog', url: canonicalUrl('blog') },
      { name: article.title, url },
    ]),
  );
  const { content, ...rest } = article;
  return (
    <>
      <JsonLd data={jsonLd} />
      <BlogDetailClient article={rest} blocks={visibleBlocks(blocks, embeds)} embeds={embeds} articleUrl={url} />
    </>
  );
}
