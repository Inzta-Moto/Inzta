import { Metadata } from 'next';
import { cache } from 'react';
import DetailClient from './DetailClient';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { normalizeProduct } from '@/lib/product-utils';

const getCachedProduct = cache(async (slug: string) => {
  const doc = await getAdminDb().collection('products').doc(slug).get();
  if (!doc.exists) return null;
  return doc.data();
});

export const dynamic = 'force-dynamic';

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
    const data = await getCachedProduct(slug) as any;
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
    console.error("❌ [Meta Error] Gagal total:", e.message);
    return defaultMeta;
  }
}

export default async function DetailPage({ params }: { params: { slug: string } }) {
  let jsonLd = null;
  let product = null;
  let related: any[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

  try {
    const db = getAdminDb();
    
    // Ambil data produk utama dan related secara paralel
    const [data, relSnapshot] = await Promise.all([
      getCachedProduct(params.slug),
      db.collection('products').where('isActive', '==', true).limit(5).get()
    ]);
    
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

      const imageUrl = (dataObj.images && dataObj.images.length > 0) ? dataObj.images[0] : (dataObj.imageUrl || '/logo.png');
      
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: dataObj.name || 'Produk INZTA',
        image: imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`,
        description: dataObj.description || 'Tas motor premium INZTA',
        sku: dataObj.slug || params.slug,
        offers: {
          '@type': 'Offer',
          url: `${baseUrl}/produk/${params.slug}`,
          priceCurrency: 'IDR',
          price: dataObj.price || 0,
          availability: dataObj.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        brand: {
          '@type': 'Brand',
          name: 'INZTA Moto'
        }
      };
        
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

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <DetailClient slug={params.slug} initialProduct={product} initialRelated={related} />
    </>
  );
}
