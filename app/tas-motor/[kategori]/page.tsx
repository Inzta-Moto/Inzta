import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { MotorCategory } from '@/types';
import { getActiveProducts, getArticles } from '@/lib/public-content';
import { CATEGORY_SLUGS, isMotorCategory } from '@/lib/v2/motor-category';
import V2Layout from '@/components/v2/V2Layout';
import CategoryPage from '@/components/v2/motor/CategoryPage';
import { buildCategoryPage, categoryDescription, categoryIndexable, categoryTitle } from '@/components/v2/motor/motor-page';
import '@/app/(v2)/v2-motor.css';
import { canonicalUrl } from '@/lib/seo';

// F-016 S5.8.1: ISR; the four D1 slugs are prebuilt and every other slug, including case variants, is a 404.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams(): { kategori: MotorCategory }[] {
  return CATEGORY_SLUGS.map(kategori => ({ kategori }));
}

// One product read shared by generateMetadata and the page. A failed read throws (S5.3.4): a first render shows
// error.tsx and a background regeneration keeps the last good page; it never renders the empty state or noindex.
const readProducts = cache(getActiveProducts);

type Props = { params: { kategori: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isMotorCategory(params.kategori)) return {};
  const c = params.kategori;
  const products = await readProducts();
  const { lead } = buildCategoryPage(c, products, []);
  // S5.8.3, S5.8.5: no JSON-LD; noindex, follow while the shared helper says the page is not indexable.
  return {
    title: categoryTitle(c),
    description: categoryDescription(c, lead),
    alternates: { canonical: canonicalUrl('tas-motor', c) },
    ...(categoryIndexable(c, products) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function TasMotorPage({ params }: Props) {
  if (!isMotorCategory(params.kategori)) notFound();
  const c = params.kategori;
  const [products, articles] = await Promise.all([readProducts(), getArticles()]);
  return (
    <V2Layout dark current="motor" currentCategory={c} products={products} chipHref="#motor-lain">
      <CategoryPage data={buildCategoryPage(c, products, articles)} />
    </V2Layout>
  );
}
