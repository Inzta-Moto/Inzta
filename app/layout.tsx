import type { Metadata } from 'next';
import { Suspense } from 'react';
import AffiliateTracker from '@/components/AffiliateTracker';
import TrackingScripts from '@/components/TrackingScripts';
import { DEFAULT_OG_IMAGE, PAGE_TEXT, SITE_NAME } from '@/lib/seo';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://inzta.id'),
  // F-005 phase 2: pages pass their own title; the template adds the brand (requirement 6.2).
  title: {
    default: PAGE_TEXT.home.title,
    template: `%s | ${SITE_NAME}`,
  },
  description: PAGE_TEXT.home.description,
  keywords: ['inzta', 'inzta moto', 'tas motor', 'sidebag motor', 'sidebag touring', 'tas touring', 'perlengkapan motor'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  // No og:url here: public pages set their own through openGraph() (6.5), and admin/affiliate pages need none.
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    title: PAGE_TEXT.home.title,
    description: PAGE_TEXT.home.description,
    siteName: SITE_NAME,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TEXT.home.title,
    description: PAGE_TEXT.home.description,
    images: [DEFAULT_OG_IMAGE.url],
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
