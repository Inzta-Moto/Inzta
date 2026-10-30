'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from '@/components/v2/icons';

export interface TocHeading {
  id: string;
  text: string;
}

/**
 * "Daftar isi" (F-016 S7.3, artikel.dc.html:42-50). Decision KS-01: body h2 get ids only once Angkasa agrees to the
 * lib/markdown.ts change (S7.3.3), so today the list is always empty and nothing renders (S7.3.4: fewer than two
 * h2). The link of the heading at the top of the reading area is marked with IntersectionObserver, never a scroll
 * handler that reads layout (S7.3.6); without JavaScript no link is marked.
 */
export default function Toc({ headings }: { headings: TocHeading[] }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (headings.length < 2) return;
    const els = headings.map(h => document.getElementById(h.id)).filter((e): e is HTMLElement => !!e);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = headings.find(h => visible.has(h.id));
        if (first) setCurrent(first.id);
      },
      // The band below the navbar counts as "the top of the reading area".
      { rootMargin: '-96px 0px -60% 0px' },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;
  // F-017: on phones the list folds under a "Daftar isi · n bagian" button (closed after JavaScript loads, so without it
  // the list stays open); from 768 px the button is hidden and the list always shows (v2-article.css).
  return (
    <nav className="iz-toc" aria-labelledby="iz-toc-title" data-lenis-prevent data-open={open ? '' : undefined}>
      <h2>
        <span className="iz-toc__title" id="iz-toc-title">Daftar isi</span>
        <button className="iz-toc__toggle" type="button" aria-expanded={open} aria-controls="iz-toc-list" onClick={() => setOpen(o => !o)}>
          Daftar isi · {headings.length} bagian
          <ChevronDown size={18} />
        </button>
      </h2>
      <div className="iz-toc__list" id="iz-toc-list">
        {headings.map(h => (
          <a key={h.id} href={`#${h.id}`} aria-current={current === h.id ? 'true' : undefined} onClick={() => setOpen(false)}>
            {h.text}
          </a>
        ))}
      </div>
    </nav>
  );
}
