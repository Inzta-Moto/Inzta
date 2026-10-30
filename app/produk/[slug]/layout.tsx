import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/v2/product-read';
import { isValidSlug } from '@/lib/slug';

// F-005 6.6: notFound() here answers 404 even if a loading boundary is added under this segment later, because a
// loading.tsx wraps only the page and would start streaming with status 200 before the page runs. The read is
// shared with generateMetadata and the page through cache(), so this costs no extra Firestore read.
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  if (!isValidSlug(params.slug)) notFound(); // REV-01 (F-016): no read for a slug Firestore would reject
  let data: unknown;
  try {
    data = await getProduct(params.slug);
  } catch {
    return children; // a failed read is not a 404; the page throws to error.tsx or ISR keeps the last good page
  }
  if (!data) notFound();
  return children;
}
