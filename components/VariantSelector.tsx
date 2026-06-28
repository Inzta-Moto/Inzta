'use client';

import { isValueAvailable } from '@/lib/product-utils';
import type { ProductAttribute, ProductVariant } from '@/types';

interface VariantSelectorProps {
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  selected: Record<string, string>;
  onSelect: (attrName: string, value: string) => void;
}

export default function VariantSelector({ attributes, variants, selected, onSelect }: VariantSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {attributes.map((attr) => (
        <div key={attr.id}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            {attr.name}
            {selected[attr.name] && (
              <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 6 }}>
                : {selected[attr.name]}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {attr.values.map((value) => {
              const available = isValueAvailable(variants, attr.name, value, selected);
              const isSelected = selected[attr.name] === value;

              return (
                <button
                  key={value}
                  onClick={() => available && onSelect(attr.name, value)}
                  disabled={!available}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: isSelected ? '2px solid #1a1a1a' : '1px solid #D1D5DB',
                    background: isSelected ? '#1a1a1a' : '#fff',
                    color: isSelected ? '#fff' : available ? '#374151' : '#9CA3AF',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 400,
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.45,
                    textDecoration: available ? 'none' : 'line-through',
                    transition: 'all 0.15s',
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
