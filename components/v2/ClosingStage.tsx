'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { HOVER, MOTION_OK, whenRevealed } from '@/lib/v2/motion/runtime';

// The assembly starts once the panel top passes 75% of the viewport, the point where the engine raises its actions.
const IN_VIEW = '0px 0px -25% 0px';
// If the curtain never reports itself lifted (runtime error), the assembly still plays this long after it is in view.
const SAFETY_MS = 4000;
// The rider starts once the assembly has drawn the whole route (stop 3 lights at 3.2 s, v2-closing.css).
const RIDE_AFTER_MS = 3700;
// Share of the remaining distance the headlight covers per frame: a soft lag behind the cursor, settled in about 1 s.
const LAMP_EASE = 0.16;

const clamp = (v: number) => Math.max(-0.5, Math.min(0.5, v));

/**
 * Prepares the route rider (v2-closing.css "Rider") and returns the function that starts it. The chip centres are
 * measured into custom properties, again whenever the route changes size (it turns from a row into a column below
 * 1024 px). The loop only runs while the panel is on screen (.iz-closing--live, set by ClosingStage).
 */
function rider(section: HTMLElement, cleanups: (() => void)[]): () => void {
  const route = section.querySelector<HTMLElement>('.iz-closing__route');
  if (!route || typeof ResizeObserver !== 'function') return () => {};
  let started = false;
  const measure = () => {
    const chips = route.querySelectorAll<HTMLElement>('.iz-closing__n');
    if (chips.length < 3) return;
    const centre = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const [a, m, z] = [centre(chips[0]), centre(chips[1]), centre(chips[2])];
    route.style.setProperty('--ride-mx', `${(m[0] - a[0]).toFixed(1)}px`);
    route.style.setProperty('--ride-my', `${(m[1] - a[1]).toFixed(1)}px`);
    route.style.setProperty('--ride-x', `${(z[0] - a[0]).toFixed(1)}px`);
    route.style.setProperty('--ride-y', `${(z[1] - a[1]).toFixed(1)}px`);
  };
  const sizes = new ResizeObserver(measure);
  cleanups.push(() => {
    sizes.disconnect();
    section.classList.remove('iz-closing--ride');
    ['--ride-mx', '--ride-my', '--ride-x', '--ride-y'].forEach(p => route.style.removeProperty(p));
  });
  return () => {
    if (started) return;
    started = true;
    measure();
    sizes.observe(route);
    section.classList.add('iz-closing--ride');
  };
}

/**
 * Fine pointers only: the chat leans toward the cursor (--iz-px/--iz-py on .iz-chat) and a headlight follows it over
 * the map (--iz-lx/--iz-ly on .iz-closing__lamp, in px from the drifting topo layer, eased toward the cursor each
 * frame). Layout is read and the variables written in the same frame, so a fast pointer never forces a sync layout.
 */
