'use client';

import { useId } from 'react';
import { ChevronDown, Search, SlidersVertical } from 'lucide-react';
import type { Filters, StatusFilter } from '@/lib/affiliate/dashboard';
import SegmentedControl, { type StatusCounts } from './SegmentedControl';

export type MonthOption = { key: string; label: string; count: number };

/**
 * Transaction toolbar (E11): product search, the month filter, and the status segments. From 1024 px one row (search
 * 320 px, "Semua bulan" menu, segments on the right); below that search plus a 48 px filter button, segments
 * underneath, and the month is picked in the filter sheet (E13). Both month controls are rendered and CSS shows the
 * one for the width, so server and client markup match. Filtering itself happens in CommissionsSection.
 */
export default function CommissionToolbar({
  filters,
  counts,
  months,
  onQuery,
  onStatus,
  onMonth,
  onOpenSheet,
}: {
  filters: Filters;
  counts: StatusCounts;
  months: MonthOption[];
  onQuery: (query: string) => void;
  onStatus: (status: StatusFilter) => void;
  onMonth: (month: string) => void;
  /** Opens the filter sheet; receives the button so focus can return to it. */
  onOpenSheet: (trigger: HTMLButtonElement) => void;
}) {
  const id = useId();
  const searchId = `${id}-search`;
  const monthId = `${id}-month`;
  const sheetFilters = (filters.status !== 'all' ? 1 : 0) + (filters.month !== 'all' ? 1 : 0);
  // A month that disappeared from the data (should not happen) falls back to "Semua bulan" in the menu.
  const monthValue = filters.month === 'all' || months.some((m) => m.key === filters.month) ? filters.month : 'all';

  return (
    <div className="iz-aff-toolbar">
      <div className="iz-aff-toolbar__search">
        <label htmlFor={searchId} className="iz-aff-sr-only">
          Cari nama produk
        </label>
        <Search className="iz-aff-toolbar__search-icon" aria-hidden="true" />
        <input
          id={searchId}
          className="iz-aff-toolbar__input"
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Cari produk…"
          value={filters.query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <div className="iz-aff-toolbar__month">
        <label htmlFor={monthId} className="iz-aff-sr-only">
          Bulan
        </label>
        <select id={monthId} className="iz-aff-toolbar__select" value={monthValue} onChange={(e) => onMonth(e.target.value)}>
          <option value="all">Semua bulan</option>
          {months.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <ChevronDown className="iz-aff-toolbar__chevron" aria-hidden="true" />
      </div>

      <button
        type="button"
        className="iz-aff-iconbtn iz-aff-iconbtn--lg iz-aff-toolbar__filter"
        aria-label={sheetFilters ? `Filter transaksi, ${sheetFilters} aktif` : 'Filter transaksi'}
        aria-haspopup="dialog"
        onClick={(e) => onOpenSheet(e.currentTarget)}
      >
        <SlidersVertical aria-hidden="true" />
        {sheetFilters > 0 && (
          <span className="iz-aff-toolbar__badge iz-aff-num" aria-hidden="true">
            {sheetFilters}
          </span>
        )}
      </button>

      <div className="iz-aff-toolbar__seg">
        <SegmentedControl value={filters.status} counts={counts} onChange={onStatus} stretch />
      </div>
    </div>
  );
}
