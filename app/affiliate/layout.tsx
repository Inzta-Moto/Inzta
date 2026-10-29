import type { Metadata } from 'next';

// F-005 Q-7 (Angkasa, 2026-10-29): affiliate login and dashboard are not for search results, and must not
// share the home page title.
export const metadata: Metadata = {
  title: 'Affiliate',
  robots: { index: false, follow: true },
};

export default function AffiliateRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
