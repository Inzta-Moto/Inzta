import SmartImage from '@/components/v2/ui/SmartImage';
import StepsRegion from '@/components/v2/about/StepsRegion';
import { PROCESS_STEPS } from '@/components/v2/about/about-content';

// "Cara kami membuat tas" (F-016 S8.2). Step photos are decorative (S8.2.4) and lazy in 4:5 boxes (S8.2.5); one note
// below the row covers every example photo instead of per-photo tags (S8.2.2). data-reveal-stagger is the phase C
// motion hook only; nothing is hidden by it.
export default function ProcessSteps() {
  return (
    <section className="iz-section">
      <div className="iz-wrap">
        <div className="iz-head iz-head--split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
            <span className="iz-eyebrow" style={{ marginBottom: 0 }}>Cara kami membuat tas</span>
            <h2 className="t-h2-landing">
              Dari pola sampai paket <span className="iz-tone2">di tangan Anda.</span>
            </h2>
            <p className="t-body iz-muted">Desain dan produksi dikerjakan sendiri, lalu dikirim dari gudang INZTA.</p>
          </div>
        </div>
        <StepsRegion label="Cara kami membuat tas">
          <ol className="iz-steps" data-reveal-stagger="">
            {PROCESS_STEPS.map((s, i) => (
              <li className="iz-step" key={s.title}>
                <div className="iz-photo">
                  <SmartImage src={s.image} alt="" imgClassName={s.crop ?? undefined} sizes="(max-width: 1023px) 300px, 230px" />
                  <span className="iz-step__badge">Langkah {i + 1}</span>
                </div>
                <h3 className="t-h3-landing">{s.title}</h3>
                <p className={s.text.startsWith('PLACEHOLDER') ? 'iz-placeholder' : undefined}>{s.text}</p>
              </li>
            ))}
          </ol>
        </StepsRegion>
        <p className="iz-muted" style={{ fontSize: 15, marginTop: 16 }}>Foto contoh, akan diganti foto produksi INZTA.</p>
      </div>
    </section>
  );
}
