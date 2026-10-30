import { lastSetup, lowerTier, motionTier, tierForced } from '@/lib/v2/motion/runtime';
import { PROBE_MAX_GAP_MS, probeSaysLite } from '@/lib/v2/motion/tier';

// About 1.5 s of frames once the curtain is up (the hero entrance is playing), then the first ~2 s of scrolling.
const IDLE_MS = 1500;
const SCROLL_MS = 2000;
// A frame counts as a scroll frame when the page scrolled this recently; after this long without a scroll the
// sampler stops and waits for the next one.
const SCROLL_FRESH_MS = 200;
const SCROLL_QUIET_MS = 1000;

export type Probe = { pause: () => void; resume: () => void; stop: () => void };

const NOOP: Probe = { pause: () => {}, resume: () => {}, stop: () => {} };

/**
 * Frame probe for the full tier (Sehan, 2026-10-30): measures requestAnimationFrame gaps while the page settles and
 * while the visitor first scrolls, and lowers the tier to lite for good (tier.ts probeSaysLite, verdict stored for 14
 * days) when the device cannot hold the frame rate. It only records timestamps: no layout or style reads. pause() and
 * resume() bracket route changes, which are not representative frames; a hidden tab pauses it too. Does nothing when
 * the tier is already below full or was forced with ?motion=.
 */
export function startProbe(): Probe {
  if (motionTier() !== 'full' || tierForced()) return NOOP;
  let phase: 'idle' | 'wait' | 'scroll' | 'done' = 'idle';
  let frame = 0;
  let last = 0;
  let paused = false;
  let elapsed = 0;
  let lastScroll = 0;
  const idleGaps: number[] = [];
  const scrollGaps: number[] = [];

  const finish = (lite: boolean) => {
    stop();
    if (lite) lowerTier('lite', true);
  };

  const tick = (now: number) => {
    frame = 0;
    if (phase === 'done' || paused) return;
    const prev = last;
    const gap = prev ? now - prev : 0;
    last = now;
    // A gap that one-off setup ran in (runtime noteSetup, e.g. the engine's deferred blocks, which start while the
    // idle window is still open) is left out like a hidden-tab gap: setup runs in lite too, so it says nothing about
    // the tier.
    if (gap > 0 && gap < PROBE_MAX_GAP_MS && lastSetup() < prev) {
      if (phase === 'idle') {
        idleGaps.push(gap);
        elapsed += gap;
        if (elapsed >= IDLE_MS) {
          if (probeSaysLite(idleGaps)) return finish(true);
          phase = 'wait';
          elapsed = 0;
          last = 0;
          return;
        }
      } else if (phase === 'scroll') {
        if (now - lastScroll <= SCROLL_FRESH_MS) {
          scrollGaps.push(gap);
          elapsed += gap;
          if (elapsed >= SCROLL_MS) return finish(probeSaysLite(scrollGaps));
        } else if (now - lastScroll > SCROLL_QUIET_MS) {
          phase = 'wait';
          last = 0;
          return;
        }
      }
    }
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (!frame && !paused && phase !== 'done' && phase !== 'wait') frame = requestAnimationFrame(tick);
  };
  const halt = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    // The next frame after a pause must not count the time spent paused.
    last = 0;
  };
  const onScroll = () => {
    lastScroll = performance.now();
    if (phase === 'wait') {
      phase = 'scroll';
      run();
    }
  };
  const onVisibility = () => (document.hidden ? halt() : run());

  function stop() {
    phase = 'done';
    halt();
    window.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onVisibility);
  run();

  return {
    pause() {
      paused = true;
      halt();
    },
    resume() {
      if (!paused) return;
      paused = false;
      run();
    },
    stop,
  };
}
