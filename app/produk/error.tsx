'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S0.11.2, S2.7.2: shown only when no good ISR copy of /produk exists yet and the product read failed.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="produk" />;
}
