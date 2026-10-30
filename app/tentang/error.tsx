'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S0.11.2: a render failure of the page itself; a failed navbar read does not land here (S8.7.5).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="tentang" />;
}