function pointer(section: HTMLElement, cleanups: (() => void)[]) {
  const chat = section.querySelector<HTMLElement>('.iz-chat');
  const topo = section.querySelector<HTMLElement>('.iz-closing__topo');
  const lamp = section.querySelector<HTMLElement>('.iz-closing__lamp');
  section.classList.add('iz-closing--tilt');
  let frame = 0;
  let inside = false;
  let snap = true;
  let px = 0;
  let py = 0;
  let lx = 0;
  let ly = 0;
  const tick = () => {
    frame = 0;
    let x = 0;
    let y = 0;
    if (inside) {
      const r = section.getBoundingClientRect();
      x = clamp((px - r.left) / r.width - 0.5);
      y = clamp((py - r.top) / r.height - 0.5);
    }
    chat?.style.setProperty('--iz-px', x.toFixed(3));
    chat?.style.setProperty('--iz-py', y.toFixed(3));
    if (!inside || !topo || !lamp) return;
    const t = topo.getBoundingClientRect();
    const tx = px - t.left;
    const ty = py - t.top;
    // On entry the light appears under the cursor instead of sliding in from its last spot.
    if (snap) {
      lx = tx;
      ly = ty;
      snap = false;
    } else {
      lx += (tx - lx) * LAMP_EASE;
      ly += (ty - ly) * LAMP_EASE;
    }
    lamp.style.setProperty('--iz-lx', `${lx.toFixed(1)}px`);
    lamp.style.setProperty('--iz-ly', `${ly.toFixed(1)}px`);
    section.classList.add('iz-closing--lamp');
    if (Math.abs(tx - lx) + Math.abs(ty - ly) > 0.6) frame = window.requestAnimationFrame(tick);
  };
  const schedule = () => {
    frame ||= window.requestAnimationFrame(tick);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (!inside) snap = true;
    inside = true;
    px = e.clientX;
    py = e.clientY;
    schedule();
  };
  const leave = () => {
    inside = false;
    section.classList.remove('iz-closing--lamp');
    schedule();
  };
  // A resting cursor still moves over the map while the page scrolls under it.
  const scroll = () => {
    if (inside) schedule();
  };
  section.addEventListener('pointermove', move);
  section.addEventListener('pointerleave', leave);
  window.addEventListener('scroll', scroll, { passive: true });
  cleanups.push(() => {
    section.removeEventListener('pointermove', move);
    section.removeEventListener('pointerleave', leave);
    window.removeEventListener('scroll', scroll);
    window.cancelAnimationFrame(frame);
    chat?.style.removeProperty('--iz-px');
    chat?.style.removeProperty('--iz-py');
    lamp?.style.removeProperty('--iz-lx');
    lamp?.style.removeProperty('--iz-ly');
    section.classList.remove('iz-closing--tilt', 'iz-closing--lamp');
  });
}

/**
 * Section frame of the closing panel (F-016 S0.8). The panel, its map, route and chat illustration are complete in
 * the server HTML; this component only adds classes, so without JavaScript or with reduced motion nothing is hidden
 * and nothing moves. With motion allowed it marks the panel (.iz-closing--motion) and keeps .iz-closing--live on it
 * while it is on screen, which runs the idle loops (map drift and glow, chat float, typing dots, patch, rider) and
 * pauses them off screen. It arms the panel (start states under .iz-closing--armed), plays the assembly once the panel
 * scrolls in and the curtain is up (.iz-closing--play), then sets the route rider going (.iz-closing--ride), and on
 * fine pointers adds the chat lean and the headlight. A panel already on screen and uncovered at mount is not
 * re-assembled, so the chat never blinks out in front of the visitor; it only gets the loops. Transforms stay off the
 * section itself (the engine clips it).
 */
export default function ClosingStage({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = ref.current;
    if (!section || !window.matchMedia(MOTION_OK).matches) return;
    const cleanups: (() => void)[] = [];
    section.classList.add('iz-closing--motion');
    cleanups.push(() => section.classList.remove('iz-closing--motion'));

    if (typeof IntersectionObserver === 'function') {
      const live = new IntersectionObserver(entries => {
        section.classList.toggle('iz-closing--live', entries.some(e => e.isIntersecting));
      });
      live.observe(section);
      cleanups.push(() => {
        live.disconnect();
        section.classList.remove('iz-closing--live');
      });
    }

    const startRide = rider(section, cleanups);

    if (typeof IntersectionObserver === 'function') {
      let revealed = false;
      let inView = false;
      let played = false;
      let safety = 0;
      let rideTimer = 0;
      let io: IntersectionObserver | null = null;
      const play = () => {
        if (played) return;
        played = true;
        window.clearTimeout(safety);
        io?.disconnect();
        section.classList.add('iz-closing--play');
        rideTimer = window.setTimeout(startRide, RIDE_AFTER_MS);
      };
      const stopReveal = whenRevealed(() => {
        revealed = true;
        if (inView) play();
      });
      const box = section.getBoundingClientRect();
      const onScreen = box.top < window.innerHeight && box.bottom > 0;
      if (onScreen && revealed) {
        startRide();
      } else {
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
        window.clearTimeout(rideTimer);
        section.classList.remove('iz-closing--armed', 'iz-closing--play');
      });
    }

    if (window.matchMedia(HOVER).matches) pointer(section, cleanups);

    return () => cleanups.forEach(fn => fn());
  }, []);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
