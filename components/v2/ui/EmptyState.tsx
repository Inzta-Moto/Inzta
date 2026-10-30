import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bag, WhatsApp } from '@/components/v2/icons';

export interface EmptyAction {
  label: string;
  href: string;
  external?: boolean;
  primary?: boolean;
}

// Shared empty state for S2, S5, and S6 (F-016 S0.12.4): title, one line, up to two actions. The stitched icon tile
// and the WhatsApp glyph on a wa.me action are decoration only (Sehan, 2026-10-29: the bare card looked unfinished
// on phones); the text and the actions are unchanged.
export default function EmptyState({
  title,
  text,
  actions = [],
  headingLevel = 2,
  icon,
}: {
  title: string;
  text?: string;
  actions?: EmptyAction[];
  headingLevel?: 2 | 3;
  icon?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="iz-empty">
      <span className="iz-empty__ico" aria-hidden="true">
        {icon ?? <Bag width={28} height={28} />}
      </span>
      <Heading className="iz-empty__title">{title}</Heading>
      {text && <p className="iz-empty__text">{text}</p>}
      {actions.length > 0 && (
        <div className="iz-row">
          {actions.slice(0, 2).map((a, i) => {
            const wa = !!a.external && a.href.includes('wa.me');
            const cls = `iz-btn ${a.primary ?? i === 0 ? 'iz-btn--primary' : 'iz-btn--secondary'}${wa ? ' iz-btn--wa' : ''}`;
            const body = wa ? (
              <>
                <span className="iz-btn__icon">
                  <WhatsApp />
                </span>
                <span>{a.label}</span>
              </>
            ) : (
              a.label
            );
            return a.external ? (
              <a key={a.href} className={cls} href={a.href} target="_blank" rel="noopener noreferrer">
                {body}
              </a>
            ) : (
              <Link key={a.href} className={cls} href={a.href}>
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
