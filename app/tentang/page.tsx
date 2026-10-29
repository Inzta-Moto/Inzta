import type { Metadata } from 'next';
import type { Product, PublicArticle } from '@/types';
import { getActiveProducts, getArticles } from '@/lib/public-content';
import V2Layout from '@/components/v2/V2Layout';
import About from '@/components/v2/about/About';
import { GASBER_SLUG } from '@/components/v2/about/about-content';
import '@/app/(v2)/v2-about.css';

// F-016 S8.7.1: ISR; product, article, and flash-sale writes revalidate /tentang (design.md §2).
export const revalidate = 3600;

const TITLE = 'Tentang INZTA';
const DESCRIPTION =
  'INZTA adalah brand lokal tas dan perlengkapan motor dari PT Inzta Gear Indonesia. Kami membuat tank bag, side bag, tail bag, dan aksesori touring untuk rider Indonesia.';

// S8.7.3: the canvas <title> (recorded exception to E5); own Open Graph and Twitter text so the root copy is never
// inherited; no JSON-LD (F-005). A page-level openGraph replaces the root object whole, so the root image, site name,
// and locale are repeated here.
const SHARE_IMAGE = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'}/logo-mtg.png`;
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/tentang' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'INZTA Moto',
    title: TITLE,
    description: DESCRIPTION,
    url: '/tentang',
    images: [{ url: SHARE_IMAGE, width: 1200, height: 630, alt: 'INZTA Moto' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [SHARE_IMAGE] },
};

export default async function TentangPage() {
  // S8.7.5: the page has no list of its own; a failed navbar read hides the price lines instead of failing the page,
  // and a failed article read points "Baca catatan Gasber 16" to /blog (S8.3.3).
  const [products, articles] = await Promise.all([
    getActiveProducts().catch((e: unknown): Product[] => {
      console.error('[tentang] navbar products read failed:', e);
      return [];
    }),
    getArticles().catch((e: unknown): PublicArticle[] => {
      console.error('[tentang] articles read failed:', e);
      return [];
    }),
  ]);
  const gasberHref = articles.some(a => a.slug === GASBER_SLUG) ? `/blog/${GASBER_SLUG}` : '/blog';
  return (
    <V2Layout dark current="tentang" products={products}>
      <About gasberHref={gasberHref} />
    </V2Layout>
  );
}
