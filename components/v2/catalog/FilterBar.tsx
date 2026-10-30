'use client';

import { useEffect, useId, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MotorCategory } from '@/types';
import { ChevronDown } from '@/components/v2/icons';
import FilterFields, { type FieldGroup } from '@/components/v2/catalog/FilterFields';
import { activeCount, optionCount, totalActive, urutLabel, type CatalogItem, type FilterState } from '@/components/v2/catalog/filter';

export const PHONE_QUERY = '(max-width: 767px)';

const GROUPS: readonly { group: FieldGroup; title: string }[] = [
  { group: 'posisi', title: 'Posisi tas' },
  { group: 'harga', title: 'Harga' },
  { group: 'label', title: 'Label' },
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

// The sticky chip row of produk.dc.html (S2.2). Desktop chips open one popover at a time; nothing applies until
// "Terapkan" and closing discards the pending change (S2.2.1). On phones the chips open the filter sheet instead,
// because the popovers are hidden there (S2.2.7, bundle.css).
export default function FilterBar({
  items,
  state,
  category,
  categoryText,
  sheetOpen,
  onApply,
  onOpenSheet,
}: {
  items: readonly CatalogItem[];
  state: FilterState;
  category: MotorCategory | null;
  categoryText: string | null;
  sheetOpen: boolean;
  onApply: (next: FilterState) => void;
  onOpenSheet: (group: FieldGroup | null, opener: HTMLElement) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const [open, setOpen] = useState<FieldGroup | null>(null);
  const [draft, setDraft] = useState<FilterState>(state);
  const chipRefs = useRef<Partial<Record<FieldGroup, HTMLButtonElement | null>>>({});
  const groupRefs = useRef<Partial<Record<FieldGroup, HTMLDivElement | null>>>({});

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

  // Focus the selected or first enabled option when a popover opens, so the keyboard lands inside it.
  useEffect(() => {
    if (!open) return;
    const pop = groupRefs.current[open]?.querySelector<HTMLElement>('.iz-popover');
    const target = pop?.querySelector<HTMLInputElement>('input:checked:not(:disabled)') ?? pop?.querySelector<HTMLInputElement>('input:not(:disabled)');
    target?.focus();
  }, [open]);

  const toggle = (g: FieldGroup, chip: HTMLButtonElement) => {
    if (window.matchMedia(PHONE_QUERY).matches) {
      setOpen(null);
      onOpenSheet(g, chip);
      return;
    }
    if (open === g) {
      setOpen(null);
      return;
    }
    setDraft(state);
    setOpen(g);
  };

  const apply = () => {
    const g = open;
    setOpen(null);
    if (g) chipRefs.current[g]?.focus();
    onApply(draft);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, g: FieldGroup) => {
    if (e.key === 'Escape' && open === g) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    }
  };

  // Tabbing out of an open popover closes it without applying; a null relatedTarget (a click on a label in some
  // browsers) is ignored so the popover does not close under the pointer.
  const onBlur = (e: ReactFocusEvent<HTMLDivElement>, g: FieldGroup) => {
    if (open !== g) return;
    const next = e.relatedTarget as Node | null;
    if (next && !e.currentTarget.contains(next)) setOpen(null);
  };

  const motorOn = category !== null && state.motor === category;
  const motorZero = category !== null && !motorOn && optionCount(items, state, 'motor', category) === 0;
  const total = totalActive(state);

  return (
    <div className="iz-filters">
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
      {category && categoryText && (
        <button
          className={`iz-fchip iz-fchip--motor${motorOn ? ' iz-fchip--active' : ''}`}
          type="button"
          aria-pressed={motorOn}
          disabled={motorZero}
          data-fchip="motor"
          onClick={() => onApply({ ...state, motor: motorOn ? null : category })}
        >
          <span className="iz-motorchip__dot" aria-hidden="true" />
          Motor saya: {categoryText}
          {motorZero && ' (0)'}
        </button>
      )}
      {GROUPS.map(({ group, title }) => {
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
              <FilterFields group={group} draft={isOpen ? draft : state} items={items} idPrefix={`${uid}-${group}`} onChange={setDraft} />
              <button className="iz-btn iz-btn--primary" type="button" style={{ marginTop: 8, minHeight: 48 }} onClick={apply}>
                Terapkan
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
