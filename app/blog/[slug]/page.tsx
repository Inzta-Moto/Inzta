import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlogDetailClient from './BlogDetailClient';
import { getArticle } from '@/lib/public-content';

// ISR per slug: the first request renders and caches the page; admin writes call revalidatePath.
export const revalidate = 3600;

// Empty on purpose: no Firestore reads at build. Without generateStaticParams Next 14 renders this route
// on every request; with it, each slug is rendered on its first request and then served from the ISR cache.
export function generateStaticParams() {
  return [];
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const defaultMeta: Metadata = {
    title: 'Artikel — INZTA MOTO',
    description: 'Baca tips dan berita terbaru seputar dunia touring dan motor.',
    openGraph: {
      title: 'INZTA Article',
      description: 'Baca tips dan berita terbaru seputar dunia touring dan motor.',
      images: ['/logo.png'],
    },
  };

  // Shares the cached read with the page below, so one render costs one Firestore read.
  const article = await getArticle(params.slug);
  if (!article) return defaultMeta;

  const title = article.title || '';
  const content = article.content || '';
  const images = article.images || [];
  const imageUrl = article.imageUrl || '';

  const ogImage = images.length > 0 ? images[0] : (imageUrl || '/logo.png');
  // Same rule as before F-001 (splits on a literal "\n"); proper descriptions are F-005.
  const ogDescription = content.split('\n')[0] || 'Baca tips dan berita terbaru seputar dunia touring dan motor.';

  return {
    title: `${title} — INZTA Article`,
    description: ogDescription,
    openGraph: {
      title: title,
      description: ogDescription,
      images: [{ url: ogImage, width: 800, height: 800, alt: title }],
      type: 'article',
      siteName: 'INZTA MOTO',
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

export default async function BlogDetailPage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  return <BlogDetailClient article={article} articleUrl={`${siteUrl}/blog/${params.slug}`} />;
}
