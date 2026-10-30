'use client';

import type { MotorCategory } from '@/types';
import {
  URUT_OPTIONS,
  countOf,
  isOptionVisible,
  isSelected,
  optionsOf,
  type FacetCounts,
  type FilterChange,
  type FilterState,
  type KeptSelection,
} from '@/components/v2/catalog/filter';

export type FieldGroup = 'posisi' | 'harga' | 'label' | 'urut';

// One .iz-check row with its live count. A count of 0 is muted but never disabled: every change can be undone the
// same way it was made, and a disabled control drops out of the Tab order without saying why. Choosing it shows the
// empty state, which names the cause and offers a way back.
function CheckRow({
  id,
  type,
  name,
  checked,
  label,
  count,
  onChange,
}: {
  id: string;
  type: 'checkbox' | 'radio';
  name?: string;
  checked: boolean;
  label: string;
  count?: number;
  onChange: () => void;
}) {
  const zero = count === 0 && !checked;
  return (
    <label className={`iz-check${zero ? ' iz-check--zero' : ''}`} htmlFor={id}>
      <input id={id} type={type} name={name} checked={checked} onChange={onChange} />
      {label}
      {count !== undefined && <span className="iz-check__count">({count})</span>}
    </label>
  );
}

// The rows of one group, shared by the desktop popover and the phone sheet (S2.2). Counts come from facetCounts()
// of the state the rows belong to (the applied state on desktop, the draft in the sheet). Options no product has are
// left out unless they are or were selected (isOptionVisible with the kept selection), so unticking one never
// unmounts the row that has focus.
export default function FilterFields({
  group,
  state,
  counts,
  avail,
  kept,
  idPrefix,
  onChange,
}: {
  group: FieldGroup;
  state: FilterState;
  counts: FacetCounts;
  avail: FacetCounts;
  kept: KeptSelection;
  idPrefix: string;
  onChange: (change: FilterChange) => void;
}) {
  if (group === 'urut') {
    return (
      <>
        {URUT_OPTIONS.map(o => (
          <CheckRow
            key={o.value}
            id={`${idPrefix}-urut-${o.value}`}
            type="radio"
            name={`${idPrefix}-urut`}
            checked={state.urut === o.value}
            label={o.label}
            onChange={() => onChange({ type: 'urut', value: o.value })}
          />
        ))}
      </>
    );
  }
  const options = optionsOf(group).filter(o => isOptionVisible(group, o.value, avail, kept));
  if (group === 'harga') {
    return (
      <>
        {/* A plain way back to every price, instead of clicking the chosen radio again. */}
        <CheckRow
          id={`${idPrefix}-harga-semua`}
          type="radio"
          name={`${idPrefix}-harga`}
          checked={state.harga === null}
          label="Semua harga"
          count={counts.hargaAll}
          onChange={() => onChange({ type: 'set', group: 'harga', value: null })}
        />
        {options.map(o => (
          <CheckRow
            key={o.value}
            id={`${idPrefix}-harga-${o.value}`}
            type="radio"
            name={`${idPrefix}-harga`}
            checked={state.harga === o.value}
            label={o.label}
            count={countOf(counts, 'harga', o.value)}
            onChange={() => onChange({ type: 'set', group: 'harga', value: o.value })}
          />
        ))}
      </>
    );
  }
  return (
    <>
      {options.map(o => (
        <CheckRow
          key={o.value}
          id={`${idPrefix}-${group === 'posisi' ? 'pos' : 'label'}-${o.value}`}
          type="checkbox"
          checked={isSelected(state, group, o.value)}
          label={o.label}
          count={countOf(counts, group, o.value)}
          onChange={() => onChange({ type: 'toggle', group, value: o.value })}
        />
      ))}
    </>
  );
}

// The "Motor saya" row of the phone sheet (S2.2.7): one checkbox for the stored category, with its count.
export function MotorField({
  category,
  label,
  state,
  counts,
  idPrefix,
  onChange,
}: {
  category: MotorCategory;
  label: string;
  state: FilterState;
  counts: FacetCounts;
  idPrefix: string;
  onChange: (change: FilterChange) => void;
}) {
  return (
    <CheckRow
      id={`${idPrefix}-motor`}
      type="checkbox"
      checked={state.motor === category}
      label={label}
      count={countOf(counts, 'motor', category)}
      onChange={() => onChange({ type: 'toggle', group: 'motor', value: category })}
    />
  );
}
