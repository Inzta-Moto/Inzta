import { Chat } from '@/components/v2/icons';

// S2.4 help card of produk.dc.html: a full grid row after the 8th card. Generic admin contact, so no prefilled
// text (S0.10.2); WhatsApp opens in a new tab (S0.10.1).
export default function HelpCard({ waHref }: { waHref: string }) {
  return (
    <div className="iz-helpcard">
      <div>
        <span className="iz-iconbtn">
          <Chat />
        </span>
        <h3>Bingung memilih?</h3>
        <p>Kirim foto motor Anda ke admin. Kami bantu pilihkan.</p>
      </div>
      <a className="iz-btn iz-btn--primary" href={waHref} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start' }}>
        Chat admin
      </a>
    </div>
  );
}
