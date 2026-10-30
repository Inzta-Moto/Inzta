'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MotorCategory } from '@/types';
import { Close } from '@/components/v2/icons';
import FilterFields, { MotorField, type FieldGroup } from '@/components/v2/catalog/FilterFields';
import type { CatalogItem, FilterState } from '@/components/v2/catalog/filter';

const GROUPS: readonly { group: FieldGroup; title: string }[] = [
  { group: 'posisi', title: 'Posisi tas' },
  { group: 'harga', title: 'Harga' },
  { group: 'label', title: 'Label' },
  { group: 'urut', title: 'Urutkan' },
];

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

// Phone filter sheet (S2.2.7): a modal bottom sheet that locks page scroll and traps focus. Escape, the backdrop,
// and "Tutup filter" discard the pending change; "Terapkan" applies every group at once. The parent returns focus
// to the control that opened it.
export default function FilterSheet({
  items,
  state,
  category,
  categoryText,
  startGroup,
  onApply,
  onClose,
}: {
  items: readonly CatalogItem[];
  state: FilterState;
  category: MotorCategory | null;
  categoryText: string | null;
  startGroup: FieldGroup | null;
  onApply: (next: FilterState) => void;
  onClose: () => void;
}) {
  const uid = useId().replace(/:/g, '');
  const [draft, setDraft] = useState<FilterState>(state);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = prev;
    };
  }, []);

  // Open on the group whose chip was tapped; "Buka filter" opens on the close button at the top.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const group = startGroup ? panel.querySelector<HTMLElement>(`[data-group="${startGroup}"]`) : null;
    const input = group?.querySelector<HTMLInputElement>('input:checked:not(:disabled)') ?? group?.querySelector<HTMLInputElement>('input:not(:disabled)');
    if (input) {
      group?.scrollIntoView({ block: 'nearest' });
      input.focus();
    } else {
      closeRef.current?.focus();
    }
    // Only on open: later draft changes must not move focus.
  }, []);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null || n === document.activeElement);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="iz-fsheet"
      onPointerDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="iz-fsheet__panel" role="dialog" aria-modal="true" aria-label="Filter" ref={panelRef} onKeyDown={onKeyDown}>
        <div className="iz-fsheet__head">
          <button ref={closeRef} className="iz-fsheet__close" type="button" onClick={onClose}>
            <Close />
            Tutup filter
          </button>
        </div>
        <div className="iz-fsheet__body" data-lenis-prevent>
          {category && categoryText && (
            <div className="iz-fsheet__group" role="group" aria-labelledby={`${uid}-g-motor`} data-group="motor">
              <span className="iz-fsheet__legend" id={`${uid}-g-motor`}>Motor saya</span>
              <MotorField category={category} label={categoryText} draft={draft} items={items} idPrefix={`${uid}-s`} onChange={setDraft} />
            </div>
          )}
          {GROUPS.map(({ group, title }) => (
            <div key={group} className="iz-fsheet__group" role="group" aria-labelledby={`${uid}-g-${group}`} data-group={group}>
              <span className="iz-fsheet__legend" id={`${uid}-g-${group}`}>{title}</span>
              <FilterFields group={group} draft={draft} items={items} idPrefix={`${uid}-s-${group}`} onChange={setDraft} />
            </div>
          ))}
        </div>
        <div className="iz-fsheet__foot">
          <button className="iz-btn iz-btn--primary" type="button" onClick={() => onApply(draft)}>
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
