'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S6.6.4, S6.7.5: a failed article read renders the v2 error page; ISR keeps the last good page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="artikel" />;
}
