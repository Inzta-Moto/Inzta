import Link from 'next/link';
import { ArrowRight } from '@/components/v2/icons';

// "Semua motor (strap)" (S5.5): the whole card is one link to the catalog.
export default function MoreCard() {
  return (
    <Link className="iz-morecard" href="/produk">
      <div>
        <span className="iz-morecard__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="5.5" cy="17" r="3.5" />
            <circle cx="18.5" cy="17" r="3.5" />
            <path d="M15 6h2l3 11M5.5 17l4-7h6l-3 7M9.5 10 8 7H5" />
          </svg>
        </span>
        <h3>Semua motor (strap)</h3>
        <p>Tas dengan strap untuk banyak motor.</p>
      </div>
      <span className="iz-link">
        Lihat semua produk <ArrowRight size={18} />
      </span>
    </Link>
  );
}
