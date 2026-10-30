'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motionTier } from '@/lib/v2/motion/runtime';

export const READING_EVENT = 'iz:reading';

/**
 * Reading progress (F-016 S7.7.1, F-017): only after mount and only under prefers-reduced-motion: no-preference, so
 * it is absent without JavaScript, under reduced motion and in the minimal motion tier (Save-Data). Measured over the
 * article body, transform: scaleX() only, written in a requestAnimationFrame from a passive scroll listener. No GSAP.
 *
 * F-017: the line sits on the bottom edge of the navbar capsule (a portal into SiteNav's .iz-nav). The navbar hides
 * while scrolling down, so a second line along the top edge of the screen shows only then (v2-article.css reads the
 * navbar's data-hidden). Each frame also sends the progress as READING_EVENT for the "Sisa sekitar n menit" line.
 * While mounted, html.iz-has-progress hides the site-wide Lenis line (.iz-readline), so one line is on screen.
 */
export default function ReadingProgress() {
  const [on, setOn] = useState(false);
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const top = useRef<HTMLSpanElement>(null);
  const inNav = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const update = () => setOn(mq.matches && motionTier() !== 'minimal');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!on) return;
    setNav(document.querySelector<HTMLElement>('.iz-navwrap .iz-nav'));
    const html = document.documentElement;
    html.classList.add('iz-has-progress');
    const body = document.querySelector<HTMLElement>('[data-article-body]');
    if (!body) return () => html.classList.remove('iz-has-progress');
    let raf = 0;
    let last = -1;
    const frame = () => {
      raf = 0;
      const r = body.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : r.bottom <= window.innerHeight ? 1 : 0;
      const t = `scaleX(${p})`;
      if (top.current) top.current.style.transform = t;
      if (inNav.current) inNav.current.style.transform = t;
      if (Math.abs(p - last) >= 0.005 || (p !== last && (p === 0 || p === 1))) {
        last = p;
        window.dispatchEvent(new CustomEvent(READING_EVENT, { detail: p }));
      }
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
      html.classList.remove('iz-has-progress');
    };
  }, [on]);

  // The portal's span exists only after `nav` is set; draw it at the current position at once.
  useEffect(() => {
    if (nav && inNav.current && top.current) inNav.current.style.transform = top.current.style.transform;
  }, [nav]);

  if (!on) return null;
  return (
    <>
      <div className="iz-progress" aria-hidden="true">
        <span ref={top} />
      </div>
      {nav &&
        createPortal(
          <span className="iz-progress-nav" aria-hidden="true">
            <span ref={inNav} />
          </span>,
          nav,
        )}
    </>
  );
}
