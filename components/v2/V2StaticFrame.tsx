import type { ReactNode } from 'react';
import { WA_NUMBER } from '@/lib/constants';
import { minPriceByPosition } from '@/lib/v2/home-data';
import V2Page from '@/components/v2/V2Page';
import SiteNav, { type NavTab } from '@/components/v2/SiteNav';
import SiteFooter from '@/components/v2/SiteFooter';

// Frame without data reads for loading.tsx, error.tsx, and not-found.tsx (F-016 S0.4.6, S0.11, S0.12.3): an empty
// product list gives a navbar without price lines, and there is no promo bar, so these pages render even when
// Firestore is down. It imports nothing server-only, so client error boundaries can use it too.
export default function V2StaticFrame({ children, current, busy = false }: { children: ReactNode; current?: NavTab; busy?: boolean }) {
  const waHref = `https://wa.me/${WA_NUMBER}`;
  return (
    <V2Page>
      <SiteNav current={current} minPrices={minPriceByPosition([])} waHref={waHref} dark={false} />
      <main id="isi" aria-busy={busy || undefined}>{children}</main>
      <SiteFooter waHref={waHref} waNumber={WA_NUMBER} />
    </V2Page>
  );
}
