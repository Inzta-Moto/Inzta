import { Metadata } from 'next';
import DetailClient from './DetailClient';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;

  const defaultMeta: Metadata = {
    title: 'Produk — INZTA MOTO',
    description: 'Tas motor premium INZTA',
    openGraph: {
      title: 'INZTA MOTO',
      description: 'Tas motor premium INZTA',
      images: ['/logo.png'],
    },
  };

  try {
    const doc = await getAdminDb().collection('products').doc(slug).get();
    if (!doc.exists) {
      return defaultMeta;
    }

    const data = doc.data() as any;
    const name = data.name || 'Produk';
    const description = data.description || '';
    const images = data.images || [];
    const imageUrl = data.imageUrl || '';
    
    const ogImage = images.length > 0 ? images[0] : (imageUrl || '/logo.png');
    const ogDescription = description ? description.split('\n')[0] : 'Tas motor premium INZTA';

    return {
      title: `${name} — INZTA MOTO`,
      description: ogDescription,
      openGraph: {
        title: name,
        description: ogDescription,
        images: [{ url: ogImage, width: 800, height: 800, alt: name }],
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
    
    // Ambil data produk utama
    const doc = await db.collection('products').doc(params.slug).get();
    if (doc.exists) {
      const data = doc.data() as any;
      
      // Serialize produk agar aman di-pass ke Client Component
      product = {
        ...data,
        slug: params.slug,
        createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : null,
        updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : null,
      };

      const imageUrl = (data.images && data.images.length > 0) ? data.images[0] : (data.imageUrl || '/logo.png');
      
      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: data.name || 'Produk INZTA',
        image: imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`,
        description: data.description || 'Tas motor premium INZTA',
        sku: data.slug || params.slug,
        offers: {
          '@type': 'Offer',
          url: `${baseUrl}/produk/${params.slug}`,
          priceCurrency: 'IDR',
          price: data.price || 0,
          availability: data.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
        brand: {
          '@type': 'Brand',
          name: 'INZTA Moto'
        }
      };

      // Ambil data related products
      const relSnapshot = await db.collection('products')
        .where('isActive', '==', true)
        .limit(5)
        .get();
        
      related = relSnapshot.docs
        .map(d => {
          const dData = d.data();
          return {
            ...dData,
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
