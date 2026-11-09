'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { StatusFilter } from '@/lib/affiliate/dashboard';

export type StatusCounts = { all: number; pending: number; paid: number };

const SEGMENTS: { value: StatusFilter; label: string; count: keyof StatusCounts }[] = [
  { value: 'all', label: 'Semua', count: 'all' },
  { value: 'pending', label: 'Pending', count: 'pending' },
  { value: 'paid', label: 'Cair', count: 'paid' },
];

/**
 * "Semua n / Pending n / Cair n" status filter (E11, E13). A radio group with a roving tab stop: Tab enters on the
 * selected segment, arrow keys, Home, and End move and select, like native radios.
 */
export default function SegmentedControl({
  value,
  counts,
  onChange,
  label = 'Status transaksi',
  stretch = false,
}: {
  value: StatusFilter;
  counts: StatusCounts;
  onChange: (value: StatusFilter) => void;
  label?: string;
  /** Segments share the full width (phone toolbar, filter sheet) instead of hugging their text. */
  stretch?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const i = (index + SEGMENTS.length) % SEGMENTS.length;
    onChange(SEGMENTS[i].value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(index - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(SEGMENTS.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className={`iz-aff-seg${stretch ? ' iz-aff-seg--stretch' : ''}`} role="radiogroup" aria-label={label}>
      {SEGMENTS.map((s, i) => {
        const on = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            className="iz-aff-seg__btn"
            onClick={() => onChange(s.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className="iz-aff-seg__label">{s.label}</span>
            <span className="iz-aff-seg__count iz-aff-num">{counts[s.count]}</span>
          </button>
        );
      })}
    </div>
  );
}
