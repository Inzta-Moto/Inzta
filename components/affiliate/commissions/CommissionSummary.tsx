import { Clock } from 'lucide-react';
import { formatRupiah, splitRatio, summaryCaption, type Summary } from '@/lib/affiliate/dashboard';

/**
 * Commission summary (E9, the four numbers of D-2): total, split bar, paid, unpaid, pending count. Below 768 px it is
 * its own card with paid and unpaid side by side and the pending count underneath; from 768 px CommissionsSection
 * puts it in the left column of the combined card, where the same numbers read as a ruled list. Zero commissions give
 * Rp0 and an empty bar (E14).
 */
export default function CommissionSummary({ summary }: { summary: Summary }) {
  const ratio = splitRatio(summary);
  const hasSplit = ratio.paid + ratio.pending > 0;

  return (
    <div className="iz-aff-card iz-aff-sum">
      <div className="iz-aff-sum__head">
        <p className="iz-aff-sum__label">Total komisi</p>
        <p className="iz-aff-sum__total iz-aff-num">{formatRupiah(summary.total)}</p>
        <p className="iz-aff-sum__caption">{summaryCaption(summary)}</p>
      </div>

      {/* Decorative: the two amounts are written out right below. Flex grow keeps both parts inside the card. */}
      <div className={`iz-aff-split${hasSplit ? '' : ' iz-aff-split--empty'}`} aria-hidden="true">
        {ratio.paid > 0 && <span className="iz-aff-split__paid" style={{ flexGrow: ratio.paid }} />}
        {ratio.pending > 0 && <span className="iz-aff-split__pending" style={{ flexGrow: ratio.pending }} />}
      </div>

      <dl className="iz-aff-sum__list">
        <div className="iz-aff-sum__item iz-aff-sum__item--paid">
          <dt>
            <span className="iz-aff-sum__key" aria-hidden="true" />
            Sudah cair
          </dt>
          <dd className="iz-aff-num">{formatRupiah(summary.paid)}</dd>
        </div>
        <div className="iz-aff-sum__item iz-aff-sum__item--pending">
          <dt>
            <span className="iz-aff-sum__key" aria-hidden="true" />
            Belum cair
          </dt>
          <dd className="iz-aff-num">{formatRupiah(summary.pending)}</dd>
        </div>
        {/* Wide layout: label left, count right (FR-05). */}
        <div className="iz-aff-sum__item iz-aff-sum__item--count iz-aff-sum__wide">
          <dt>
            <Clock className="iz-aff-sum__clock" aria-hidden="true" />
            <span>
              Transaksi pending
              <span className="iz-aff-sum__sub">Menunggu dicek admin</span>
            </span>
          </dt>
          <dd className="iz-aff-num">{summary.pendingCount}</dd>
        </div>
      </dl>

      {/* Phone layout: one sentence with the count first (FR-04). */}
      <div className="iz-aff-sum__pending iz-aff-sum__narrow">
        <span className="iz-aff-sum__ptile" aria-hidden="true">
          <Clock />
        </span>
        <p>
          <strong className="iz-aff-num">{`${summary.pendingCount} transaksi pending`}</strong>
          <span className="iz-aff-sum__sub">Menunggu dicek admin</span>
        </p>
      </div>
    </div>
  );
}
