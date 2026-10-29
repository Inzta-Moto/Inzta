'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S7.9.6: a failed render shows the v2 error page; ISR keeps the last good page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="artikel" />;
}
