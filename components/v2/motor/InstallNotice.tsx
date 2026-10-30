// "Catatan pemasangan di XSR 155." (S5.4, P-18). Rendered only on Retro while an XSR 155 product is listed; the
// placeholders wait for INZTA's installation guide or RND-approved text (S5.4.2).
export default function InstallNotice() {
  return (
    <section className="iz-section iz-wrap" style={{ paddingBottom: 0 }}>
      <div className="iz-head">
        <h2 className="t-h2-landing">
          Catatan pemasangan <span className="iz-tone2">di XSR 155.</span>
        </h2>
      </div>
      <div className="iz-notice">
        <div className="iz-notice__text">
          <span className="iz-cat-chip">Sebelum memesan</span>
          <ul className="iz-notice__list">
            <li>Bawah jok: Daily Ride Belakang (4,4 liter) diikat tali velcro, 2 di atas dan 1 di bawah.</li>
            <li>Bawah tangki: Scrambag (sekitar 4 liter) dikunci dengan baut bodi motor, part PNP khusus XSR 155.</li>
            <li>Sebelum berkendara, pastikan tali dan buckle terpasang kuat, dan tas tidak menyentuh knalpot atau roda belakang.</li>
          </ul>
          <p>Ragu memilih versi tali atau baut? Tanyakan ke admin lewat WhatsApp sebelum memesan.</p>
        </div>
        <div className="iz-notice__photo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <span>Foto pemasangan belum tersedia</span>
        </div>
      </div>
    </section>
  );
}
