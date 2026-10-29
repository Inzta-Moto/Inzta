'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HOVER, MOTION_OK, whenRevealed } from '@/lib/v2/motion/runtime';

// The assembly starts once the panel top passes 75% of the viewport, the point where the engine raises its actions.
const IN_VIEW = '0px 0px -25% 0px';
// If the curtain never reports itself lifted (runtime error), the assembly still plays this long after it is in view.
const SAFETY_MS = 4000;

/**
 * Section frame of the closing panel (F-016 S0.8). The panel, its route and the chat illustration are complete in the
 * server HTML; this component only adds classes, so without JavaScript or with reduced motion nothing is hidden.
 * With motion allowed it arms the panel (start states in v2-closing.css under .iz-closing--armed), plays the chat
 * assembly once the panel scrolls in and the curtain is up (.iz-closing--play), and on fine pointers lets the chat lean
 * toward the pointer (.iz-closing--tilt). A panel already on screen and uncovered at mount is left as it is, so the
 * chat never blinks out in front of the visitor. Transforms stay off the section itself (the engine clips it).
 */
export default function ClosingStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section || !window.matchMedia(MOTION_OK).matches) return;
    const cleanups: (() => void)[] = [];

    if (typeof IntersectionObserver === 'function') {
      let revealed = false;
      let inView = false;
      let played = false;
      let safety = 0;
      let io: IntersectionObserver | null = null;
      const play = () => {
        if (played) return;
        played = true;
        window.clearTimeout(safety);
        io?.disconnect();
        section.classList.add('iz-closing--play');
      };
      const stopReveal = whenRevealed(() => {
        revealed = true;
        if (inView) play();
      });
      const box = section.getBoundingClientRect();
      const onScreen = box.top < window.innerHeight && box.bottom > 0;
      if (!(onScreen && revealed)) {
        section.classList.add('iz-closing--armed');
        io = new IntersectionObserver(
          entries => {
            inView = entries.some(e => e.isIntersecting);
            if (!inView) return;
            if (revealed) play();
            else if (!safety) safety = window.setTimeout(play, SAFETY_MS);
          },
          { rootMargin: IN_VIEW },
        );
        io.observe(section);
      }
      cleanups.push(() => {
        stopReveal();
        io?.disconnect();
        window.clearTimeout(safety);
        section.classList.remove('iz-closing--armed', 'iz-closing--play');
      });
    }

    const chat = section.querySelector<HTMLElement>('.iz-chat');
    if (chat && window.matchMedia(HOVER).matches) {
      section.classList.add('iz-closing--tilt');
      let frame = 0;
      let px: number | null = null;
      let py = 0;
      // Layout is read and the variables written in the same frame, so a fast pointer never forces a sync layout.
      const write = () => {
        frame = 0;
        let x = 0;
        let y = 0;
        if (px !== null) {
          const r = section.getBoundingClientRect();
          x = Math.max(-0.5, Math.min(0.5, (px - r.left) / r.width - 0.5));
          y = Math.max(-0.5, Math.min(0.5, (py - r.top) / r.height - 0.5));
        }
        chat.style.setProperty('--iz-px', x.toFixed(3));
        chat.style.setProperty('--iz-py', y.toFixed(3));
      };
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        px = e.clientX;
        py = e.clientY;
        frame ||= window.requestAnimationFrame(write);
      };
      const leave = () => {
        px = null;
        frame ||= window.requestAnimationFrame(write);
      };
      section.addEventListener('pointermove', move);
      section.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        section.removeEventListener('pointermove', move);
        section.removeEventListener('pointerleave', leave);
        window.cancelAnimationFrame(frame);
        chat.style.removeProperty('--iz-px');
        chat.style.removeProperty('--iz-py');
        section.classList.remove('iz-closing--tilt');
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, []);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
