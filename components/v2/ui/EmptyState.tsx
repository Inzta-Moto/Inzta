import Link from 'next/link';

export interface EmptyAction {
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
}

// Shared empty state for S2, S5, and S6 (F-016 S0.12.4): title, one line, up to two actions.
export default function EmptyState({
  title,
  text,
  actions = [],
  headingLevel = 2,
}: {
  title: string;
  text?: string;
  actions?: EmptyAction[];
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="iz-empty">
      <Heading className="iz-empty__title">{title}</Heading>
      {text && <p className="iz-empty__text">{text}</p>}
      {actions.length > 0 && (
        <div className="iz-row">
          {actions.slice(0, 2).map((a, i) => {
            const cls = `iz-btn ${a.primary ?? i === 0 ? 'iz-btn--primary' : 'iz-btn--secondary'}`;
            return a.external ? (
              <a key={a.href} className={cls} href={a.href} target="_blank" rel="noopener noreferrer">{a.label}</a>
            ) : (
              <Link key={a.href} className={cls} href={a.href}>{a.label}</Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
