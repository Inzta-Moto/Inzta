'use client';

import { useState } from 'react';
import type { SideChoice } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { fitLabel, formatRupiah, positionOf } from '@/lib/v2/home-data';
import { POSITION_CHIP } from '@/lib/v2/home-content';
import { sidePriceRow } from '@/components/v2/product/side';
import SidePicker from '@/components/v2/product/SidePicker';
import { fontDisplay, fontSans } from '@/components/v2/fonts';
import '@/app/(v2)/v2-tokens.css';
import '@/app/(v2)/v2-components.css';
import '@/app/(v2)/v2-overrides.css';
import { previewData, type FormV2State } from './form-v2';

/**
 * "Pratinjau di halaman produk" of admin-sisi.dc.html (F-016 S4.6): chips, name, price row, and the public SidePicker
 * from the form values, live, without an order button. The only admin part inside `.iz-page`; every v2 selector is
 * scoped to it, so the admin CSS is untouched. The name is a paragraph, not an h1, because the admin page has its own.
 */
export default function SidePreview({ state, name, slug }: { state: FormV2State; name: string; slug: string }) {
  const [choice, setChoice] = useState<SideChoice | null>(null);
  const data = previewData(state);
  if (!data) return null;
  const pos = positionOf({ slug, name: name || '' });
  const fit = fitLabel({ slug, name: name || '' });
  const row = sidePriceRow(data, choice);
  return (
    <div className={`iz-page ${fontDisplay.variable} ${fontSans.variable}`} data-theme="light" style={{ background: 'transparent' }}>
      <aside className="iz-preview" aria-label="Pratinjau di halaman produk">
        <span className="iz-state__label">Pratinjau di halaman produk</span>
        <div className="iz-buybox">
          {(pos || fit?.kind === 'model') && (
            <div className="iz-row" style={{ gap: 8 }}>
              {pos && <span className="iz-cat-chip">{POSITION_CHIP[pos]}</span>}
              {fit?.kind === 'model' && <span className="iz-fit">{fit.text}</span>}
            </div>
          )}
          <p className="t-h1-product" style={{ fontSize: 26 }}>
            {name || 'Nama produk'}
          </p>
          <div className="iz-buybox__price">
            {row.kind === 'range' ? (
              <b>{`${formatRupiah(row.low)} – ${formatRupiah(row.high)}`}</b>
            ) : (
              <b>{formatRupiah(row.price)}</b>
            )}
            <span className="iz-per">/ sisi</span>
            {row.kind === 'single' && row.compareAt !== null && (
              <>
                <s>{formatRupiah(row.compareAt)}</s>
                <span className="iz-save">Hemat {formatRupiah(row.compareAt - row.price)}</span>
              </>
            )}
          </div>
          <SidePicker data={data} choice={choice} onChoice={setChoice} name="pv" waHref={`https://wa.me/${WA_NUMBER}`} />
        </div>
      </aside>
    </div>
  );
}
