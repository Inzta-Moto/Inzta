'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HOVER, MOTION_OK, whenRevealed } from '@/lib/v2/motion/runtime';

// The entrance starts once the section top passes 80% of the viewport.
const IN_VIEW = '0px 0px -20% 0px';
// If the curtain never reports itself lifted (runtime error), the entrance still plays this long after it is in view.
const SAFETY_MS = 4000;
// The tour starts once the last card has landed (step 3 delay 0.76 s + 1.1 s, v2-howto.css).
const TOUR_AFTER_MS = 1900;
// How long each step stays lit; matches --hw-act, the length of the scene animations.
const STEP_MS = 3400;
// The road segment fills before the next step lights, so the highlight visibly travels along it.
const FILL_MS = 520;

/**
 * Frame of "Pesan dalam tiga langkah" (F-016 S1.10). The steps are complete in the server HTML; this component only
 * adds classes, so without JavaScript or with reduced motion nothing is hidden or moving. With motion allowed it arms
 * the steps (.iz-howto--armed), plays the entrance when the section scrolls in and the curtain is up, then starts the
 * tour: the active step (.iz-journey__step--on) travels 1 -> 2 -> 3 along the road while the section is on screen and
 * the tab is visible. On fine pointers, hovering a step holds the tour on it. data-scene="howto" marks the section as
 * running its own motion; its list class is not one of the engine's generic groups, so nothing animates it twice.
 */
export default function HowToStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !window.matchMedia(MOTION_OK).matches || typeof IntersectionObserver !== 'function') return;
    const steps = Array.from(root.querySelectorAll<HTMLElement>('.iz-journey__step'));
    if (steps.length < 2) return;

    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const stopTimers = () => {
      timers.forEach(t => window.clearTimeout(t));
      timers.clear();
    };

    let active = 0;
    let touring = false;
    let onScreen = false;
    let held = false;

    const show = (index: number) => {
      active = index;
      steps.forEach((s, i) => {
        s.classList.toggle('iz-journey__step--on', i === index);
        s.classList.toggle('iz-journey__step--done', i < index);
      });
    };
    const next = () => {
      if (active === steps.length - 1) {
        show(0);
        later(next, STEP_MS);
        return;
      }
      steps[active].classList.add('iz-journey__step--done');
      const target = active + 1;
      later(() => show(target), FILL_MS);
      later(next, STEP_MS + FILL_MS);
    };
    const run = () => {
      stopTimers();
      if (touring && onScreen && !held && !document.hidden) later(next, STEP_MS);
    };
    const startTour = () => {
      if (touring) return;
      touring = true;
      root.classList.add('iz-howto--tour');
      show(0);
      run();
    };

    // Entrance, the same gating as the closing panel: a section already on screen and uncovered at mount is not
    // hidden again, so the cards never blink out in front of the visitor; it only gets the tour.
    let revealed = false;
    let inView = false;
    let played = false;
    let safety = 0;
    let tourTimer = 0;
    let entry: IntersectionObserver | null = null;
    const play = () => {
      if (played) return;
      played = true;
      window.clearTimeout(safety);
      entry?.disconnect();
      root.classList.remove('iz-howto--armed');
      tourTimer = window.setTimeout(startTour, TOUR_AFTER_MS);
    };
    const stopReveal = whenRevealed(() => {
      revealed = true;
      if (inView) play();
    });
    const box = root.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0 && revealed) {
      played = true;
      startTour();
    } else {
      root.classList.add('iz-howto--armed');
      entry = new IntersectionObserver(
        entries => {
          inView = entries.some(e => e.isIntersecting);
          if (!inView) return;
          if (revealed) play();
          else if (!safety) safety = window.setTimeout(play, SAFETY_MS);
        },
        { rootMargin: IN_VIEW },
      );
      entry.observe(root);
    }

    // The tour only runs while some of the section is on screen.
    const live = new IntersectionObserver(entries => {
      const now = entries.some(e => e.isIntersecting);
      if (now === onScreen) return;
      onScreen = now;
      run();
    });
    live.observe(root);
    const onVisibility = () => run();
    document.addEventListener('visibilitychange', onVisibility);

    const list = root.querySelector<HTMLElement>('.iz-journey');
    const hoverOff: (() => void)[] = [];
    if (list && window.matchMedia(HOVER).matches) {
      steps.forEach((step, i) => {
        const enter = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse' || !touring) return;
          held = true;
          stopTimers();
          show(i);
        };
        step.addEventListener('pointerenter', enter);
        hoverOff.push(() => step.removeEventListener('pointerenter', enter));
      });
      const leave = () => {
        if (!held) return;
        held = false;
        run();
      };
      list.addEventListener('pointerleave', leave);
      hoverOff.push(() => list.removeEventListener('pointerleave', leave));
    }

    return () => {
      stopReveal();
      entry?.disconnect();
      live.disconnect();
      stopTimers();
      window.clearTimeout(safety);
      window.clearTimeout(tourTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      hoverOff.forEach(fn => fn());
      root.classList.remove('iz-howto--armed', 'iz-howto--tour');
      steps.forEach(s => s.classList.remove('iz-journey__step--on', 'iz-journey__step--done'));
    };
  }, []);

  return (
    <div ref={ref} className={className} data-scene="howto">
      {children}
    </div>
  );
}
