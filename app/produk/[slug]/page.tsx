import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActiveProducts } from '@/lib/public-content';
import { getProduct } from '@/lib/v2/product-read';
import V2Layout from '@/components/v2/V2Layout';
import ProductDetail from '@/components/v2/product/ProductDetail';
import { productJsonLd, selectRelated } from '@/components/v2/product/product-view';
import JsonLd from '@/components/JsonLd';
import TrackView from '@/components/v2/product/TrackView';
import { canonicalUrl } from '@/lib/seo';
import '@/app/(v2)/v2-product.css';

// F-016 E1, S3.10.1: ISR per slug instead of force-dynamic. Product writes and stock changes purge the page through
// revalidateProductPaths(); nothing is prebuilt, so a build without credentials stays green.
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

// Kept from the previous page (S3.10.1): same title, description, Open Graph and Twitter fields. The product read
// is shared with the page through cache().
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;

  const defaultMeta: Metadata = {
    title: 'Produk — INZTA MOTO',
    description: 'Tas motor premium INZTA',
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'}/produk/${slug}`,
      title: 'INZTA MOTO',
      description: 'Tas motor premium INZTA',
      images: ['/logo.png'],
    },
  };

  try {
    const data = (await getProduct(slug)) as any;
    if (!data) {
      return defaultMeta;
    }

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

    const ogDescription = description ? description.split('\n')[0] : 'Tas motor premium INZTA';

    return {
      title: `${name} — INZTA MOTO`,
      description: ogDescription,
      alternates: { canonical: canonicalUrl('produk', slug) },
      openGraph: {
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'}/produk/${slug}`,
        title: name,
        description: ogDescription,
        images: [{ url: ogImage, width: 800, height: 800, alt: name, type: imageType }],
        type: 'website',
        siteName: 'INZTA MOTO',
      },
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
  const [product, active] = await Promise.all([getProduct(params.slug), getActiveProducts()]);
  if (!product) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';
  return (
    <V2Layout current="produk" products={active}>
      <JsonLd data={productJsonLd(product, baseUrl)} />
      <TrackView slug={product.slug} name={product.name} price={(product.productType === 'simple' ? product.price : product.priceFrom) ?? 0} />
      <ProductDetail product={product} related={selectRelated(product, active)} />
    </V2Layout>
  );
}
