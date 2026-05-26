'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AffiliateTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const aff = searchParams.get('aff');
    if (aff) {
      localStorage.setItem('inzta_affiliate', aff);
    }
  }, [searchParams]);

  return null;
}
