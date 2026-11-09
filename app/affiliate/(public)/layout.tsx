import AffiliateShell from '@/components/affiliate/AffiliateShell';

// F-023: the login page shares the v2 frame (tokens, fonts, affiliate.css) with the dashboard.
export default function AffiliatePublicLayout({ children }: { children: React.ReactNode }) {
  return <AffiliateShell>{children}</AffiliateShell>;
}
