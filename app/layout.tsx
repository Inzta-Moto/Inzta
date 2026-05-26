import type { Metadata } from 'next';
import { Suspense } from 'react';
import AffiliateTracker from '@/components/AffiliateTracker';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'),
  title: {
    default: 'INZTA Moto | Premium Waterproof Motorcycle Bags',
    template: '%s | INZTA Moto'
  },
  description: 'Tas motor eksklusif dan perlengkapan touring untuk rider. Waterproof, ringan, tahan banting, dan stylish. Temukan Sidebag Inzta Adventure dan produk lainnya.',
  keywords: ['inzta', 'inzta moto', 'tas motor', 'tas waterproof', 'sidebag motor', 'sidebag touring', 'tas touring waterproof', 'perlengkapan motor'],
  authors: [{ name: 'Inzta Moto' }],
  creator: 'Inzta Moto',
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id',
    title: 'INZTA Moto | Premium Waterproof Motorcycle Bags',
    description: 'Tas motor eksklusif untuk rider. Waterproof, ringan, tahan banting, dan stylish.',
    siteName: 'INZTA Moto',
    images: [
      {
        url: '/logo.png', // Pastikan logo yang representatif
        width: 800,
        height: 600,
        alt: 'INZTA Moto Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'INZTA Moto | Premium Waterproof Motorcycle Bags',
    description: 'Tas motor eksklusif untuk rider. Waterproof, ringan, tahan banting, dan stylish.',
    images: ['/logo.png'],
    creator: '@inztamoto',
  },
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Suspense fallback={null}>
          <AffiliateTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}