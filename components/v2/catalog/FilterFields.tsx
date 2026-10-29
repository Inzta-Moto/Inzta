'use client';

import type { MotorCategory } from '@/types';
import {
  HARGA_OPTIONS,
  LABEL_OPTIONS,
  POSISI_OPTIONS,
  URUT_OPTIONS,
  optionCount,
  toggleList,
  type CatalogItem,
  type FilterState,
} from '@/components/v2/catalog/filter';

export type FieldGroup = 'posisi' | 'harga' | 'label' | 'urut';

// The .iz-check rows of one group, shared by the desktop popover and the phone sheet (S2.2). Counts are taken
// against the pending state of the other groups; an option with no result is disabled and shows "(0)" unless it is
// already selected, so it can always be turned off (S2.2.5).
export default function FilterFields({
  group,
  draft,
  items,
  idPrefix,
  onChange,
}: {
  group: FieldGroup;
  draft: FilterState;
  items: readonly CatalogItem[];
  idPrefix: string;
  onChange: (next: FilterState) => void;
}) {
  if (group === 'posisi') {
    return (
      <>
        {POSISI_OPTIONS.map(o => {
          const checked = draft.posisi.includes(o.value);
          const zero = !checked && optionCount(items, draft, 'posisi', o.value) === 0;
          const id = `${idPrefix}-pos-${o.value}`;
          return (
            <label key={o.value} className="iz-check" htmlFor={id}>
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={zero}
                onChange={() => onChange({ ...draft, posisi: toggleList(draft.posisi, o.value, POSISI_OPTIONS) })}
              />
              {o.label}
              {zero && ' (0)'}
            </label>
          );
        })}
      </>
    );
  }
  if (group === 'label') {
    return (
      <>
        {LABEL_OPTIONS.map(o => {
          const checked = draft.label.includes(o.value);
          const zero = !checked && optionCount(items, draft, 'label', o.value) === 0;
          const id = `${idPrefix}-label-${o.value}`;
          return (
            <label key={o.value} className="iz-check" htmlFor={id}>
              <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={zero}
                onChange={() => onChange({ ...draft, label: toggleList(draft.label, o.value, LABEL_OPTIONS) })}
              />
              {o.label}
              {zero && ' (0)'}
            </label>
          );
        })}
      </>
    );
  }
  if (group === 'harga') {
    return (
      <>
        {HARGA_OPTIONS.map(o => {
          const checked = draft.harga === o.value;
          const zero = !checked && optionCount(items, draft, 'harga', o.value) === 0;
          const id = `${idPrefix}-harga-${o.value}`;
          return (
            <label key={o.value} className="iz-check" htmlFor={id}>
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-harga`}
                checked={checked}
                disabled={zero}
                onChange={() => onChange({ ...draft, harga: o.value })}
                // The group has no "all prices" option in the canvas: activating the chosen band again clears it.
                onClick={() => {
                  if (checked) onChange({ ...draft, harga: null });
                }}
              />
              {o.label}
              {zero && ' (0)'}
            </label>
          );
        })}
      </>
    );
  }
  return (
    <>
      {URUT_OPTIONS.map(o => {
        const id = `${idPrefix}-urut-${o.value}`;
        return (
          <label key={o.value} className="iz-check" htmlFor={id}>
            <input id={id} type="radio" name={`${idPrefix}-urut`} checked={draft.urut === o.value} onChange={() => onChange({ ...draft, urut: o.value })} />
            {o.label}
          </label>
        );
      })}
    </>
  );
}

// The "Motor saya" row of the phone sheet (S2.2.7): one checkbox for the stored category.
export function MotorField({
  category,
  label,
  draft,
  items,
  idPrefix,
  onChange,
}: {
  category: MotorCategory;
  label: string;
  draft: FilterState;
  items: readonly CatalogItem[];
  idPrefix: string;
  onChange: (next: FilterState) => void;
}) {
  const checked = draft.motor === category;
  const zero = !checked && optionCount(items, draft, 'motor', category) === 0;
  const id = `${idPrefix}-motor`;
  return (
    <label className="iz-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} disabled={zero} onChange={() => onChange({ ...draft, motor: checked ? null : category })} />
      {label}
      {zero && ' (0)'}
    </label>
  );
}
