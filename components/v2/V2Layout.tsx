import type { ReactNode } from 'react';
import type { MotorCategory, Product } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { getNavData } from '@/lib/v2/nav-data';
import V2Page from '@/components/v2/V2Page';
import FlashBar from '@/components/v2/FlashBar';
import SiteNav, { type NavTab } from '@/components/v2/SiteNav';
import SiteFooter from '@/components/v2/SiteFooter';

// Shared frame of every v2 page except the Beranda (F-016 S0.2): promo bar, navbar, main, footer. The navbar prices
// and the flash-sale state are read on the server so the frame is the same on every page. Pages that already read
// the products pass them in to avoid a second Firestore read. `dark` is true only for pages that open on a dark hero
// (S5, S8), so the first paint matches the first section without JavaScript (S0.4.4).
export default async function V2Layout({
  children,
  current,
  currentCategory,
  products,
  dark = false,
}: {
  children: ReactNode;
  current?: NavTab;
  currentCategory?: MotorCategory;
  products?: Product[];
  dark?: boolean;
}) {
  const { minPrices, flash } = await getNavData(products);
  const waHref = `https://wa.me/${WA_NUMBER}`;
  return (
    <V2Page>
      <FlashBar flash={flash} />
      <SiteNav current={current} currentCategory={currentCategory} minPrices={minPrices} waHref={waHref} dark={dark} />
      <main id="isi">{children}</main>
      <SiteFooter waHref={waHref} waNumber={WA_NUMBER} />
    </V2Page>
  );
}
