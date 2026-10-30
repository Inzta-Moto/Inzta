'use client';

import { useEffect, useId, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MotorCategory } from '@/types';
import { ChevronDown } from '@/components/v2/icons';
import FilterFields, { type FieldGroup } from '@/components/v2/catalog/FilterFields';
import {
  GROUP_TITLES,
  activeCount,
  isGroupVisible,
  isOptionVisible,
  totalActive,
  urutLabel,
  type FacetCounts,
  type FilterChange,
  type FilterState,
  type KeptSelection,
} from '@/components/v2/catalog/filter';

export const PHONE_QUERY = '(max-width: 767px)';

const GROUPS: readonly { group: FieldGroup; title: string }[] = [
  { group: 'posisi', title: GROUP_TITLES.posisi },
  { group: 'harga', title: GROUP_TITLES.harga },
  { group: 'label', title: GROUP_TITLES.label },
  { group: 'urut', title: 'Urutkan' },
];

export function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

// The chip row of produk.dc.html (S2.2), scrolling with the page. Desktop chips open one popover at a time and every tick applies at
// once (results, badge, chips, and URL), with the popover kept open and focus on the ticked input; Escape, an outside
// click, or Tab-out only close it, as there is nothing pending to discard. On phones the chips open the filter sheet
// instead, because the popovers are hidden there (S2.2.7, bundle.css).
export default function FilterBar({
  state,
  facets,
  avail,
  kept,
  category,
  categoryText,
  sheetOpen,
  onChange,
  onOpenSheet,
}: {
  state: FilterState;
  facets: FacetCounts;
  avail: FacetCounts;
  // Decides which options and chips render (isOptionVisible); see CatalogBody.
  kept: KeptSelection;
  category: MotorCategory | null;
  categoryText: string | null;
  sheetOpen: boolean;
  onChange: (change: FilterChange) => void;
  onOpenSheet: (group: FieldGroup | null, opener: HTMLElement) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const [open, setOpen] = useState<FieldGroup | null>(null);
  const chipRefs = useRef<Partial<Record<FieldGroup, HTMLButtonElement | null>>>({});
  const groupRefs = useRef<Partial<Record<FieldGroup, HTMLDivElement | null>>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  const close = (refocus: boolean) => {
    const g = open;
    setOpen(null);
    if (refocus && g) chipRefs.current[g]?.focus();
  };

  // S2.2.6: an outside click closes the popover; focus goes back to its chip unless the click focused something.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (groupRefs.current[open]?.contains(e.target as Node)) return;
      const chip = chipRefs.current[open];
      setOpen(null);
      requestAnimationFrame(() => {
        if (!document.activeElement || document.activeElement === document.body) chip?.focus();
      });
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Focus the selected or first option when a popover opens, so the keyboard lands inside it.
  useEffect(() => {
    if (!open) return;
    const pop = groupRefs.current[open]?.querySelector<HTMLElement>('.iz-popover');
    const target = pop?.querySelector<HTMLInputElement>('input:checked') ?? pop?.querySelector<HTMLInputElement>('input');
    target?.focus();
  }, [open]);

  const toggle = (g: FieldGroup, chip: HTMLButtonElement) => {
    if (window.matchMedia(PHONE_QUERY).matches) {
      setOpen(null);
      onOpenSheet(g, chip);
      return;
    }
    setOpen(open === g ? null : g);
  };

  // "Hapus" removes the link that had focus, so focus moves to the first option of the same popover.
  const clearGroup = (g: Exclude<FieldGroup, 'urut'>) => {
    onChange({ type: 'clearGroup', group: g });
    requestAnimationFrame(() => groupRefs.current[g]?.querySelector<HTMLInputElement>('.iz-popover input')?.focus());
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, g: FieldGroup) => {
    if (e.key === 'Escape' && open === g) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };

  // Tabbing out of an open popover closes it; a null relatedTarget (a click on a label in some browsers, or an
  // option that left the DOM) is ignored so the popover does not close under the pointer.
  const onBlur = (e: ReactFocusEvent<HTMLDivElement>, g: FieldGroup) => {
    if (open !== g) return;
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) setOpen(null);
  };

  const motorOn = category !== null && state.motor === category;
  // Hidden while no product carries the category at all (likely until kategoriMotor is filled in, A-049), unless a
  // ?motor= link selected it; then it stays after being turned off, so it does not vanish under the pointer.
  const motorVisible = category !== null && isOptionVisible('motor', category, avail, kept);
  const total = totalActive(state);
  const shownGroups = GROUPS.filter(({ group }) => group === 'urut' || isGroupVisible(group, avail, kept));
  const openShown = open !== null && shownGroups.some(g => g.group === open);

  // Safety net for a catalogue that changes under an open popover (ISR refresh): `open` must not point at a group
  // that no longer renders, and focus goes to the first chip instead of falling to <body>.
  useEffect(() => {
    if (open === null || openShown) return;
    setOpen(null);
    requestAnimationFrame(() => {
      const chips = rootRef.current?.querySelectorAll<HTMLElement>('[data-fchip]') ?? [];
      Array.from(chips).find(c => c.getClientRects().length > 0)?.focus();
    });
  }, [open, openShown]);

  return (
    <div className="iz-filters" ref={rootRef}>
      <button
        className="iz-fchip iz-only-mob"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        data-fchip="sheet"
        onClick={e => onOpenSheet(null, e.currentTarget)}
      >
        <SlidersIcon />
        Buka filter
        {total > 0 && <span className="iz-fcount">{total}</span>}
      </button>
      {category && categoryText && motorVisible && (
        <button
          className={`iz-fchip iz-fchip--motor${motorOn ? ' iz-fchip--active' : ''}`}
          type="button"
          aria-pressed={motorOn}
          data-fchip="motor"
          onClick={() => onChange({ type: 'toggle', group: 'motor', value: category })}
        >
          <span className="iz-motorchip__dot" aria-hidden="true" />
          Motor saya: {categoryText}
        </button>
      )}
      {shownGroups.map(({ group, title }) => {
        const count = group === 'urut' ? 0 : activeCount(state, group);
        const popId = `${uid}-pop-${group}`;
        const isOpen = open === group;
        return (
          <div
            key={group}
            className="iz-fgroup"
            ref={el => {
              groupRefs.current[group] = el;
            }}
            onKeyDown={e => onKeyDown(e, group)}
            onBlur={e => onBlur(e, group)}
          >
            <button
              ref={el => {
                chipRefs.current[group] = el;
              }}
              className="iz-fchip"
              type="button"
              aria-expanded={isOpen}
              aria-controls={popId}
              data-fchip={group}
              onClick={e => toggle(group, e.currentTarget)}
            >
              {group === 'urut' ? `Urutkan: ${urutLabel(state.urut)}` : title}
              {count > 0 && (
                <>
                  {' '}
                  <span className="iz-fcount">{count}</span>
                </>
              )}
              <ChevronDown />
            </button>
            <div className="iz-popover" id={popId} role="group" aria-labelledby={`${popId}-t`} hidden={!isOpen}>
              <span className="iz-popover__title" id={`${popId}-t`}>{title}</span>
              {/* Only the open popover renders its rows; the hidden ones would recount on every tick for nothing. */}
              {isOpen && <FilterFields group={group} state={state} counts={facets} avail={avail} kept={kept} idPrefix={`${uid}-${group}`} onChange={onChange} />}
              {isOpen && group !== 'urut' && count > 0 && (
                <div className="iz-popover__foot">
                  <button className="iz-link" type="button" aria-label={`Hapus filter ${title}`} onClick={() => clearGroup(group)}>
                    Hapus
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
