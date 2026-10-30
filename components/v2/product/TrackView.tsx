'use client';

import { useEffect, useRef } from 'react';
import { trackViewItem } from '@/lib/tracking';

// F-002 "lihat produk", once per slug (not again on variant or quantity changes or under StrictMode), as DetailClient did.
export default function TrackView({ slug, name, price }: { slug: string; name: string; price: number }) {
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (tracked.current === slug) return;
    tracked.current = slug;
    trackViewItem({ slug, name, price });
  }, [slug, name, price]);
  return null;
}
