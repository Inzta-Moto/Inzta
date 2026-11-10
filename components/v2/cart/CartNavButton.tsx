'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cart } from '@/components/v2/icons';
import { badgeCount, badgeText } from '@/lib/cart/cart-core';
import { useCart } from '@/lib/cart/store';

// F-030 E7, E8: cart link with a product-count badge in the navbar capsule. The server HTML has no badge (the stored
// cart is read after hydration), so every visitor gets the same ISR page.
export default function CartNavButton({ current = false }: { current?: boolean }) {
  const count = badgeCount(useCart());
  const [bump, setBump] = useState(false);
  const last = useRef(count);

  useEffect(() => {
    if (count > last.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 400);
      last.current = count;
      return () => window.clearTimeout(t);
    }
    last.current = count;
  }, [count]);

  const label = count > 0 ? `Keranjang, ${count} produk` : 'Keranjang';
  return (
    <Link className="iz-navcart" href="/keranjang" aria-label={label} {...(current ? { 'aria-current': 'page' as const } : {})}>
      <Cart width={20} height={20} />
      {count > 0 && (
        <span className="iz-navcart__badge" data-bump={bump ? 'true' : undefined} aria-hidden="true">
          {badgeText(count)}
        </span>
      )}
    </Link>
  );
}
