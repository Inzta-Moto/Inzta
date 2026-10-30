'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S0.11.2, S3.10.3: a failed product read renders the v2 error page with a retry, never "not found".
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="produk" />;
}
