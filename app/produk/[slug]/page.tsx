import { Metadata } from 'next';
import DetailClient from './DetailClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Default metadata jika semuanya gagal
  const defaultMeta: Metadata = {
    title: 'Produk — INZTA MOTO',
    description: 'Tas motor premium INZTA',
    openGraph: {
      title: 'INZTA MOTO',
      description: 'Tas motor premium INZTA',
      images: ['/logo.png'], // Fallback ke logo jika gagal
    },
  };

  if (!projectId) {
    console.error("❌ [Meta Error] NEXT_PUBLIC_FIREBASE_PROJECT_ID tidak ditemukan di file .env");
    return defaultMeta;
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products/${slug}`;
    
    const res = await fetch(url, { 
      cache: 'no-store' // Paksa selalu ambil data terbaru dari server
    });
    
    if (!res.ok) {
      console.error(`❌ [Meta Error] Firestore API merespon dengan status: ${res.status} - ${res.statusText}`);
      return defaultMeta;
    }
    
    const data = await res.json();

    // Cek jika Firestore mengembalikan error (misal: dokumen tidak ada)
    if (data.error) {
      console.error(`❌ [Meta Error] API Error: ${data.error.message}`);
      return defaultMeta;
    }

    const fields = data.fields;

    // Fungsi pembantu ekstrak data
    const getString = (field: any) => field?.stringValue || '';
    const getArray = (field: any) => field?.arrayValue?.values?.map((v: any) => v.stringValue) || [];

    const name = getString(fields.name);
    const description = getString(fields.description);
    const images = getArray(fields.images);
    const imageUrl = getString(fields.imageUrl);
    
    const ogImage = images.length > 0 ? images[0] : (imageUrl || '/logo.png');
    const ogDescription = description.split('\\n')[0] || 'Tas motor premium INZTA';

    console.log(`✅ [Meta Success] Berhasil ambil meta untuk: ${name}`);

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
