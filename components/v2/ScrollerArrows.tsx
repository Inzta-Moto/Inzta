'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/v2/icons';

// Previous/next buttons for a horizontal scroller (F-016 7.5): one card per click, disabled at either end.
export default function ScrollerArrows({ targetId }: { targetId: string }) {
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, [targetId]);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [targetId, update]);

  const scroll = (dir: -1 | 1) => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0;
    const step = card ? card.offsetWidth + gap : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="iz-row iz-only-desk" style={{ gap: 12 }}>
      <button className="iz-iconbtn" type="button" aria-label="Sebelumnya" aria-controls={targetId} disabled={atStart} onClick={() => scroll(-1)}>
        <ChevronLeft />
      </button>
      <button className="iz-iconbtn" type="button" aria-label="Berikutnya" aria-controls={targetId} disabled={atEnd} onClick={() => scroll(1)}>
        <ChevronRight />
      </button>
    </div>
  );
}
