'use client';

import { useId, useState } from 'react';
import { Check } from 'lucide-react';
import type { StatusFilter } from '@/lib/affiliate/dashboard';
import Modal from './Modal';
import SegmentedControl, { type StatusCounts } from './SegmentedControl';
import type { MonthOption } from './CommissionToolbar';

export type SheetFilters = { status: StatusFilter; month: string };

/**
 * Phone filter sheet (E13, FR-14): status segments and a single-choice month list with transaction counts. Choices
 * stay a local draft; "Terapkan" applies them and closes, "Reset" only resets the draft. Counts are over all loaded
 * commissions, as drawn in FR-14.
 */
export default function FilterSheet({
  open,
  value,
  counts,
  months,
  total,
  onApply,
  onClose,
  returnFocusTo,
}: {
  open: boolean;
  value: SheetFilters;
  counts: StatusCounts;
  months: MonthOption[];
  total: number;
  onApply: (next: SheetFilters) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  if (!open) return null;
  return <SheetBody value={value} counts={counts} months={months} total={total} onApply={onApply} onClose={onClose} returnFocusTo={returnFocusTo} />;
}

function SheetBody({
  value,
  counts,
  months,
  total,
  onApply,
  onClose,
  returnFocusTo,
}: Omit<Parameters<typeof FilterSheet>[0], 'open'>) {
  // Mounted on each opening, so the draft always starts from the filters in use.
  const [draft, setDraft] = useState<SheetFilters>(value);
  const name = useId();
  const monthHeadingId = `${name}-bulan`;
  const options: MonthOption[] = [{ key: 'all', label: 'Semua bulan', count: total }, ...months];

  return (
    <Modal
      open
      onClose={onClose}
      title="Filter transaksi"
      returnFocusTo={returnFocusTo}
      footer={
        <div className="iz-aff-sheet__actions">
          <button type="button" className="iz-aff-btn iz-aff-btn--ghost" onClick={() => setDraft({ status: 'all', month: 'all' })}>
            Reset
          </button>
          <button type="button" className="iz-aff-btn iz-aff-btn--primary" onClick={() => onApply(draft)}>
            Terapkan
          </button>
        </div>
      }
    >
      <div className="iz-aff-sheet">
        <div className="iz-aff-sheet__group">
          <h3 className="iz-aff-detail__eyebrow">Status</h3>
          <SegmentedControl value={draft.status} counts={counts} onChange={(status) => setDraft((d) => ({ ...d, status }))} stretch />
        </div>
        <fieldset className="iz-aff-sheet__group iz-aff-sheet__months" aria-labelledby={monthHeadingId}>
          <h3 id={monthHeadingId} className="iz-aff-detail__eyebrow">
            Bulan
          </h3>
          {options.map((m) => {
            const on = draft.month === m.key;
            return (
              <label key={m.key} className={`iz-aff-opt${on ? ' iz-aff-opt--on' : ''}`}>
                <input
                  type="radio"
                  className="iz-aff-opt__input"
                  name={name}
                  value={m.key}
                  checked={on}
                  onChange={() => setDraft((d) => ({ ...d, month: m.key }))}
                />
                <span className="iz-aff-opt__label">{m.label}</span>
                <span className="iz-aff-opt__count iz-aff-num">
                  {m.count}
                  <span className="iz-aff-sr-only"> transaksi</span>
                </span>
                <span className="iz-aff-opt__mark" aria-hidden="true">
                  {on && <Check strokeWidth={2.5} />}
                </span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </Modal>
  );
}
