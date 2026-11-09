import HeroBand, { DashboardFrame } from './HeroBand';

const ROWS = [0, 1, 2, 3];

/**
 * Loading state of the dashboard (F-023 E15, FR-07): the dark band with a ticket outline, then the summary block(s)
 * and a transaction card outline. No spinner or counting numbers; the sheen stops under reduced motion. Screen
 * readers get aria-busy on <main> plus one hidden sentence.
 */
export default function DashboardSkeleton() {
  const intro = (
    <div className="iz-aff-hero__intro" aria-hidden="true">
      <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--hello" />
      <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--title" />
    </div>
  );
  const band = (
    <HeroBand intro={intro}>
      <div className="iz-aff-ticket iz-aff-ticket--skel" aria-hidden="true">
        <div className="iz-aff-ticket__head">
          <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--tile" />
          <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--line" />
        </div>
        <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--field" />
        <div className="iz-aff-ticket__actions" data-share="true">
          <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--btn" />
          <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--btn" />
        </div>
        <span className="iz-aff-skel iz-aff-skel--band iz-aff-skel--code" />
      </div>
    </HeroBand>
  );

  return (
    <DashboardFrame band={band} busy>
      <div className="iz-aff-content">
        <div className="iz-aff-topo iz-aff-topo--ink iz-aff-topo--fade iz-aff-content__topo" aria-hidden="true" />
        <div className="iz-aff-container iz-aff-content__stack">
          <p className="iz-aff-sr-only" role="status">
            Memuat dashboard…
          </p>
          <div className="iz-aff-skel-summary" aria-hidden="true">
            <span className="iz-aff-skel iz-aff-skel--block" />
            <span className="iz-aff-skel iz-aff-skel--block iz-aff-skel--phone-only" />
          </div>
          <div className="iz-aff-card iz-aff-skel-list" aria-hidden="true">
            <span className="iz-aff-skel iz-aff-skel--heading" />
            <span className="iz-aff-skel iz-aff-skel--search" />
            {ROWS.map(i => (
              <div key={i} className="iz-aff-skel-row">
                <span className="iz-aff-skel iz-aff-skel--rowtile" />
                <span className="iz-aff-skel-row__text">
                  <span className="iz-aff-skel iz-aff-skel--rowname" />
                  <span className="iz-aff-skel iz-aff-skel--rowmeta" />
                </span>
                <span className="iz-aff-skel iz-aff-skel--rowamount" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardFrame>
  );
}
