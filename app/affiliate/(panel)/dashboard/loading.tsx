import DashboardSkeleton from '@/components/affiliate/DashboardSkeleton';

// F-023 E15: shown while page.tsx verifies the session and reads Firestore.
export default function AffiliateDashboardLoading() {
  return <DashboardSkeleton />;
}
