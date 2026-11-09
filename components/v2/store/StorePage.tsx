import Link from 'next/link';
import { STORE_COPY, type PartnerStore } from '@/lib/v2/partner-stores';
import { ArrowRight } from '@/components/v2/icons';
import StoreCard from '@/components/v2/store/StoreCard';

// /toko (F-027 B1-B4): page head in the family of /produk and the legal pages, one card per shop, then a plain closing
// line for visitors outside Depok. Server only; the one client piece is the decorative route map inside each card.
export default function StorePage({
  stores,
  productNames = {},
}: {
  stores: PartnerStore[];
  productNames?: Record<string, string>;
}) {
  return (
    <div className="iz-wrap" style={{ paddingTop: 128 }}>
      <div className="iz-head" style={{ marginBottom: 32 }}>
        <span className="iz-eyebrow" style={{ marginBottom: 0 }}>
          {STORE_COPY.page.eyebrow}
        </span>
        <h1 className="t-h1-shop">{STORE_COPY.page.title}</h1>
        <p className="t-lead">{STORE_COPY.page.lead}</p>
      </div>
      <div className="iz-store-list">
        {stores.map(store => (
          <StoreCard
            key={store.slug}
            store={store}
            products={(store.products ?? []).flatMap(slug => (productNames[slug] ? [{ slug, name: productNames[slug] }] : []))}
          />
        ))}
      </div>
      <div className="iz-store-close">
        <p>{STORE_COPY.closing.text}</p>
        <Link className="iz-link" href="/produk">
          {STORE_COPY.closing.link} <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
