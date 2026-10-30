'use client';

import { CATEGORY_SLUGS } from '@/lib/v2/motor-category';
import { KATEGORI_LABEL } from './form-v2';
import type { ProductFormV2Api } from './useProductFormV2';

// "Kategori motor" (F-016 D2, S4.6) in the existing admin form style. Unchanged checkboxes write nothing (S4.6.5).
export default function KategoriMotorField({ v2 }: { v2: ProductFormV2Api }) {
  return (
    <div className="prod-form-card">
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="prod-form-card-title">Kategori motor</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {CATEGORY_SLUGS.map(c => (
            <label key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, minHeight: 40, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={v2.state.kategori.includes(c)}
                onChange={e => v2.toggleKategori(c, e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              {KATEGORI_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
