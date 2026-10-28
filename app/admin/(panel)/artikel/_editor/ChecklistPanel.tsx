'use client';

import type { ChecklistResult } from '@/types';

// Blocking checks disable "Terbitkan"; warnings only inform (requirement 10.5, ADR-0014).
export default function ChecklistPanel({ result }: { result: ChecklistResult }) {
  return (
    <ul className="article-checklist">
      {result.blocking.map(c => (
        <li key={c.id} className={c.ok ? 'is-ok' : 'is-fail'}>
          <span className="article-checklist-icon" aria-hidden="true">{c.ok ? '✓' : '✕'}</span>
          <span>
            <span className="sr-only">{c.ok ? 'Lolos: ' : 'Belum lolos: '}</span>
            {c.label}
            {!c.ok && c.detail && <span className="article-checklist-detail">{c.detail}</span>}
          </span>
        </li>
      ))}
      {result.warnings.map(c => (
        <li key={c.id} className={c.ok ? 'is-ok' : 'is-warn'}>
          <span className="article-checklist-icon" aria-hidden="true">{c.ok ? '✓' : '!'}</span>
          <span>
            <span className="sr-only">{c.ok ? 'Lolos: ' : 'Peringatan: '}</span>
            {c.label}
            {!c.ok && c.detail && <span className="article-checklist-detail">{c.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
