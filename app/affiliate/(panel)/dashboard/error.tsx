'use client';

import { startTransition } from 'react';
import { useRouter } from 'next/navigation';
import DashboardError from '@/components/affiliate/DashboardError';

// F-023 E16: page.tsx throws here when the session is valid but a read fails. reset() alone only re-renders the
// client tree, so the retry also refreshes the route to run the server page again.
export default function AffiliateDashboardErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const onRetry = () => {
    startTransition(() => {
      reset();
      router.refresh();
    });
  };
  return <DashboardError onRetry={onRetry} />;
}
