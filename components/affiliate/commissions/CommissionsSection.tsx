'use client';

import '@/app/affiliate/affiliate-commissions.css';
import { useCallback, useId, useMemo, useState } from 'react';
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  filterCommissions,
  groupByMonth,
  isFiltered,
  monthOptions,
  monthlySeries,
  statusCounts,
  summarize,
  type AffCommission,
  type Filters,
  type StatusFilter,
} from '@/lib/affiliate/dashboard';
import RouteSteps, { COMMISSION_STEPS, COMMISSION_STEPS_TITLE } from '@/components/affiliate/RouteSteps';
import CommissionSummary from './CommissionSummary';
import CommissionChart from './CommissionChart';
import CommissionToolbar from './CommissionToolbar';
import CommissionList from './CommissionList';
import CommissionTable from './CommissionTable';
import CommissionDetail, { type CopyText } from './CommissionDetail';
import FilterSheet, { type SheetFilters } from './FilterSheet';
import EmptyCommissions from './EmptyCommissions';

export type CommissionsSectionProps = {
  /** Sorted by createdAt descending, dates in epoch ms. */
  commissions: AffCommission[];
  /** Date.now() of the server render: the chart's current month, so server and hydration agree. */
  now: number;
  /** The page renders this section only with a voucher (E8); false also hides "Salin link affiliate" in E14. */
  hasVoucher: boolean;
  /** "Salin link affiliate" in the empty state (E14); the page copies and shows the toast. */
  onCopyLink: () => void;
  /** Order ID copy in the detail (D-10). May return a promise of success for the in-dialog confirmation. */
  onCopyText: CopyText;
  /** WhatsApp number for "Tanya admin soal transaksi ini" (E12). */
  waNumber: string;
  /** Optional: the affiliate's own code, added to the WhatsApp question so the admin knows who asks. */
  voucherCode?: string;
};

/**
 * Commission summary, monthly chart, and transactions of the affiliate dashboard (F-023 E9-E14), inside one 1200 px
 * content column. Below 768 px summary and chart are two cards; from 768 px they share one card with a vertical rule.
 * Below 1024 px a "Cara kerja komisi" card closes the page (from 1024 px the band shows that route). Everything here
 * works on the commissions already loaded by page.tsx: no extra Firestore reads.
 */
export default function CommissionsSection({ commissions, now, hasVoucher, onCopyLink, onCopyText, waNumber, voucherCode = '' }: CommissionsSectionProps) {
  const id = useId();
  const summary = useMemo(() => summarize(commissions), [commissions]);
  const series = useMemo(() => monthlySeries(commissions, now), [commissions, now]);
  const empty = commissions.length === 0;

  return (
    <div className="iz-aff-container iz-aff-comm">
      <section className="iz-aff-overview-sec" aria-labelledby={`${id}-sum`}>
        {/* FR-04/FR-05 draw no visible title over the numbers; the section still needs one for headings navigation. */}
        <h2 id={`${id}-sum`} className="iz-aff-sr-only">
          Ringkasan komisi
        </h2>
        <div className="iz-aff-overview">
          <CommissionSummary summary={summary} />
          <span className="iz-aff-overview__rule" aria-hidden="true" />
          <CommissionChart series={series} />
        </div>
      </section>

      {empty ? (
        <EmptyCommissions headingId={`${id}-tx`} onCopyLink={onCopyLink} canCopy={hasVoucher} />
      ) : (
        <>
          <Transactions headingId={`${id}-tx`} commissions={commissions} onCopyText={onCopyText} waNumber={waNumber} voucherCode={voucherCode} />
          <div className="iz-aff-card iz-aff-howto">
            <RouteSteps steps={COMMISSION_STEPS} orientation="vertical" tone="light" title={COMMISSION_STEPS_TITLE} headingLevel={2} />
          </div>
        </>
      )}
    </div>
  );
}

function Transactions({
  headingId,
  commissions,
  onCopyText,
  waNumber,
  voucherCode,
}: {
  headingId: string;
  commissions: AffCommission[];
  onCopyText: CopyText;
  waNumber: string;
  voucherCode: string;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [detail, setDetail] = useState<{ commission: AffCommission; trigger: HTMLElement } | null>(null);
  const [sheetTrigger, setSheetTrigger] = useState<HTMLElement | null>(null);

  const counts = useMemo(() => statusCounts(commissions), [commissions]);
  const months = useMemo(() => monthOptions(commissions), [commissions]);
  const filtered = useMemo(() => filterCommissions(commissions, filters), [commissions, filters]);
  // Subtotals come from every matching row, so a month cut by "Tampilkan lebih banyak" still shows its full subtotal.
  const groups = useMemo(() => {
    const subtotal = new Map(groupByMonth(filtered).map((g) => [g.key, g.subtotal]));
    return groupByMonth(filtered.slice(0, shown)).map((g) => ({ ...g, subtotal: subtotal.get(g.key) ?? g.subtotal }));
  }, [filtered, shown]);

  // Every filter change starts again from the first page (E11).
  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE_SIZE);
  }, []);
  const reset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setShown(PAGE_SIZE);
  }, []);
  const openDetail = useCallback((commission: AffCommission, trigger: HTMLElement) => setDetail({ commission, trigger }), []);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeSheet = useCallback(() => setSheetTrigger(null), []);
  const applySheet = useCallback(
    (next: SheetFilters) => {
      update({ status: next.status, month: next.month });
      setSheetTrigger(null);
    },
    [update],
  );

  const filtering = isFiltered(filters);

  return (
    <section className="iz-aff-card iz-aff-tx" aria-labelledby={headingId}>
      <div className="iz-aff-tx__head">
        <h2 id={headingId} className="iz-aff-tx__title">
          Transaksi
        </h2>
        <p className="iz-aff-tx__legend">Pending: menunggu dicek admin. Cair: komisi sudah dibayar.</p>
      </div>

      <CommissionToolbar
        filters={filters}
        counts={counts}
        months={months}
        onQuery={(query) => update({ query })}
        onStatus={(status: StatusFilter) => update({ status })}
        onMonth={(month) => update({ month })}
        onOpenSheet={setSheetTrigger}
      />

      <p className="iz-aff-sr-only" role="status" aria-live="polite">
        {filtering ? `${filtered.length} transaksi cocok` : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="iz-aff-nomatch">
          <p className="iz-aff-nomatch__text">Tidak ada transaksi yang cocok.</p>
          <button type="button" className="iz-aff-btn iz-aff-btn--ghost iz-aff-btn--md" onClick={reset}>
            Reset filter
          </button>
        </div>
      ) : (
        <>
          <CommissionList groups={groups} onOpen={openDetail} />
          <CommissionTable groups={groups} onOpen={openDetail} />
          {filtered.length > shown && (
            <div className="iz-aff-more">
              <button type="button" className="iz-aff-btn iz-aff-btn--ghost iz-aff-btn--md" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Tampilkan lebih banyak
              </button>
            </div>
          )}
        </>
      )}

      <CommissionDetail
        commission={detail?.commission ?? null}
        returnFocusTo={detail?.trigger}
        onClose={closeDetail}
        waNumber={waNumber}
        voucherCode={voucherCode}
        onCopyText={onCopyText}
      />
      <FilterSheet
        open={sheetTrigger !== null}
        value={{ status: filters.status, month: filters.month }}
        counts={counts}
        months={months}
        total={commissions.length}
        onApply={applySheet}
        onClose={closeSheet}
        returnFocusTo={sheetTrigger}
      />
    </section>
  );
}
