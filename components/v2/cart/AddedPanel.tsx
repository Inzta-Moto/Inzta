'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Close, CircleCheck } from '@/components/v2/icons';
import { cldWebp } from '@/lib/v2/image';
import { formatRupiah } from '@/lib/v2/home-data';

export interface AddedInfo {
  id: number;
  name: string;
  optionLabel: string | null;
  image: string | null;
  quantity: number;
  unitPrice: number;
  note: string | null;
}

/**
 * F-030 E4: confirmation after "Tambah ke keranjang". It does not block the page and stays until closed (research
 * F-030: a message that fades by itself is easy to miss), with "Lihat keranjang" and "Lanjut belanja". It does not take
 * focus; the line is announced through the live region and Escape closes it.
 */
export default function AddedPanel({ info, onClose }: { info: AddedInfo | null; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const at = document.activeElement;
      if (!at || at === document.body || panel.current?.contains(at)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [info, onClose]);

  return (
    <>
      <p className="iz-sr" role="status" aria-live="polite">
        {info ? `${info.name}${info.optionLabel ? `, ${info.optionLabel}` : ''} masuk keranjang.${info.note ? ` ${info.note}` : ''}` : ''}
      </p>
      <div className="iz-addedzone">
      {info && (
        <section ref={panel} key={info.id} className="iz-added" aria-label="Masuk keranjang">
          <div className="iz-added__head">
            <span className="iz-added__title">
              <CircleCheck width={20} height={20} />
              Masuk keranjang
            </span>
            <button type="button" className="iz-added__close" aria-label="Tutup" onClick={onClose}>
              <Close width={16} height={16} />
            </button>
          </div>
          <div className="iz-added__item">
            {info.image ? <img src={cldWebp(info.image, 144)} alt="" width={56} height={56} /> : <span className="iz-added__ph" aria-hidden="true" />}
            <div>
              <b>{info.name}</b>
              {info.optionLabel && <span>{info.optionLabel}</span>}
              <span>
                {info.quantity} × {formatRupiah(info.unitPrice)}
              </span>
            </div>
          </div>
          {info.note && <p className="iz-added__note">{info.note}</p>}
          <div className="iz-added__actions">
            <Link className="iz-btn iz-btn--primary" href="/keranjang">
              Lihat keranjang
            </Link>
            <button type="button" className="iz-btn iz-btn--secondary" onClick={onClose}>
              Lanjut belanja
            </button>
          </div>
        </section>
      )}
      </div>
    </>
  );
}
