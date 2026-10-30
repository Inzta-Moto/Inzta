'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import V2StaticFrame from '@/components/v2/V2StaticFrame';
import type { NavTab } from '@/components/v2/SiteNav';

// Error boundary body for every v2 route (F-016 S0.11.2). The server render failed, so the frame reads no data.
export default function ErrorV2({ error, reset, current }: { error: Error & { digest?: string }; reset: () => void; current?: NavTab }) {
  useEffect(() => {
    console.error('[v2] page render failed:', error.digest ?? error.message);
  }, [error]);
  return (
    <V2StaticFrame current={current}>
      <section className="iz-state">
        <div className="iz-wrap">
          <h1 className="t-h1-shop">Halaman gagal dimuat</h1>
          <p>Coba muat ulang halaman ini.</p>
          <div className="iz-row">
            <button className="iz-btn iz-btn--primary" type="button" onClick={reset}>Coba lagi</button>
            <Link className="iz-btn iz-btn--secondary" href="/">Kembali ke Beranda</Link>
          </div>
        </div>
      </section>
    </V2StaticFrame>
  );
}
