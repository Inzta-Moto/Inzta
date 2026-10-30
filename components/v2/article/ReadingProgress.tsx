'use client';

import { useEffect, useRef, useState } from 'react';
import { motionTier } from '@/lib/v2/motion/runtime';

/**
 * Reading progress bar (F-016 S7.7.1): only after mount and only under prefers-reduced-motion: no-preference, so
 * it is absent without JavaScript, under reduced motion and in the minimal motion tier (Save-Data). transform:
 * scaleX() only, written in a requestAnimationFrame from a passive scroll listener, measured over the article body.
 * No GSAP.
 */
export default function ReadingProgress() {
  const [on, setOn] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const update = () => setOn(mq.matches && motionTier() !== 'minimal');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!on) return;
    const body = document.querySelector<HTMLElement>('[data-article-body]');
    if (!body) return;
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = body.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : r.bottom <= window.innerHeight ? 1 : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    frame();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [on]);

  if (!on) return null;
  return (
    <div className="iz-progress" aria-hidden="true">
      <span ref={bar} />
    </div>
  );
}
