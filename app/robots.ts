import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'], // Mencegah bot mengindeks halaman admin dan api
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
