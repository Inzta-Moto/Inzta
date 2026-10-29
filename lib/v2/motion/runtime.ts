import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import type { SplitText as SplitTextType } from 'gsap/SplitText';
import type Lenis from 'lenis';
import { CURTAIN_ATTR } from '@/lib/v2/motion/boot';

export type MotionKit = {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
  SplitText: typeof SplitTextType;
};

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export const DESKTOP = '(prefers-reduced-motion: no-preference) and (min-width: 1024px)';
export const MOBILE = '(prefers-reduced-motion: no-preference) and (max-width: 1023px)';
export const HOVER = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

let kit: Promise<MotionKit> | null = null;

// GSAP and its plugins load as separate chunks on first use, so they stay out of every route's first-load JS. All
// plugins ship inside the gsap package (3.15), so none is a new dependency. "iz-out" is the house ease: a long, soft
// landing (same curve as Sehan's BookMate site), used wherever a tween does not name its own.
export function loadMotion(): Promise<MotionKit> {
  kit ??= Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/SplitText'),
    import('gsap/ScrambleTextPlugin'),
    import('gsap/CustomEase'),
  ]).then(([g, st, split, scramble, custom]) => {
    const { gsap } = g;
    gsap.registerPlugin(st.ScrollTrigger, split.SplitText, scramble.ScrambleTextPlugin, custom.CustomEase);
    custom.CustomEase.create('iz-out', '0.625, 0.05, 0, 1');
    gsap.defaults({ ease: 'iz-out', duration: 0.8 });
    return { gsap, ScrollTrigger: st.ScrollTrigger, SplitText: split.SplitText };
  });
  // A failed chunk load may succeed on the next navigation, so the rejected promise is not cached.
  kit.catch(() => {
    kit = null;
  });
  return kit;
}

// Whether the page under the curtain may play its entrance. Pages that mount while a curtain is down wait for
// markRevealed(); pages that mount without one (back/forward, reduced motion) start at once.
let revealed: boolean | null = null;
const listeners = new Set<() => void>();

export function isRevealed(): boolean {
  revealed ??= !document.documentElement.hasAttribute(CURTAIN_ATTR);
  return revealed;
}

export function markCovered(): void {
  revealed = false;
}

export function markRevealed(): void {
  if (isRevealed()) return;
  revealed = true;
  const pending = [...listeners];
  listeners.clear();
  pending.forEach(fn => fn());
}

export function whenRevealed(fn: () => void): () => void {
  if (isRevealed()) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let lenis: Lenis | null = null;

export function getLenis(): Lenis | null {
  return lenis;
}

export function setLenis(instance: Lenis | null): void {
  lenis = instance;
}

// Jumps to the top (or to a hash target) without the smooth scroll, used while the curtain covers the page.
export function jumpTo(target: number | HTMLElement): void {
  if (lenis) {
    lenis.resize();
    lenis.scrollTo(target, { immediate: true, force: true });
    return;
  }
  if (typeof target === 'number') window.scrollTo(0, target);
  else target.scrollIntoView();
}
