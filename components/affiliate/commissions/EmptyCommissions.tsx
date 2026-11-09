import { Copy } from 'lucide-react';
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
}: {
  headingId: string;
  onCopyLink: () => void;
  canCopy: boolean;
}) {
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
        <button type="button" className="iz-aff-btn iz-aff-btn--primary iz-aff-empty__copy" onClick={onCopyLink}>
          <Copy aria-hidden="true" />
          Salin link affiliate
        </button>
      )}
    </section>
  );
}
