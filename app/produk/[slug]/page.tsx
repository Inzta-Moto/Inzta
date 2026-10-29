import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DetailClient from './DetailClient';
import { getCachedProduct } from './get-product';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { normalizeProduct } from '@/lib/product-utils';
import JsonLd from '@/components/JsonLd';
import { canonicalUrl, breadcrumbJsonLd, jsonLdGraph, openGraph, PAGE_TEXT, plainTextSummary, productJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;

  // A failed read: no canonical and no og:url.
  const defaultMeta: Metadata = { title: 'Produk', description: PAGE_TEXT.produk.description };

  let data: any;
  try {
    data = await getCachedProduct(slug);
  } catch (e: any) {
    console.error("❌ [Meta Error] Gagal total:", e.message);
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
    console.error("❌ [Meta Error] Gagal total:", e.message);
    return defaultMeta;
  }
}

export default async function DetailPage({ params }: { params: { slug: string } }) {
  let jsonLd = null;
  let missing = false;
  let product = null;
  let related: any[] = [];
  try {
    const db = getAdminDb();
    
    // Ambil data produk utama dan related secara paralel
    const [data, relSnapshot] = await Promise.all([
      getCachedProduct(params.slug),
      db.collection('products').where('isActive', '==', true).limit(5).get()
    ]);
    
    missing = !data;
    if (data) {
      const dataObj = data as any;

      // Normalisasi data Firestore dulu (set productType='simple' untuk legacy
      // docs, alias compareAtPrice dari originalPrice, dll.) BARU serialize.
      // Tanpa normalisasi, legacy products tanpa field `productType` akan bikin
      // downstream `product.productType === 'simple'` di DetailClient gagal →
      // harga & stok tampil 0.
      const normalized = normalizeProduct(params.slug, dataObj) as any;

      // Serialize produk agar aman di-pass ke Client Component
      product = {
        ...normalized,
        slug: params.slug,
        createdAt: dataObj.createdAt ? (dataObj.createdAt.toMillis ? dataObj.createdAt.toMillis() : dataObj.createdAt) : null,
        updatedAt: dataObj.updatedAt ? (dataObj.updatedAt.toMillis ? dataObj.updatedAt.toMillis() : dataObj.updatedAt) : null,
      };

      // F-005 phase 2: Product from the normalized product (no price 0, plain description) + BreadcrumbList.
      jsonLd = jsonLdGraph(
        productJsonLd(product),
        breadcrumbJsonLd([
          { name: 'Home', url: canonicalUrl() },
          { name: 'Produk', url: canonicalUrl('produk') },
          { name: product.name, url: canonicalUrl('produk', params.slug) },
        ]),
      );
        
      related = relSnapshot.docs
        .map(d => {
          const dData = d.data();
          // Normalisasi juga untuk related products — agar ProductCard konsisten
          // dengan harga yang benar (sebelumnya harga di kartu juga 0 untuk legacy).
          const normalizedRel = normalizeProduct(d.id, dData) as any;
          return {
            ...normalizedRel,
            slug: d.id,
            createdAt: dData.createdAt ? (dData.createdAt.toMillis ? dData.createdAt.toMillis() : dData.createdAt) : null,
            updatedAt: dData.updatedAt ? (dData.updatedAt.toMillis ? dData.updatedAt.toMillis() : dData.updatedAt) : null,
          };
        })
        .filter(p => p.slug !== params.slug)
        .slice(0, 4);
    }
  } catch (error) {
    console.error('Error fetching product data:', error);
  }
  // F-005 6.6: see layout.tsx. A failed read still renders and lets DetailClient retry.
  if (missing) notFound();

  return (
    <>
      {jsonLd && <JsonLd data={jsonLd} />}
      <DetailClient slug={params.slug} initialProduct={product} initialRelated={related} />
    </>
  );
}
