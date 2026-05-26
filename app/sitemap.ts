import { MetadataRoute } from 'next';
import { getAdminDb } from '@/lib/firebaseAdmin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inztamoto.id';

  // Halaman statis
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/produk`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];

  // Halaman dinamis produk
  const dynamicRoutes: MetadataRoute.Sitemap = [];

  try {
    const productsSnapshot = await getAdminDb().collection('products').where('isActive', '==', true).get();
    
    productsSnapshot.forEach((doc) => {
      // id dokumen adalah slugnya
      const slug = doc.id;
      
      dynamicRoutes.push({
        url: `${baseUrl}/produk/${slug}`,
        lastModified: new Date(), // Idealnya diambil dari properti updatedAt di DB jika ada
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    });
  } catch (error) {
    console.error('Error generating sitemap for products:', error);
  }

  // Halaman dinamis blog (opsional jika blog sudah ada kontennya)
  try {
    const blogsSnapshot = await getAdminDb().collection('articles').where('isPublished', '==', true).get();
    
    blogsSnapshot.forEach((doc) => {
      const slug = doc.id;
      
      dynamicRoutes.push({
        url: `${baseUrl}/blog/${slug}`,
        lastModified: new Date(), 
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    });
  } catch (error) {
    console.error('Error generating sitemap for blogs:', error);
  }

  return [...staticRoutes, ...dynamicRoutes];
}
