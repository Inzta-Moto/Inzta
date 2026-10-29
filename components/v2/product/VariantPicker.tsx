import type { Ref } from 'react';
import type { ProductAttribute, ProductVariant } from '@/types';
import { isValueAvailable } from '@/lib/product-utils';

/**
 * Generic variant picker (F-016 S3.3.9) for variable products that are not side-sold: one fieldset per attribute with
 * native radios. A value with no active variant left for the current selection is disabled (isValueAvailable, as the
 * old VariantSelector). The SKU/label line of the old page is not shown.
 */
export default function VariantPicker({
  attributes,
  variants,
  selection,
  onSelect,
  name,
  containerRef,
}: {
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  selection: Record<string, string>;
  onSelect: (attribute: string, value: string) => void;
  name: string;
  containerRef?: Ref<HTMLDivElement>;
}) {
  const active = variants.filter(v => v.isActive);
  return (
    <div className="iz-vpick" ref={containerRef}>
      {attributes.map((a, ai) => (
        <fieldset className="iz-vpick__set" key={a.id || a.name}>
          <legend className="iz-field-label">{a.name}</legend>
          <div className="iz-vpick__opts">
            {a.values.map((value, vi) => {
              const id = `${name}-${ai}-${vi}`;
              return (
                <label className="iz-vpick__opt" htmlFor={id} key={value}>
                  <input
                    id={id}
                    type="radio"
                    name={`${name}-${ai}`}
                    value={value}
                    checked={selection[a.name] === value}
                    disabled={!isValueAvailable(active, a.name, value, selection)}
                    onChange={() => onSelect(a.name, value)}
                  />
                  <span>{value}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
