'use client';

import ErrorV2 from '@/components/v2/ErrorV2';

// F-016 S5.10.2: a failed server render (for example a product read failure, S5.3.4) shows the v2 error page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorV2 error={error} reset={reset} current="motor" />;
}
