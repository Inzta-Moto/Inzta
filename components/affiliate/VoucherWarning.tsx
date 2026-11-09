import { AlertTriangle } from 'lucide-react';
import { whatsappUrl } from '@/lib/affiliate/dashboard';

/**
 * Warning above the ticket when the affiliate's voucher is expired or switched off (F-023 E8, FR-09a). Commissions
 * are only recorded for active codes, so the panel says that plainly and links to the admin chat.
 */
export default function VoucherWarning({ code, state, waNumber }: { code: string; state: 'expired' | 'inactive'; waNumber: string }) {
  const title = state === 'expired' ? `Kode ${code} sudah kedaluwarsa` : `Kode ${code} sedang dinonaktifkan`;
  const chat = whatsappUrl(
    waNumber,
    `Halo Admin INZTA, saya affiliate dengan kode ${code}. Kode saya ${state === 'expired' ? 'sudah kedaluwarsa' : 'sedang dinonaktifkan'}; mohon bantuannya untuk memperbarui kode.`,
  );
  return (
    <div className="iz-aff-warn">
      <AlertTriangle className="iz-aff-warn__icon" aria-hidden="true" />
      <div className="iz-aff-warn__body">
        <p className="iz-aff-warn__title">{title}</p>
        <p className="iz-aff-warn__text">
          Transaksi baru tidak mendapat komisi.{' '}
          <a href={chat} target="_blank" rel="noopener noreferrer" className="iz-aff-warn__link">
            Chat admin INZTA
          </a>{' '}
          untuk memperbarui kode.
        </p>
      </div>
    </div>
  );
}
