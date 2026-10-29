import { Fragment } from 'react';
import Link from 'next/link';
import SmartImage from '@/components/v2/ui/SmartImage';
import { ArrowRight } from '@/components/v2/icons';
import { COMMUNITY_PHOTOS, EVENT_FACTS, INSTAGRAM, SHOW_VALUES_COPY } from '@/components/v2/about/about-content';

// "Bersama komunitas." (F-016 S8.4). Facts from K-06 as a definition list (S8.4.1); only the Gasber photo carries
// the organiser credit, hidden by CSS together with a failed photo (S8.4.2, S8.4.3). The lead line is part of P-8.
export default function CommunityPanel({ gasberHref }: { gasberHref: string }) {
  const { gasber, road02, hero99 } = COMMUNITY_PHOTOS;
  return (
    <section className="iz-wrap">
      <div className="iz-dark iz-grid-2 iz-about-community">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <span className="iz-eyebrow" style={{ marginBottom: 0 }}>Komunitas</span>
          <h2 className="t-h2-landing">Bersama komunitas.</h2>
          {SHOW_VALUES_COPY && (
            <p className="t-body iz-muted">
              INZTA ikut turun ke jalur bersama komunitas rider, terakhir di Gasber 16 Indonesia Ride Adventure, 24 Oktober 2026.
            </p>
          )}
          <dl className="iz-eventfacts">
            {EVENT_FACTS.map(([k, v]) => (
              <Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
          </dl>
          <Link className="iz-link" href={gasberHref}>
            Baca catatan Gasber 16 <ArrowRight size={18} />
          </Link>
          <a className="iz-igcta" href={INSTAGRAM.href} target="_blank" rel="noopener noreferrer">
            <span className="iz-igcta__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zM17.5 6.5h.01" />
              </svg>
            </span>
            <span>
              Pakai tas INZTA di perjalanan? Tandai <b className="iz-nowrap">{INSTAGRAM.handle}</b>.
            </span>
          </a>
        </div>
        <div className="iz-grid-2 iz-about-photos" data-reveal-stagger="">
          <div className="iz-photo iz-about-photo--wide">
            <SmartImage src={gasber.src} alt={gasber.alt} tone="dark" sizes="(max-width: 1023px) 100vw, 560px" widths={[560, 900, 1200]} width={900} />
            <span className="iz-tag">{gasber.credit}</span>
          </div>
          <div className="iz-photo iz-about-photo">
            <SmartImage src={road02.src} alt={road02.alt} tone="dark" sizes="(max-width: 767px) 100vw, 280px" widths={[300, 600]} width={600} />
          </div>
          <div className="iz-photo iz-about-photo">
            <SmartImage src={hero99.src} alt={hero99.alt} tone="dark" sizes="(max-width: 767px) 100vw, 280px" widths={[300, 600]} width={600} />
          </div>
        </div>
      </div>
    </section>
  );
}
