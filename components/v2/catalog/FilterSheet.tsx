'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MotorCategory } from '@/types';
import { Close } from '@/components/v2/icons';
import FilterFields, { MotorField, type FieldGroup } from '@/components/v2/catalog/FilterFields';
import {
  GROUP_TITLES,
  facetCounts,
  isGroupVisible,
  isOptionVisible,
  reduceFilter,
  type CatalogItem,
  type FacetCounts,
  type FilterChange,
  type FilterState,
  type KeptSelection,
} from '@/components/v2/catalog/filter';

const GROUPS: readonly { group: FieldGroup; title: string }[] = [
  { group: 'posisi', title: GROUP_TITLES.posisi },
  { group: 'harga', title: GROUP_TITLES.harga },
  { group: 'label', title: GROUP_TITLES.label },
  { group: 'urut', title: 'Urutkan' },
];

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])';

// Phone filter sheet (S2.2.7): a modal bottom sheet that locks page scroll and traps focus. Changes stay in a draft,
// built with the same reduceFilter as the desktop bar, because the page behind is covered: the primary button says
// how many products the draft gives before anything applies. Escape, the backdrop, and "Tutup filter" discard the
// draft. The parent returns focus to the control that opened it.
export default function FilterSheet({
  items,
  state,
  avail,
  kept,
  category,
  categoryText,
  startGroup,
  onApply,
  onClose,
}: {
  items: readonly CatalogItem[];
  state: FilterState;
  avail: FacetCounts;
  // The applied state is already in it and the draft can only tick visible options, so rows never unmount here.
  kept: KeptSelection;
  category: MotorCategory | null;
  categoryText: string | null;
  startGroup: FieldGroup | null;
  onApply: (next: FilterState) => void;
  onClose: () => void;
}) {
  const uid = useId().replace(/:/g, '');
  const [initial] = useState(state);
  const [draft, setDraft] = useState<FilterState>(state);
  const panelRef = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  // reduceFilter returns the same object when nothing changes, so the identity is a valid memo key.
  const facets = useMemo(() => facetCounts(items, draft), [items, draft]);
  const n = facets.total;

  const change = (c: FilterChange) => setDraft(d => reduceFilter(d, c));

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
    const input = group?.querySelector<HTMLInputElement>('input:checked') ?? group?.querySelector<HTMLInputElement>('input');
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

  const showMotor = !!category && !!categoryText && isOptionVisible('motor', category, avail, kept);

  // The backdrop closes on click, after the whole tap: closing on pointerdown let the touch's emulated mousedown land
  // on the page behind once the sheet was gone, which moved focus to <body> after the opener got it back. A press that
  // starts inside the panel (a scroll drag released on the backdrop) does not close it.
  return (
    <div
      className="iz-fsheet"
      onPointerDown={e => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={e => {
        const close = downOnBackdrop.current && e.target === e.currentTarget;
        downOnBackdrop.current = false;
        if (close) onClose();
      }}
    >
      {/* tabIndex -1: a press on the panel's padding or a legend keeps focus in the dialog instead of moving it to
          <body>, where Escape and the Tab trap would no longer reach it. */}
      <div className="iz-fsheet__panel" role="dialog" aria-modal="true" aria-label="Filter" tabIndex={-1} ref={panelRef} onKeyDown={onKeyDown}>
        <div className="iz-fsheet__head">
          <button ref={closeRef} className="iz-fsheet__close" type="button" onClick={onClose}>
            <Close />
            Tutup filter
          </button>
        </div>
        <div className="iz-fsheet__body" data-lenis-prevent>
          {showMotor && category && categoryText && (
            <div className="iz-fsheet__group" role="group" aria-labelledby={`${uid}-g-motor`} data-group="motor">
              <span className="iz-fsheet__legend" id={`${uid}-g-motor`}>{GROUP_TITLES.motor}</span>
              <MotorField category={category} label={categoryText} state={draft} counts={facets} idPrefix={`${uid}-s`} onChange={change} />
            </div>
          )}
          {GROUPS.map(({ group, title }) =>
            group !== 'urut' && !isGroupVisible(group, avail, kept) ? null : (
              <div key={group} className="iz-fsheet__group" role="group" aria-labelledby={`${uid}-g-${group}`} data-group={group}>
                <span className="iz-fsheet__legend" id={`${uid}-g-${group}`}>{title}</span>
                <FilterFields group={group} state={draft} counts={facets} avail={avail} kept={kept} idPrefix={`${uid}-s-${group}`} onChange={change} />
              </div>
            ),
          )}
        </div>
        <div className="iz-fsheet__foot">
          {/* The button text changes while focus stays on a checkbox, which screen readers do not announce. */}
          <p className="iz-sr" role="status" aria-live="polite">
            {draft === initial ? '' : `${n} produk cocok`}
          </p>
          {n === 0 && <p className="iz-fsheet__note">Tidak ada produk untuk pilihan ini.</p>}
          <div className="iz-fsheet__actions">
            <button className="iz-btn iz-btn--secondary" type="button" onClick={() => change({ type: 'clearAll' })}>
              Reset
            </button>
            <button className="iz-btn iz-btn--primary" type="button" onClick={() => onApply(draft)}>
              {`Tampilkan ${n} produk`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
