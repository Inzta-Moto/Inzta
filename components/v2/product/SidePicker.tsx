import type { Ref } from 'react';
import type { SideChoice, SidePickerData } from '@/types';
import { formatRupiah } from '@/lib/v2/home-data';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, InfoIcon, PairIcon } from '@/components/v2/product/product-icons';

const ICON = { kiri: ArrowLeftIcon, kanan: ArrowRightIcon, sepasang: PairIcon } as const;
const SUB: Record<SideChoice, string> = { kiri: '1 tas', kanan: '1 tas', sepasang: 'Kiri + kanan' };
// The canvas ids end in -kiri, -kanan, -pair (produk-sisi.dc.html).
const ID_SUFFIX: Record<SideChoice, string> = { kiri: 'kiri', kanan: 'kanan', sepasang: 'pair' };

/**
 * Side picker of produk-sisi.dc.html (F-016 S4.2), shared by the buy box and the admin preview (S4.6). Native radios in
 * one group, so arrow keys move and select; nothing is preselected (S4.2.1). A sold-out option is a disabled radio
 * whose reason sits inside its label (S4.2.5). Without JavaScript the radios still work as plain controls.
 */
export default function SidePicker({
  data,
  choice,
  onChoice,
  name,
  waHref,
  fieldsetRef,
}: {
  data: SidePickerData;
  choice: SideChoice | null;
  onChoice: (c: SideChoice) => void;
  name: string;
  waHref: string;
  fieldsetRef?: Ref<HTMLFieldSetElement>;
}) {
  const [noteBefore, noteAfter] = data.note ? data.note.split('Tanya admin') : [null, null];
  return (
    <fieldset className="iz-side" ref={fieldsetRef}>
      <legend className="iz-side__head">
        <span className="iz-field-label">Pilih sisi</span>
        <span className="iz-side__hint">
          <InfoIcon />
          Dilihat dari posisi duduk pengendara
        </span>
      </legend>
      <div className="iz-side__opts">
        {data.options.map(o => {
          const Icon = ICON[o.choice];
          const id = `${name}-${ID_SUFFIX[o.choice]}`;
          return (
            <label className="iz-sideopt" htmlFor={id} key={o.choice}>
              <input
                id={id}
                type="radio"
                name={name}
                value={ID_SUFFIX[o.choice]}
                checked={choice === o.choice}
                disabled={o.disabled}
                onChange={() => onChoice(o.choice)}
              />
              <span className="iz-sideopt__icon">
                <Icon />
              </span>
              <span className="iz-sideopt__name">{o.label}</span>
              <span className="iz-sideopt__sub">{SUB[o.choice]}</span>
              <span className="iz-sideopt__price">{formatRupiah(o.price)}</span>
              {o.choice === 'sepasang' && !o.disabled && <span className="iz-sideopt__tag">2 tas</span>}
              <span className="iz-sideopt__check">
                <CheckIcon />
              </span>
              {o.reason && <span className="iz-sideopt__out">{o.reason}</span>}
            </label>
          );
        })}
      </div>
      {data.note && (
        <p className="iz-side__note">
          {noteBefore}
          <a href={waHref} target="_blank" rel="noopener noreferrer">Tanya admin</a>
          {noteAfter}
        </p>
      )}
    </fieldset>
  );
}
