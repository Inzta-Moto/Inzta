import type { WarrantyProductOption } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { WARRANTY_COPY } from '@/lib/warranty/copy';
import { Shield, WhatsApp } from '@/components/v2/icons';
import FormSwitch from '@/components/v2/warranty/FormSwitch';
import ClaimForm from '@/components/v2/warranty/ClaimForm';
import FeedbackForm from '@/components/v2/warranty/FeedbackForm';

// F-031 /garansi (requirements 2.1, 10.1; design.md §8.2): heading, switch, three steps, the claim form with a side card
// (terms placeholder until A-145, WhatsApp as a complement), then the feedback section #masukan. Server component; the
// forms are the only client islands.
const P = WARRANTY_COPY.page;
const F = WARRANTY_COPY.feedback;

function AskCard() {
  return (
    <aside className="iz-gr-side" aria-labelledby="gr-ask-title">
      <div className="iz-gr-card">
        <h2 className="t-h3" id="gr-terms-title">
          <Shield width={20} height={20} aria-hidden="true" /> {P.termsTitle}
        </h2>
        <p>{P.terms}</p>
      </div>
      <div className="iz-gr-card">
        <h2 className="t-h3" id="gr-ask-title">
          {P.askTitle}
        </h2>
        <p>{P.askText}</p>
        <div className="iz-wa">
          <a className="iz-btn iz-btn--secondary" href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">
            <WhatsApp width={20} height={20} />
            <span>{P.askCta}</span>
          </a>
          <span className="iz-wa__note">{P.waNote}</span>
        </div>
      </div>
    </aside>
  );
}

export default function GaransiPage({ products }: { products: WarrantyProductOption[] }) {
  return (
    <div className="iz-wrap iz-gr">
      <header className="iz-head iz-gr-head">
        <span className="iz-eyebrow">{P.eyebrow}</span>
        <h1 className="t-h1-shop">{P.title}</h1>
        <p className="t-lead">{P.lead}</p>
        <FormSwitch />
      </header>

      <ol className="iz-gr-steps" aria-label={P.stepsLabel}>
        {P.steps.map((s, i) => (
          <li key={s}>
            <span className="iz-gr-steps__n" aria-hidden="true">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      <section id="klaim" className="iz-gr-section" aria-label={P.switchClaim}>
        <div className="iz-gr-layout">
          <div className="iz-gr-main">
            <ClaimForm products={products} />
          </div>
          <AskCard />
        </div>
      </section>

      <section id="masukan" className="iz-gr-section iz-gr-feedback" aria-labelledby="mk-title">
        <div className="iz-gr-main iz-gr-main--wide">
          <h2 className="t-h2-shop" id="mk-title">
            {F.sectionTitle}
          </h2>
          <p className="iz-gr-lead">{F.lead}</p>
          <FeedbackForm products={products} />
        </div>
      </section>
    </div>
  );
}
