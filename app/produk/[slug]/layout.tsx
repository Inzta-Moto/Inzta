import { notFound } from 'next/navigation';
import { getCachedProduct } from './get-product';

// F-005 6.6: loading.tsx wraps only the page, so the response starts streaming (status 200) before the page
// runs. This layout sits above that boundary: an unknown slug throws here, while the status can still be 404.
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  let data: unknown;
  try {
    data = await getCachedProduct(params.slug);
  } catch {
    return children; // a failed read is not a 404; the page and DetailClient handle it
  }
  if (!data) notFound();
  return children;
}
