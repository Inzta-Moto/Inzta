import { MessageCircle, Ticket } from 'lucide-react';
import { whatsappUrl } from '@/lib/affiliate/dashboard';

/**
 * Replaces the ticket when the affiliate has no voucher code, or the code's voucher document is gone (F-025 E8,
 * FR-09b). The link is built from the code, so without one there is nothing to share yet.
 */
export default function NoVoucherCard({ waNumber }: { waNumber: string }) {
  const chat = whatsappUrl(waNumber, 'Halo Admin INZTA, saya affiliate dan kode voucher saya belum dibuat. Mohon bantuannya.');
  return (
    <section className="iz-aff-ticket iz-aff-ticket--none" aria-labelledby="iz-aff-novoucher-title">
      <div className="iz-aff-ticket__head">
        <span className="iz-aff-ticket__tile iz-aff-ticket__tile--muted" aria-hidden="true">
          <Ticket />
        </span>
        <h2 id="iz-aff-novoucher-title" className="iz-aff-ticket__title iz-aff-ticket__title--lg">
          Kode voucher belum dibuat
        </h2>
      </div>
      <p className="iz-aff-ticket__text">
        Link affiliate memakai kode voucher Anda. Chat admin INZTA untuk meminta kode, lalu link Anda muncul di sini.
      </p>
      <a href={chat} target="_blank" rel="noopener noreferrer" className="iz-aff-btn iz-aff-btn--primary iz-aff-ticket__cta">
        <MessageCircle aria-hidden="true" />
        Chat admin INZTA
      </a>
    </section>
  );
}
