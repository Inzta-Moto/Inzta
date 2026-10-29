import type { ReactNode } from 'react';
import type { Product } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { getActiveProducts } from '@/lib/public-content';
import { getFlashSale } from '@/lib/v2/flash-sale';
import { isFlashActive } from '@/lib/v2/flash-time';
import { minPriceByPosition } from '@/lib/v2/home-data';
import V2Page from '@/components/v2/V2Page';
import FlashBar from '@/components/v2/FlashBar';
import SiteNav, { type NavTab } from '@/components/v2/SiteNav';
import SiteFooter from '@/components/v2/SiteFooter';

// Shared frame of every v2 page except the Beranda (F-016 25): promo bar, navbar, main, footer. The navbar prices
// and the flash-sale state are read on the server so the frame is the same on every page (25.2). Pages that already
// read the products pass them in to avoid a second Firestore read.
export default async function V2Layout({
  children,
  current,
  products,
}: {
  children: ReactNode;
  current?: NavTab;
  products?: Product[];
}) {
  const [list, flashRaw] = await Promise.all([products ? Promise.resolve(products) : getActiveProducts(), getFlashSale()]);
  const flash = isFlashActive(flashRaw, Date.now()) ? flashRaw : { isActive: false, endsAt: null };
  const waHref = `https://wa.me/${WA_NUMBER}`;
  return (
    <V2Page>
      <FlashBar flash={flash} />
      <SiteNav current={current} minPrices={minPriceByPosition(list)} waHref={waHref} />
      <main id="isi">{children}</main>
      <SiteFooter waHref={waHref} waNumber={WA_NUMBER} />
    </V2Page>
  );
}
