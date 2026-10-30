import type { MotionKit } from '@/lib/v2/motion/runtime';
import { motionTier } from '@/lib/v2/motion/runtime';

// The curtain is two sheets in a 100x100 box stretched over the viewport: yellow behind, asphalt in front. Entering,
// a sheet rises from the bottom with a bulging top edge; leaving, it goes up with a sagging bottom edge (after the
// curtain of Sehan's BookMate site, in INZTA colours). Both shapes keep the same commands, so the edge is tweened as
// two numbers and redrawn, without MorphSVG.
type Edge = { e: number; c: number };
const fromBottom = ({ e, c }: Edge) => `M0 100V${e}Q50 ${c} 100 ${e}V100Z`;
const fromTop = ({ e, c }: Edge) => `M0 0V${e}Q50 ${c} 100 ${e}V0Z`;
export const FULL = 'M0 0H100V100H0Z';

type Parts = { sheets: SVGPathElement[]; mark: HTMLElement[] };

// The lite tier moves one sheet, the asphalt one that ends on top, so each frame redraws one full-screen path instead
// of two; the yellow sheet is emptied and its edge rides on the asphalt path as a stroke (v2-motion.css). Same mark,
// label and hold.
function parts(root: HTMLElement): Parts {
  const all = Array.from(root.querySelectorAll<SVGPathElement>('[data-curtain-sheet]'));
  const sheets = motionTier() === 'lite' && all.length > 1 ? all.slice(-1) : all;
  for (const path of all) if (!sheets.includes(path)) path.setAttribute('d', fromBottom({ e: 100, c: 100 }));
  return {
    sheets,
    mark: Array.from(root.querySelectorAll<HTMLElement>('[data-curtain-part]')).filter(el => !el.hidden),
  };
}

function rise(tl: gsap.core.Timeline, path: SVGPathElement, at: number) {
  const edge = { e: 100, c: 100 };
  const draw = () => path.setAttribute('d', fromBottom(edge));
  tl.call(draw, undefined, 0);
  tl.to(edge, { e: 55, c: 5, duration: 0.26, ease: 'power2.in', onUpdate: draw }, at);
  tl.to(edge, { e: 0, c: 0, duration: 0.32, ease: 'power3.out', onUpdate: draw }, at + 0.26);
}

function leave(tl: gsap.core.Timeline, path: SVGPathElement, at: number) {
  const edge = { e: 100, c: 100 };
  const draw = () => path.setAttribute('d', fromTop(edge));
  tl.call(draw, undefined, 0);
  tl.to(edge, { e: 45, c: 95, duration: 0.34, ease: 'power2.in', onUpdate: draw }, at);
  tl.to(edge, { e: 0, c: 0, duration: 0.46, ease: 'power3.out', onUpdate: draw }, at + 0.34);
}

/**
 * Covers the page: yellow then asphalt rise, then the logo and the destination label pop in. Resolves as soon as the
 * sheets cover the viewport, so the page swap starts while the mark settles instead of after it (the hold on the
 * curtain text felt long; Sehan, 2026-10-29).
 */
export function cover(kit: MotionKit, root: HTMLElement): Promise<void> {
  const { gsap } = kit;
  const { sheets, mark } = parts(root);
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    sheets.forEach((path, i) => rise(tl, path, i * 0.09));
    tl.call(resolve, undefined, (sheets.length - 1) * 0.09 + 0.58);
    tl.fromTo(mark, { yPercent: 120, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, ease: 'expo.out', stagger: 0.06 }, 0.3);
    // A ticker that stalls (hidden tab) must not leave the visitor waiting for the push.
    window.setTimeout(() => tl.progress(1), 2500);
  });
}

/**
 * Lifts the curtain: the mark leaves upward, asphalt goes first and yellow trails it. onReveal fires as the first
 * sheet passes mid-screen, so the page entrance starts while the curtain is still moving.
 */
export function lift(kit: MotionKit, root: HTMLElement, onReveal: () => void): Promise<void> {
  const { gsap } = kit;
  const { sheets, mark } = parts(root);
  return new Promise(resolve => {
    const tl = gsap.timeline({ onComplete: resolve });
    // cover() resolves before its mark has settled, so this takes the mark over instead of fighting that tween.
    tl.to(mark, { yPercent: -70, autoAlpha: 0, duration: 0.34, ease: 'power2.in', stagger: 0.03, overwrite: 'auto' }, 0);
    // DOM order is yellow, asphalt (asphalt paints on top and leaves first).
    sheets
      .slice()
      .reverse()
      .forEach((path, i) => leave(tl, path, 0.12 + i * 0.12));
    tl.call(onReveal, undefined, 0.42);
    window.setTimeout(() => tl.progress(1), 3000);
  });
}

/** Resolves once fonts and the load event are in and the minimum hold has passed, or when the maximum hold ends. */
export function pageSettled(minMs: number, maxMs: number): Promise<void> {
  const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, Math.max(0, ms)));
  const now = performance.now();
  const fonts = document.fonts?.ready.then(() => undefined) ?? Promise.resolve();
  const loaded =
    document.readyState === 'complete' ? Promise.resolve() : new Promise<void>(r => window.addEventListener('load', () => r(), { once: true }));
  return Promise.race([Promise.all([fonts, loaded, wait(minMs - now)]).then(() => undefined), wait(maxMs - now)]);
}

/**
 * Waits for a run of smooth frames after a route change, so the curtain leaves on calm frames instead of stuttering
 * through the first paint and image decoding of the new page (min/max in ms from the call).
 */
export function framesSettled(minMs = 80, maxMs = 700): Promise<void> {
  return new Promise(resolve => {
    const start = performance.now();
    let last = start;
    let calm = 0;
    const tick = (now: number) => {
      calm = now - last < 24 ? calm + 1 : 0;
      last = now;
      const waited = now - start;
      if ((waited >= minMs && calm >= 5) || waited >= maxMs) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // requestAnimationFrame never fires in a hidden tab.
    window.setTimeout(resolve, maxMs + 400);
  });
}

/**
 * Resolves when the new page is ready to be seen: its stylesheets have loaded and its hero photo has decoded, so the
 * curtain never lifts onto an unstyled page or an empty hero (or after maxMs, whichever comes first).
 */
export function pageReady(root: HTMLElement | null, maxMs = 700): Promise<void> {
  const sheets = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .filter(link => !link.sheet)
    .map(link => new Promise<void>(r => {
      link.addEventListener('load', () => r(), { once: true });
      link.addEventListener('error', () => r(), { once: true });
    }));
  const img = root?.querySelector<HTMLImageElement>('.iz-hero img');
  const hero = img && !img.complete ? img.decode().catch(() => undefined) : Promise.resolve();
  return Promise.race([Promise.all([...sheets, hero]).then(() => undefined), new Promise<void>(r => window.setTimeout(r, maxMs))]);
}
