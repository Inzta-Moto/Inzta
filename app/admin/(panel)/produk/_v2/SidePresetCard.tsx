'use client';

import type { CSSProperties } from 'react';
import type { Side } from '@/types';
import ImageUpload from '@/components/ImageUpload';
import { SIDE_LABEL } from '@/components/v2/product/side';
import SidePreview from './SidePreview';
import type { SaleMode } from './form-v2';
import type { ProductFormV2Api } from './useProductFormV2';

const MODES: { value: SaleMode; title: string; text: string }[] = [
  { value: 'none', title: 'Tanpa varian', text: 'Satu harga, satu stok.' },
  { value: 'side', title: 'Dijual per sisi', text: 'Kiri dan kanan, stok dihitung per sisi.' },
  { value: 'other', title: 'Varian lain', text: 'Warna, ukuran, atau pilihan lain.' },
];

// Digits only, shown with thousand dots, like the page's simple price field.
const money = (raw: string) => {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? parseInt(digits, 10).toLocaleString('id-ID') : '';
};

const cell: CSSProperties = { padding: '8px 10px', verticalAlign: 'middle', borderTop: '1px solid #F3F4F6' };
const head: CSSProperties = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: 12 };
const prefixed: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };

/**
 * Card "Varian" of admin-sisi.dc.html (F-016 S4.6) in the existing admin style. The radiogroup replaces the old
 * "Tipe Produk" toggle: "Tanpa varian" shows the simple fields, "Varian lain" the existing attribute builder and
 * variant table (unchanged, rendered by the page), "Dijual per sisi" the side table, the Sepasang switch, and the
 * live preview.
 */
export default function SidePresetCard({ v2, name, slug }: { v2: ProductFormV2Api; name: string; slug: string }) {
  const { state } = v2;
  return (
    <div className="prod-form-card">
      <div className="prod-form-card-title">Varian</div>
      <p className="prod-form-hint" style={{ marginTop: -4, marginBottom: 12 }}>
        Pilih cara produk ini dijual. Bisa diubah kapan saja sebelum ada pesanan.
      </p>
      <div role="radiogroup" aria-label="Cara produk dijual" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {MODES.map(m => {
          const checked = state.mode === m.value;
          return (
            <label
              key={m.value}
              htmlFor={`vt-${m.value}`}
              style={{
                display: 'flex', flexDirection: 'column', gap: 2, padding: 12, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${checked ? '#1a1a1a' : '#E5E7EB'}`, background: checked ? '#F9FAFB' : '#fff',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id={`vt-${m.value}`} type="radio" name="vt" checked={checked} onChange={() => v2.setMode(m.value)} />
                <b style={{ fontSize: 13 }}>{m.title}</b>
              </span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{m.text}</span>
            </label>
          );
        })}
      </div>

      {state.mode === 'side' && (
        <>
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={head}>Sisi</th>
                  <th style={head}>Harga</th>
                  <th style={head}>Harga coret</th>
                  <th style={head}>Stok</th>
                  <th style={head}>Foto terpasang</th>
                </tr>
              </thead>
              <tbody>
                {(['kiri', 'kanan'] as Side[]).map(s => {
                  const r = state.rows[s];
                  const label = SIDE_LABEL[s];
                  return (
                    <tr key={s}>
                      <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 600 }}>{label}</th>
                      <td style={cell}>
                        <span style={prefixed}>
                          <small aria-hidden="true">Rp</small>
                          <input className="form-input" inputMode="numeric" aria-label={`Harga ${s}`} value={r.price} placeholder="0" onChange={e => v2.updateRow(s, { price: money(e.target.value) })} style={{ width: 110, fontSize: 13, padding: '6px 8px' }} />
                        </span>
                      </td>
                      <td style={cell}>
                        <span style={prefixed}>
                          <small aria-hidden="true">Rp</small>
                          <input className="form-input" inputMode="numeric" aria-label={`Harga coret ${s}`} value={r.compareAt} placeholder="-" onChange={e => v2.updateRow(s, { compareAt: money(e.target.value) })} style={{ width: 110, fontSize: 13, padding: '6px 8px' }} />
                        </span>
                      </td>
                      <td style={cell}>
                        <input className="form-input" type="number" min={0} step={1} aria-label={`Stok ${s}`} value={r.stock} onChange={e => v2.updateRow(s, { stock: e.target.value })} style={{ width: 80, fontSize: 13, padding: '6px 8px' }} />
                      </td>
                      <td style={cell}>
                        <div role="group" aria-label={`Foto ${s}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ImageUpload value={r.images} onChange={urls => v2.updateRow(s, { images: urls.slice(0, 1) })} max={1} />
                          <small style={{ color: '#6B7280' }}>{`Foto ${s}`}</small>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 16, padding: 12, border: '1px solid #E5E7EB', borderRadius: 8 }}>
            <button
              type="button"
              role="switch"
              aria-checked={state.bisaSepasang}
              aria-label="Bisa dibeli sepasang"
              onClick={() => v2.setBisaSepasang(!state.bisaSepasang)}
              style={{ flex: 'none', width: 44, height: 26, borderRadius: 999, border: 0, cursor: 'pointer', position: 'relative', background: state.bisaSepasang ? '#1a1a1a' : '#D1D5DB' }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', top: 3, left: state.bisaSepasang ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 160ms' }} />
            </button>
            <div>
              <b style={{ display: 'block', fontSize: 13 }}>Bisa dibeli sepasang</b>
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                Di halaman produk muncul pilihan &quot;Sepasang&quot; (kiri + kanan). Harganya otomatis dua kali harga satu sisi, dan stok diambil dari masing-masing sisi.
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <SidePreview state={state} name={name} slug={slug} />
          </div>
        </>
      )}
    </div>
  );
}
