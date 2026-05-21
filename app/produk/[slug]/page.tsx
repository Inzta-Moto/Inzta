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

export default function DetailPage({ params }: { params: { slug: string } }) {
  return <DetailClient slug={params.slug} />;
}
