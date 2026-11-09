/**
 * "Cara kerja komisi" steps, word for word from the F-025 design (build-figcraft.mjs STEPS). Login, the dashboard band,
 * the no-voucher card, and the empty state all render this list, so the wording stays in one place. It only describes
 * the flow that already runs; payout rules and schedules wait for INZTA (Q-6).
 */
export const COMMISSION_STEPS = [
  'Bagikan link atau kode voucher Anda.',
  'Pembeli pesan di inzta.id; voucher Anda terpasang otomatis.',
  'Admin INZTA mengecek Order ID di WhatsApp, lalu mencatat dan mencairkan komisi.',
] as const;

export const COMMISSION_STEPS_TITLE = 'Cara kerja komisi';

export type RouteStepsProps = {
  steps: readonly string[];
  /** 'auto' is horizontal when the component's own width is at least 520 px (container query), vertical below. */
  orientation?: 'horizontal' | 'vertical' | 'auto';
  /** 'dark' on the band or the login photo panel; 'light' inside cards. */
  tone?: 'dark' | 'light';
  title?: string;
  /** Heading level of the title; null renders it as a plain paragraph (for a title that is not a section). */
  headingLevel?: 2 | 3 | 4 | null;
  className?: string;
};

const ORIENTATION_CLASS = { horizontal: 'iz-aff-route--h', vertical: 'iz-aff-route--v', auto: 'iz-aff-route--auto' } as const;

/**
 * Numbered kuning stops joined by a dashed line (F-025 E1, E7, E14). No client code, so it renders on the server or
 * inside client components alike. The wrapper is a CSS container and takes the full width of its parent; inside a
 * flex row give it a width (or flex: 1), otherwise inline-size containment collapses it.
 */
export default function RouteSteps({ steps, orientation = 'auto', tone = 'dark', title, headingLevel = 2, className }: RouteStepsProps) {
  const Heading = headingLevel === null ? 'p' : (`h${headingLevel}` as const);
  const classes = ['iz-aff-route', ORIENTATION_CLASS[orientation], `iz-aff-route--${tone}`, className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {title && <Heading className="iz-aff-route__title">{title}</Heading>}
      {/* role="list": Safari drops list semantics when list-style is none, and the step count matters here. */}
      <ol className="iz-aff-route__list" role="list">
        {steps.map((step, i) => (
          <li key={step} className="iz-aff-route__step">
            {/* The ordered list already announces the position, so the drawn number is hidden from screen readers. */}
            <span className="iz-aff-route__n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="iz-aff-route__text">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
