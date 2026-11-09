'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { logoutAffiliate } from './logout';

/**
 * Logo mark + "INZTA" + "Affiliate", the same mark as the website navbar (components/v2/SiteNav.tsx). Plain text, not
 * a link: "Kembali ke toko" already leads to the shop. `size="lg"` is the login variant (30 px mark, 34 px from 1024).
 */
export function AffiliateBrand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className={size === 'lg' ? 'iz-aff-brand iz-aff-brand--lg' : 'iz-aff-brand'}>
      {/* 425 x 501 is the logo file's aspect; CSS sets the height. */}
      <img className="iz-aff-brand__mark" src="/logo-inzta.png" alt="" width={425} height={501} />
      <span className="iz-aff-brand__name">INZTA</span>
      <span className="iz-aff-brand__tag">Affiliate</span>
    </div>
  );
}

/**
 * Header inside the dark band (F-023 D-6, E7): brand, "Kembali ke toko", "Keluar". From 768 px the actions show their
 * text; below that they are 44 px icon buttons whose label stays in the DOM for screen readers.
 */
export default function AffiliateHeader() {
  const [busy, setBusy] = useState(false);
  // The ref blocks a second click that lands before React re-renders the disabled button.
  const started = useRef(false);

  const onLogout = () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    // logoutAffiliate always navigates away, so the button stays disabled; a rejected sign-out still redirects.
    logoutAffiliate().catch(() => {});
  };

  return (
    <header className="iz-aff-header">
      <AffiliateBrand />
      <div className="iz-aff-header__actions">
        <Link href="/" className="iz-aff-header__btn iz-aff-header__btn--plain" aria-label="Kembali ke toko">
          <ArrowLeft aria-hidden="true" />
          <span className="iz-aff-header__label">Kembali ke toko</span>
        </Link>
        <button type="button" className="iz-aff-header__btn" onClick={onLogout} disabled={busy} aria-label="Keluar">
          <LogOut aria-hidden="true" />
          <span className="iz-aff-header__label">Keluar</span>
        </button>
      </div>
    </header>
  );
}
