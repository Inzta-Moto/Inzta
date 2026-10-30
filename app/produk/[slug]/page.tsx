import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActiveProducts } from '@/lib/public-content';
import { getProduct } from '@/lib/v2/product-read';
import V2Layout from '@/components/v2/V2Layout';
import ProductDetail from '@/components/v2/product/ProductDetail';
import { selectRelated } from '@/components/v2/product/product-view';
import JsonLd from '@/components/JsonLd';
import TrackView from '@/components/v2/product/TrackView';
import { canonicalUrl, breadcrumbJsonLd, jsonLdGraph, openGraph, PAGE_TEXT, plainTextSummary, productJsonLd } from '@/lib/seo';
import { isValidSlug } from '@/lib/slug';
import '@/app/(v2)/v2-product.css';

// F-016 E1, S3.10.1: ISR per slug instead of force-dynamic. Product writes and stock changes purge the page through
// revalidateProductPaths(); nothing is prebuilt, so a build without credentials stays green.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

// F-005 phase 2 metadata (title through the layout template, plain-text description, og:url = canonical). The product
// read is shared with the layout and the page through cache().
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;
  if (!isValidSlug(slug)) notFound();

  // A failed read: no canonical and no og:url.
  const defaultMeta: Metadata = { title: 'Produk', description: PAGE_TEXT.produk.description };

  let data: any;
  try {
    data = await getProduct(slug);
  } catch (e: any) {
    console.error('❌ [Meta Error] Gagal total:', e.message);
    return defaultMeta;
  }
  // F-005 6.6: layout.tsx already answered 404 for an unknown slug; this keeps the metadata honest.
  if (!data) notFound();

  try {
    const name = data.name || 'Produk';
    const description = data.description || '';
    const images = data.images || [];
    const imageUrl = data.imageUrl || '';

    const ogImageRaw = images.length > 0 ? images[0] : (imageUrl || '/logo.png');

    let ogImage = ogImageRaw;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

    // Pastikan ini adalah absolute URL
    if (!ogImage.startsWith('http')) {
      ogImage = `${siteUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;
    }

    // Optimize image untuk WhatsApp
    let imageType = 'image/jpeg';
    if (ogImage.includes('res.cloudinary.com')) {
      // Jika image dari Cloudinary, convert jadi JPEG 800x800 size kecil agar aman di WA
      ogImage = ogImage.replace(
        '/image/upload/',
        '/image/upload/c_fill,w_800,h_800,f_jpg,q_auto/'
      );
    } else {
      if (ogImage.endsWith('.png')) imageType = 'image/png';
      else if (ogImage.endsWith('.webp')) imageType = 'image/webp';
    }

    // F-005 6.4: plain text, no Markdown markers or line breaks.
    const ogDescription = plainTextSummary(description) || `${name} dari INZTA Moto. Pesan langsung lewat WhatsApp.`;
    const url = canonicalUrl('produk', slug);

    return {
      title: name,
      description: ogDescription,
      alternates: { canonical: url },
      openGraph: openGraph({
        url,
        title: name,
        description: ogDescription,
        images: [{ url: ogImage, width: 800, height: 800, alt: name, type: imageType }],
      }),
      twitter: {
        card: 'summary_large_image',
        title: name,
        description: ogDescription,
        images: [ogImage],
      },
    };
  } catch (e: any) {
    console.error('❌ [Meta Error] Gagal total:', e.message);
    return defaultMeta;
  }
}

export default async function DetailPage({ params }: { params: { slug: string } }) {
  // A read failure throws (S3.10.3): the last good ISR page stays, or error.tsx renders; never a cached 404.
  // REV-01: an impossible slug answers 404 without a read, and the active list (related cards, navbar prices) is
  // read only once the product exists, so random URLs cost one document read instead of the whole collection.
  // F-005 6.6: layout.tsx answers 404 first; this check covers a render without it.
  if (!isValidSlug(params.slug)) notFound();
  const product = await getProduct(params.slug);
  if (!product) notFound();
  const active = await getActiveProducts();

  // F-005 phase 2: Product + Offer from the normalized product (no price 0, plain description) and a BreadcrumbList
  // with the labels of the v2 breadcrumb (Beranda / Produk / name); the position step links to a filtered
  // /produk?posisi= URL, which is not a canonical page, so it is left out.
  const jsonLd = jsonLdGraph(
    productJsonLd(product),
    breadcrumbJsonLd([
      { name: 'Beranda', url: canonicalUrl() },
      { name: 'Produk', url: canonicalUrl('produk') },
      { name: product.name, url: canonicalUrl('produk', product.slug) },
    ]),
  );
  return (
    <V2Layout current="produk" products={active}>
      <JsonLd data={jsonLd} />
      <TrackView slug={product.slug} name={product.name} price={(product.productType === 'simple' ? product.price : product.priceFrom) ?? 0} />
      <ProductDetail product={product} related={selectRelated(product, active)} />
    </V2Layout>
  );
}
