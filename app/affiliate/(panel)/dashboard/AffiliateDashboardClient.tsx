'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HeroBand, { DashboardFrame } from '@/components/affiliate/HeroBand';
import AffiliateLinkCard from '@/components/affiliate/AffiliateLinkCard';
import VoucherWarning from '@/components/affiliate/VoucherWarning';
import NoVoucherCard from '@/components/affiliate/NoVoucherCard';
import RouteSteps, { COMMISSION_STEPS, COMMISSION_STEPS_TITLE } from '@/components/affiliate/RouteSteps';
import Toast, { useToast } from '@/components/affiliate/Toast';
import { useCopy } from '@/components/affiliate/useCopy';
import CommissionsSection from '@/components/affiliate/commissions/CommissionsSection';
import { affiliateLink, voucherState, type AffCommission, type AffVoucher } from '@/lib/affiliate/dashboard';
import { WA_NUMBER } from '@/lib/constants';

export type AffiliateDashboardProps = {
  affiliateName: string;
  ownVoucherCode: string;
  /** Whitelisted voucher fields from page.tsx, expiresAt in ms; null when the code or its document is missing. */
  voucher: AffVoucher;
  /** Sorted newest first, dates in ms. */
  commissions: AffCommission[];
  /** Server render time, so the voucher state and the chart match between the server HTML and hydration. */
  now: number;
};

/**
 * "Cara kerja komisi" in place of the summary and transactions when there is no voucher (E8, FR-09b), at every width.
 * Its own class, not CommissionsSection's .iz-aff-howto, which hides from 1024 px where the band shows the route.
 */
function NoVoucherHowItWorks() {
  return (
    <div className="iz-aff-container">
      <section className="iz-aff-card iz-aff-novoucher-howto">
        <RouteSteps steps={COMMISSION_STEPS} title={COMMISSION_STEPS_TITLE} tone="light" orientation="vertical" headingLevel={2} />
      </section>
    </div>
  );
}

export default function AffiliateDashboardClient({ affiliateName, ownVoucherCode, voucher, commissions, now }: AffiliateDashboardProps) {
  const router = useRouter();
  const toast = useToast();
  const { copiedKey, failedKey, copy } = useCopy(toast.show);

  // F-021: the session is verified on the server here, so record the affiliate's own code for "Salin link" (also
  // backfills sessions that logged in before F-021 and have no inzta_affiliate_own yet).
  useEffect(() => {
    try {
      localStorage.setItem('is_affiliate_logged_in', 'true');
      localStorage.setItem('inzta_affiliate_own', ownVoucherCode);
    } catch {}
  }, [ownVoucherCode]);

  useEffect(() => {
    const onFocus = () => {
      router.refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [router]);

  const state = voucherState(ownVoucherCode, voucher, now);
  const hasVoucher = state !== 'missing';
  const code = ownVoucherCode.trim();

  const onCopyLink = useCallback(() => {
    void copy('link', affiliateLink(code), 'Link disalin');
  }, [copy, code]);
  // The empty state's own key keeps the ticket's failure hint out of it: the hint shows next to the button pressed,
  // and only one alert is announced (REV-04).
  const onCopyLinkEmpty = useCallback(() => copy('link-empty', affiliateLink(code), 'Link disalin'), [copy, code]);
  const onCopyCode = useCallback(() => {
    void copy('code', code, 'Kode disalin');
  }, [copy, code]);
  // Returns the outcome, so the transaction detail can show its own failure hint next to the Order ID.
  const onCopyText = useCallback((text: string, okMessage: string) => copy('text', text, okMessage), [copy]);

  const band = (
    // Without a voucher the content card already explains the route, so the band does not repeat it on desktop.
    <HeroBand name={affiliateName} showRoute={hasVoucher}>
      {hasVoucher ? (
        <>
          {(state === 'expired' || state === 'inactive') && <VoucherWarning code={code} state={state} waNumber={WA_NUMBER} />}
          <AffiliateLinkCard code={code} voucher={voucher} copiedKey={copiedKey} failedKey={failedKey} onCopyLink={onCopyLink} onCopyCode={onCopyCode} />
        </>
      ) : (
        <NoVoucherCard waNumber={WA_NUMBER} />
      )}
    </HeroBand>
  );

  return (
    <>
      <DashboardFrame band={band}>
        <div className="iz-aff-content">
          <div className="iz-aff-topo iz-aff-topo--ink iz-aff-topo--fade iz-aff-content__topo" aria-hidden="true" />
          {/* CommissionsSection brings its own 1200 px container and its closing "Cara kerja komisi" card. */}
          {hasVoucher ? (
            <CommissionsSection
              commissions={commissions}
              now={now}
              hasVoucher={hasVoucher}
              onCopyLink={onCopyLinkEmpty}
              onCopyText={onCopyText}
              waNumber={WA_NUMBER}
              voucherCode={code}
            />
          ) : (
            <NoVoucherHowItWorks />
          )}
        </div>
      </DashboardFrame>
      <Toast message={toast.message} open={toast.open} />
    </>
  );
}
