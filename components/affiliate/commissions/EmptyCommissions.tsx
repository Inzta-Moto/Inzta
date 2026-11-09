'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Copy } from 'lucide-react';
import RouteSteps, { COMMISSION_STEPS, COMMISSION_STEPS_TITLE } from '@/components/affiliate/RouteSteps';

/**
 * Transactions card with zero commissions (E14, FR-06a/FR-06b): what happens next, the "Cara kerja komisi" route, and
 * "Salin link affiliate". The toolbar is not shown, there is nothing to search. The copy button is left out when the
 * affiliate has no voucher, because there is no link to copy then.
 */
export default function EmptyCommissions({
  headingId,
  onCopyLink,
  canCopy,
  link = '',
}: {
  headingId: string;
  /** May resolve to the copy outcome, so a failure is shown here instead of only on the ticket far above (REV-04). */
  onCopyLink: () => void | Promise<boolean>;
  canCopy: boolean;
  /** The link as displayed on the ticket (displayLink), shown for manual copying after a failed copy. */
  link?: string;
}) {
  const [failed, setFailed] = useState(false);
  const linkRef = useRef<HTMLSpanElement>(null);
  const failRef = useRef<HTMLDivElement>(null);

  const onCopy = async () => {
    const result = onCopyLink();
    if (!result || typeof (result as Promise<boolean>).then !== 'function') return;
    const ok = await (result as Promise<boolean>).catch(() => false);
    setFailed(!ok);
  };

  // Same as the ticket: the link is pre-selected, so a long press or Ctrl+C is all that is left to do. The button often
  // sits at the bottom of a phone screen, so the hint below it is scrolled just into view.
  useEffect(() => {
    if (!failed || !linkRef.current) return;
    failRef.current?.scrollIntoView({ block: 'nearest' });
    try {
      window.getSelection()?.selectAllChildren(linkRef.current);
    } catch {
      // Selection is a convenience only.
    }
  }, [failed]);

  return (
    <section className="iz-aff-card iz-aff-tx iz-aff-tx--empty" aria-labelledby={headingId}>
      <h2 id={headingId} className="iz-aff-tx__title">
        Transaksi
      </h2>
      <div className="iz-aff-empty">
        <h3 className="iz-aff-empty__title">Belum ada data komisi.</h3>
        <p className="iz-aff-empty__text">Komisi muncul di sini setelah pesanan dari link Anda dicek admin. Mulai dari langkah pertama:</p>
      </div>
      <RouteSteps steps={COMMISSION_STEPS} orientation="vertical" tone="light" title={COMMISSION_STEPS_TITLE} headingLevel={3} />
      {canCopy && (
        <button type="button" className="iz-aff-btn iz-aff-btn--primary iz-aff-empty__copy" onClick={onCopy}>
          <Copy aria-hidden="true" />
          Salin link affiliate
        </button>
      )}
      {canCopy && failed && link && (
        <div ref={failRef} className="iz-aff-empty__fail" role="alert">
          <span ref={linkRef} className="iz-aff-empty__link" translate="no">
            {link}
          </span>
          <p className="iz-aff-empty__fail-text">
            <AlertTriangle aria-hidden="true" />
            <span>Gagal menyalin. Tekan lama link ini, lalu salin manual.</span>
          </p>
        </div>
      )}
    </section>
  );
}
