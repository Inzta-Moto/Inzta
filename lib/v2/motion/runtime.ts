import type { gsap as Gsap } from 'gsap';
import type { ScrollTrigger as ScrollTriggerType } from 'gsap/ScrollTrigger';
import type { SplitText as SplitTextType } from 'gsap/SplitText';
import type Lenis from 'lenis';
import { CURTAIN_ATTR } from '@/lib/v2/motion/boot';
import { OVERRIDE_KEY, PROBE_KEY, TIER_ATTR, decideTier, downgrade, encodeProbe, isTier, parseOverride, readProbe, type MotionTier } from '@/lib/v2/motion/tier';

export type { MotionTier } from '@/lib/v2/motion/tier';

export type MotionKit = {
  gsap: typeof Gsap;
  ScrollTrigger: typeof ScrollTriggerType;
  SplitText: typeof SplitTextType;
};

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export const DESKTOP = '(prefers-reduced-motion: no-preference) and (min-width: 1024px)';
export const MOBILE = '(prefers-reduced-motion: no-preference) and (max-width: 1023px)';
export const HOVER = '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

// The tier the boot script wrote to html[data-iz-tier] (lib/v2/motion/tier.ts). Read once, then kept here, so a route
// that drops the attribute (admin) and comes back still knows it, and a downgrade from the frame probe is seen by every
// caller. A page whose first load skipped the boot script (it opened on an admin route) decides from the live signals.
let tier: MotionTier | null = null;
const tierListeners = new Set<(tier: MotionTier) => void>();
// ?motion= of the page load. This module first runs while the loaded page hydrates, before any client navigation, so
// the URL is still the one the boot script saw. Kept so a forced tier is known even when storage is blocked.
const loadQuery = typeof window === 'undefined' ? null : parseOverride(window.location.search);

// The QA override in force: the load URL first (as in the boot script), then the stored one; ?motion=auto clears it.
function override(): MotionTier | null {
  if (loadQuery === 'auto') return null;
  if (loadQuery) return loadQuery;
  const stored = storageGet(OVERRIDE_KEY);
  return isTier(stored) ? stored : null;
}

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function liveTier(): MotionTier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  return decideTier({
    reduced: !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    override: override(),
    saveData: !!nav.connection?.saveData,
    probe: readProbe(storageGet(PROBE_KEY), Date.now()),
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    effectiveType: nav.connection?.effectiveType,
  }).tier;
}

/** Motion tier of this visit: 'full', 'lite' (same effects, cheaper techniques) or 'minimal' (engine off). */
export function motionTier(): MotionTier {
  if (tier) return tier;
  const attr = document.documentElement.getAttribute(TIER_ATTR);
  tier = isTier(attr) ? attr : liveTier();
  return tier;
}

/** Whether scroll and entrance motion may run: the OS allows motion and the tier is above minimal. */
export function motionOn(): boolean {
  return window.matchMedia(MOTION_OK).matches && motionTier() !== 'minimal';
}

/** Whether the tier was forced with ?motion= (QA); the frame probe leaves a forced tier alone. */
export function tierForced(): boolean {
  return override() !== null;
}

/** Calls fn with the new tier whenever it changes (only ever downward). Returns an unsubscribe. */
export function onTierChange(fn: (tier: MotionTier) => void): () => void {
  tierListeners.add(fn);
  return () => {
    tierListeners.delete(fn);
  };
}

/**
 * Lowers the tier for the rest of the session (never raises it), writes the attribute and tells the listeners. With
 * persist the probe verdict is stored, so the next visits start in lite without measuring again.
 */
export function lowerTier(next: MotionTier, persist = false): void {
  const current = motionTier();
  const lowered = downgrade(current, next);
  if (lowered === current) return;
  tier = lowered;
  if (persist && lowered === 'lite') {
    try {
      window.localStorage.setItem(PROBE_KEY, encodeProbe(Date.now()));
    } catch {
      // Storage blocked: the verdict holds for this visit only.
    }
  }
  writeTierAttr();
  [...tierListeners].forEach(fn => fn(lowered));
}

// The attribute restyles the whole document (navbar blur, map timings), and the probe's verdict usually lands
// mid-scroll on the very device it slows down, so the write waits for a still moment.
let attrTimer = 0;
function writeTierAttr(): void {
  window.clearTimeout(attrTimer);
  if (!scrollIdle()) {
    attrTimer = window.setTimeout(writeTierAttr, 250);
    return;
  }
  const html = document.documentElement;
  if (tier && html.hasAttribute(TIER_ATTR)) html.setAttribute(TIER_ATTR, tier);
}

/** Keeps html[data-iz-tier] in step on client navigation: present on public v2 routes, absent elsewhere. */
export function syncTierAttr(onMotionRoute: boolean): void {
  const html = document.documentElement;
  if (onMotionRoute) html.setAttribute(TIER_ATTR, motionTier());
  else html.removeAttribute(TIER_ATTR);
}

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

// Time of the last scroll anywhere on the page (captured, so swipe rows count too). Setup work that makes GSAP read
// computed styles waits until the page has been still for a moment; run mid-scroll it cost whole frames on phones.
// A finger on the screen counts as moving too: a swipe sends no scroll event until it passes the touch slop, so a
// setup step that started in that gap still landed in the first frames of the fling (6x phone trace, 2026-10-30).
let lastScroll = 0;
let touching = 0;
let touchAt = 0;
let watchingScroll = false;

export function scrollIdle(quietMs = 180): boolean {
  if (!watchingScroll) {
    watchingScroll = true;
    const opts = { passive: true, capture: true };
    window.addEventListener('scroll', () => (lastScroll = performance.now()), opts);
    window.addEventListener(
      'touchstart',
      e => {
        touching = e.touches.length;
        touchAt = performance.now();
      },
      opts,
    );
    const lift = (e: TouchEvent) => {
      touching = e.touches.length;
      lastScroll = performance.now();
    };
    window.addEventListener('touchend', lift, opts);
    window.addEventListener('touchcancel', lift, opts);
  }
  // A touch whose end never arrived (the page went away under it) stops counting after a few seconds.
  const now = performance.now();
  return !(touching && now - touchAt < 4000) && now - lastScroll >= quietMs;
}

// When one-off motion setup last ran (the engine's deferred blocks, the HowTo build, a page attach). That work runs in
// every tier and costs whole frames on slower devices, so the frame probe leaves out the frames it lands in: the probe
// judges the steady cost of the tier, not the setup it cannot avoid.
let setupAt = 0;

export function noteSetup(): void {
  setupAt = performance.now();
}

export function lastSetup(): number {
  return setupAt;
}

/**
 * Hands elements back to their CSS after an entrance: drops the inline transform, opacity and visibility GSAP left.
 * Used instead of clearProps: 'transform', which re-parses each transform with three getComputedStyle calls as the
 * tween ends; those calls landed in the middle of scroll frames and forced full style recalcs (production profile,
 * 2026-10-29). GSAP's cached x/y stay at 0, which is what the element shows, so a later tween starts right.
 */
export function handBack(targets: Iterable<Element>): void {
  for (const el of targets) {
    const s = (el as HTMLElement).style;
    for (const p of ['transform', 'translate', 'rotate', 'scale', 'opacity', 'visibility']) s.removeProperty(p);
  }
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
