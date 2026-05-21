import { Metadata } from 'next';
import BlogDetailClient from './BlogDetailClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const slug = params.slug;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const defaultMeta: Metadata = {
    title: 'Artikel — INZTA MOTO',
    description: 'Baca tips dan berita terbaru seputar dunia touring dan motor.',
    openGraph: {
      title: 'INZTA Article',
      description: 'Baca tips dan berita terbaru seputar dunia touring dan motor.',
      images: ['/logo.png'],
    },
  };

  if (!projectId) {
    console.error("❌ [Blog Meta Error] NEXT_PUBLIC_FIREBASE_PROJECT_ID tidak ditemukan di file .env");
    return defaultMeta;
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/articles/${slug}`;
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      console.error(`❌ [Blog Meta Error] Firestore API merespon dengan status: ${res.status}`);
      return defaultMeta;
    }

    const data = await res.json();

    if (data.error) {
      console.error(`❌ [Blog Meta Error] API Error: ${data.error.message}`);
      return defaultMeta;
    }

    const fields = data.fields;

    // Fungsi pembantu ekstrak data
    const getString = (field: any) => field?.stringValue || '';
    const getArray = (field: any) => field?.arrayValue?.values?.map((v: any) => v.stringValue) || [];

    const title = getString(fields.title);
    const content = getString(fields.content);
    const images = getArray(fields.images);
    const imageUrl = getString(fields.imageUrl);
    
    const ogImage = images.length > 0 ? images[0] : (imageUrl || '/logo.png');
    const ogDescription = content.split('\\n')[0] || 'Baca tips dan berita terbaru seputar dunia touring dan motor.';

    console.log(`✅ [Blog Meta Success] Berhasil ambil meta untuk: ${title}`);

    return {
      title: `${title} — INZTA Article`,
      description: ogDescription,
      openGraph: {
        title: title,
        description: ogDescription,
        images: [{ url: ogImage, width: 800, height: 800, alt: title }],
        type: 'article',
        siteName: 'INZTA MOTO',
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: ogDescription,
        images: [ogImage],
      },
    };
  } catch (e: any) {
    console.error("❌ [Blog Meta Error] Gagal total:", e.message);
    return defaultMeta;
  }
}

export default function BlogDetailPage({ params }: { params: { slug: string } }) {
  return <BlogDetailClient slug={params.slug} />;
}
