import type { Metadata } from 'next';
import { Suspense } from 'react';
import AffiliateTracker from '@/components/AffiliateTracker';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'),
  title: {
    default: 'INZTA Moto | Premium Waterproof Motorcycle Bags',
    template: '%s'
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
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'}/logo-mtg.png`,
        width: 1200,
        height: 630,
        alt: 'INZTA Moto',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'INZTA Moto | Premium Waterproof Motorcycle Bags',
    description: 'Tas motor eksklusif untuk rider. Waterproof, ringan, tahan banting, dan stylish.',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'}/logo-mtg.png`],
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
      </head>
      <body className={inter.className}>
        <Suspense fallback={null}>
          <AffiliateTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
