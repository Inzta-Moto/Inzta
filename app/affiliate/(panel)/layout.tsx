import AffiliateShell from '@/components/affiliate/AffiliateShell';

// F-025 D-6: one page needs no side navigation, so the admin sidebar and admin.css are gone; the dashboard renders its
// own header inside the dark band. Logout moved to components/affiliate/logout.ts.
export default function AffiliatePanelLayout({ children }: { children: React.ReactNode }) {
  return <AffiliateShell>{children}</AffiliateShell>;
}
