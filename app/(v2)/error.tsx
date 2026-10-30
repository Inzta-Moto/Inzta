'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S0.11.2. The route group keeps this boundary on the Beranda only; admin routes are not under (v2).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} />;
}
