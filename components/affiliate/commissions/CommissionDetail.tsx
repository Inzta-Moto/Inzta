'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Copy, MessageCircle } from 'lucide-react';
import {
  commissionLines,
  commissionQuestionText,
  formatDateShort,
  formatDateTime,
  formatRupiah,
  whatsappUrl,
  type AffCommission,
} from '@/lib/affiliate/dashboard';
import Modal from './Modal';
import StatusTile from './StatusTile';
import { priceText } from './model';

type StopState = 'done' | 'current' | 'todo';

const STOP_STATE_TEXT: Record<StopState, string> = { done: 'selesai', current: 'sedang berjalan', todo: 'belum' };

/**
 * Copy handler from the page. It may return a promise of success: the page's toast sits outside the modal, under the
 * scrim and inside the inert page, so the detail then shows its own short confirmation next to the Order ID.
 */
export type CopyText = (text: string, okMessage: string) => void | Promise<boolean>;

/**
 * Transaction detail (E12, D-10): every item of the order, Harga, Komisi Anda, Tanggal, the Order ID with a small copy
 * button, a three-stop timeline, and "Tanya admin soal transaksi ini" on WhatsApp. "Dicek admin" has no time because
 * the system does not record one; a pending commission waits at "Komisi cair". Harga is productPrice as stored, which for multi-item orders is the first item's
 * price (data note from the helpers task). No payout schedule (Q-6).
 */
export default function CommissionDetail({
  commission,
  onClose,
  returnFocusTo,
  waNumber,
  voucherCode = '',
  onCopyText,
}: {
  commission: AffCommission | null;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
  waNumber: string;
  voucherCode?: string;
  onCopyText: CopyText;
}) {
  const c = commission;
  return (
    <Modal
      open={!!c}
      onClose={onClose}
      title="Detail transaksi"
      returnFocusTo={returnFocusTo}
      footer={
        c && (
          <a
            className="iz-aff-btn iz-aff-btn--ghost iz-aff-btn--block"
            href={whatsappUrl(waNumber, commissionQuestionText(c, voucherCode))}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Tanya admin soal transaksi ini
            <span className="iz-aff-sr-only"> (WhatsApp, tab baru)</span>
          </a>
        )
      }
    >
      {c && <DetailBody c={c} onCopyText={onCopyText} />}
    </Modal>
  );
}

function DetailBody({ c, onCopyText }: { c: AffCommission; onCopyText: CopyText }) {
  const paid = !!c.isPaid;
  const [copy, setCopy] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copyOrderId = async (id: string) => {
    window.clearTimeout(timer.current);
    const result = onCopyText(id, 'Order ID disalin');
    if (!result || typeof (result as Promise<boolean>).then !== 'function') return;
    const ok = await (result as Promise<boolean>).catch(() => false);
    setCopy(ok ? 'ok' : 'fail');
    if (ok) timer.current = window.setTimeout(() => setCopy('idle'), 2500);
  };

  const lines = commissionLines(c);
  const created = formatDateTime(c.createdAt);
  const orderId = typeof c.orderId === 'string' ? c.orderId.trim() : '';
  const stops: { state: StopState; title: string; sub: string }[] = [
    { state: 'done', title: 'Pesanan tercatat', sub: created || 'Tanggal tidak tercatat' },
    // Always done: a commission document is only written when the admin completes the order (REV-02).
    { state: 'done', title: 'Dicek admin', sub: 'Dari Order ID di WhatsApp' },
    { state: paid ? 'done' : 'current', title: 'Komisi cair', sub: paid ? formatDateShort(c.paidAt) || 'Tanggal tidak tercatat' : 'Menunggu dicairkan' },
  ];

  return (
    <div className="iz-aff-detail">
      <div className="iz-aff-detail__product">
        <StatusTile paid={paid} size="lg" />
        <ul className="iz-aff-detail__items" role="list">
          {lines.map((line, i) => (
            <li key={i}>
              <span className="iz-aff-detail__name">{line.name}</span>
              {line.meta && <span className="iz-aff-detail__meta">{line.meta}</span>}
            </li>
          ))}
        </ul>
      </div>

      <dl className="iz-aff-detail__facts">
        <div>
          <dt>Harga</dt>
          <dd className="iz-aff-num">{priceText(c)}</dd>
        </div>
        <div className="iz-aff-detail__strong">
          <dt>Komisi Anda</dt>
          <dd className="iz-aff-num">{formatRupiah(c.commissionAmount ?? 0)}</dd>
        </div>
        <div>
          <dt>Tanggal</dt>
          <dd className="iz-aff-num">{created || '–'}</dd>
        </div>
        {orderId && (
          <div className="iz-aff-detail__order">
            <dt>Order ID</dt>
            <dd>
              <span className="iz-aff-detail__order-id iz-aff-num">{orderId}</span>
              <button type="button" className="iz-aff-detail__copy" aria-label="Salin Order ID" onClick={() => copyOrderId(orderId)}>
                {copy === 'ok' ? <Check aria-hidden="true" strokeWidth={2.5} /> : <Copy aria-hidden="true" />}
              </button>
            </dd>
          </div>
        )}
      </dl>
      {/* Lives inside the dialog, so it is announced while the rest of the page is inert. */}
      <p className={`iz-aff-detail__copied${copy === 'fail' ? ' iz-aff-detail__copied--fail' : ''}`} role="status" aria-live="polite">
        {copy === 'ok' ? 'Order ID disalin' : copy === 'fail' ? 'Gagal menyalin. Tekan lama Order ID di atas, lalu salin manual.' : ''}
      </p>

      <div className="iz-aff-detail__status">
        <h3 className="iz-aff-detail__eyebrow">Status</h3>
        <ol className="iz-aff-timeline" role="list">
          {stops.map((s) => (
            <li key={s.title} className={`iz-aff-timeline__stop iz-aff-timeline__stop--${s.state}`}>
              <span className="iz-aff-timeline__dot" aria-hidden="true">
                {s.state === 'done' && <Check strokeWidth={2.5} />}
                {s.state === 'current' && <Clock strokeWidth={2.25} />}
              </span>
              <span className="iz-aff-timeline__text">
                <span className="iz-aff-timeline__title">
                  {s.title}
                  <span className="iz-aff-sr-only"> ({STOP_STATE_TEXT[s.state]})</span>
                </span>
                <span className="iz-aff-timeline__sub iz-aff-num">{s.sub}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
