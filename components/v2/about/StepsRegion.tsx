'use client';

import { useEffect, useState, type ReactNode } from 'react';

// S8.2.6: below 1024 px the process row is a swipe row, so it is a focusable region that scrolls with the arrow
// keys. From 1024 px the five steps fit, and the extra tab stop is removed. The server render keeps the tab stop so
// the row is reachable without JavaScript.
export default function StepsRegion({ label, children }: { label: string; children: ReactNode }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return (
    <div className="iz-steps-region" role="region" aria-label={label} tabIndex={wide ? undefined : 0}>
      {children}
    </div>
  );
}
