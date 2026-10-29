'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/v2/icons';

type Edge = { overflow: boolean; atStart: boolean; atEnd: boolean };

// Previous/next buttons for a horizontal scroller (F-016 S1.3.5): one card plus gap per press, instant under reduced
// motion. The arrow at the matching end is aria-disabled (it stays focusable, so focus is not lost at the end), and
// both are hidden while the cards fit. The server render shows them enabled until the first measurement.
export default function ScrollerArrows({ targetId }: { targetId: string }) {
  const [edge, setEdge] = useState<Edge>({ overflow: true, atStart: true, atEnd: false });

  const update = useCallback(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdge({ overflow: max > 1, atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft >= max - 1 });
  }, [targetId]);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Card images and fonts change the scroll width after mount; a ResizeObserver catches both and window resizes.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [targetId, update]);

  const scroll = (dir: -1 | 1) => {
    if ((dir < 0 && edge.atStart) || (dir > 0 && edge.atEnd)) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0;
    const step = card ? card.offsetWidth + gap : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="iz-row iz-only-desk iz-arrows" style={{ gap: 12 }} hidden={!edge.overflow}>
      <button
        className="iz-iconbtn"
        type="button"
        aria-label="Sebelumnya"
        aria-controls={targetId}
        aria-disabled={edge.atStart || undefined}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft />
      </button>
      <button
        className="iz-iconbtn"
        type="button"
        aria-label="Berikutnya"
        aria-controls={targetId}
        aria-disabled={edge.atEnd || undefined}
        onClick={() => scroll(1)}
      >
        <ChevronRight />
      </button>
    </div>
  );
}
