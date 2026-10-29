import { WA_NUMBER } from '@/lib/constants';
import { formatWaDisplay } from '@/lib/v2/home-data';
import { WhatsApp } from '@/components/v2/icons';
import { INSTAGRAM, TOKOPEDIA_URL } from '@/components/v2/about/about-content';

const Bag = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
const External = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

// "Hubungi INZTA." (F-016 S8.6). The number is formatted from WA_NUMBER so it always matches the link (S8.6.1); the
// button has no prefilled text. Shopee has no known URL yet (P-7), so it is a non-interactive row without the arrow
// (S8.6.2). Reply hours and shipping city stay PLACEHOLDER (S8.6.3, P-20, P-21). No contact form (S8.6.4).
export default function ContactCard() {
  return (
    <section id="kontak" className="iz-wrap" style={{ paddingBottom: 0 }}>
      <div className="iz-head">
        <h2 className="t-h2-landing">Hubungi INZTA.</h2>
      </div>
      <div className="iz-contact">
        <div className="iz-contact__wa iz-dark">
          <span className="iz-eyebrow" style={{ marginBottom: 0 }}>WhatsApp Admin</span>
          <h3 className="iz-contact__num iz-nowrap">{formatWaDisplay(WA_NUMBER)}</h3>
          <p>Jam balas admin: PLACEHOLDER</p>
          <div className="iz-wa" style={{ marginTop: 16 }}>
            <span className="iz-wa__note">Anda akan diarahkan ke WhatsApp</span>
            <a className="iz-btn iz-btn--primary iz-btn--wa" href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">
              <span className="iz-btn__icon">
                <WhatsApp />
              </span>
              <span>Chat admin via WhatsApp</span>
            </a>
          </div>
        </div>
        <div className="iz-channels">
          <a className="iz-channel" href={INSTAGRAM.href} target="_blank" rel="noopener noreferrer">
            <span className="iz-iconbtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <path d="M17.5 6.5h.01" />
              </svg>
            </span>
            <span>
              Instagram <span className="iz-nowrap">{INSTAGRAM.handle}</span>
            </span>
            <External />
          </a>
          <div className="iz-channel iz-channel--static">
            <span className="iz-iconbtn">
              <Bag />
            </span>
            Shopee Inztamoto
          </div>
          <a className="iz-channel" href={TOKOPEDIA_URL} target="_blank" rel="noopener noreferrer">
            <span className="iz-iconbtn">
              <Bag />
            </span>
            Tokopedia Inzta moto Ride
            <External />
          </a>
          <div className="iz-channel iz-channel--plain">
            <span className="iz-iconbtn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
              </svg>
            </span>
            Dikirim dari: PLACEHOLDER
          </div>
        </div>
      </div>
    </section>
  );
}
