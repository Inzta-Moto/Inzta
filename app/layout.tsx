import type { Metadata } from 'next';
import { Suspense } from 'react';
import AffiliateTracker from '@/components/AffiliateTracker';
import TrackingScripts from '@/components/TrackingScripts';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

// F-016 E5: claim-free defaults from the Beranda H1 and lead (the old copy made a water-resistance claim without a source,
// A-020); F-005 phase 2 may replace them with RND-approved copy.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'),
  title: {
    default: 'Tas motor untuk perjalanan Anda · INZTA',
    template: '%s'
  },
  description: 'Tank bag, side bag, dan tail bag buatan INZTA sejak 2023. Beri tahu motor Anda, kami tandai tas yang dibuat untuknya.',
  keywords: ['inzta', 'inzta moto', 'tas motor', 'sidebag motor', 'sidebag touring', 'perlengkapan motor'],
  authors: [{ name: 'Inzta Moto' }],
  creator: 'Inzta Moto',
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id',
    title: 'Tas motor untuk perjalanan Anda · INZTA',
    description: 'Tank bag, side bag, dan tail bag buatan INZTA sejak 2023. Beri tahu motor Anda, kami tandai tas yang dibuat untuknya.',
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
    title: 'Tas motor untuk perjalanan Anda · INZTA',
    description: 'Tank bag, side bag, dan tail bag buatan INZTA sejak 2023. Beri tahu motor Anda, kami tandai tas yang dibuat untuknya.',
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
          <TrackingScripts />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
