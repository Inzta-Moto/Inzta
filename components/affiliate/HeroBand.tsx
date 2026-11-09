import type { ReactNode } from 'react';
import AffiliateHeader from './AffiliateHeader';
import RouteSteps, { COMMISSION_STEPS, COMMISSION_STEPS_TITLE } from './RouteSteps';
import '@/app/affiliate/affiliate-dashboard.css';

/**
 * Page frame of the dashboard, its loading skeleton, and its error state. The header is a sibling before <main> so
 * the landmarks are banner then main (E17); it is laid over the top of the band, which reserves its height, so the
 * band's contours and glow still run behind the header as one dark panel.
 */
export function DashboardFrame({ band, children, busy = false }: { band: ReactNode; children?: ReactNode; busy?: boolean }) {
  return (
    <div className="iz-aff-dash">
      <div className="iz-aff-dash__top iz-aff-on-dark">
        <div className="iz-aff-container">
          <AffiliateHeader />
        </div>
      </div>
      <main className="iz-aff-dash__main" aria-busy={busy || undefined}>
        {band}
        {children}
      </main>
    </div>
  );
}

export type HeroBandProps = {
  /** Affiliate name for "Halo, <nama>"; omitted when unknown (error state). */
  name?: string;
  /** Desktop route "Cara kerja komisi" under the title; off when the content area already shows it (no voucher). */
  showRoute?: boolean;
  /** Replaces the greeting, heading, and lead (loading skeleton). */
  intro?: ReactNode;
  /** Right column on desktop, below the heading on phones: warning, ticket, or no-voucher card. */
  children?: ReactNode;
};

/**
 * Dark band at the top of the dashboard (F-025 E7): contours with a calm side behind the copy, one kuning glow, and
 * from 1024 px a dashed kuning road in the right margin. Phones stack greeting, heading, then the card slot; from
 * 1024 px the copy and route sit left and a 560 px card column sits right.
 */
export default function HeroBand({ name, showRoute = true, intro, children }: HeroBandProps) {
  return (
    <div className="iz-aff-band iz-aff-hero">
      <div className="iz-aff-topo" aria-hidden="true" />
      <div className="iz-aff-glow" aria-hidden="true" />
      {/* Stretched to the right margin; non-scaling stroke keeps the dash even at every gutter width. */}
      <svg className="iz-aff-hero__road" viewBox="0 0 160 480" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M24 96 C70 150 86 170 80 270 S116 420 160 470" />
      </svg>
      <div className="iz-aff-container">
        <div className="iz-aff-hero__body">
          <div className="iz-aff-hero__left">
            {intro ?? (
              <div className="iz-aff-hero__intro">
                {name && <p className="iz-aff-hero__hello">Halo, {name}</p>}
                <h1 className="iz-aff-hero__title">Dashboard affiliate</h1>
                <p className="iz-aff-hero__lead">Bagikan link Anda dan pantau komisi dari setiap pesanan.</p>
              </div>
            )}
            {showRoute && !intro && (
              <RouteSteps steps={COMMISSION_STEPS} title={COMMISSION_STEPS_TITLE} tone="dark" orientation="auto" headingLevel={2} className="iz-aff-hero__route" />
            )}
          </div>
          {children && <div className="iz-aff-hero__right">{children}</div>}
        </div>
      </div>
    </div>
  );
}
