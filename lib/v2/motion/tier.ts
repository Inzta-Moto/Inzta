// Motion tiers (F-016, agreed with Sehan 2026-10-30). "full" is the site as designed; "lite" keeps every effect with a
// cheaper technique (lower density, finite repetitions, CSS transitions instead of per-frame tweens) for phones and
// laptops that cannot hold the frame rate; "minimal" is the reduced-motion path (OS setting or Save-Data). This module is
// pure, so the decision can be unit tested; the inline boot script (boot.ts) mirrors decideTier() and a test runs both
// over the same signal matrix.
export type MotionTier = 'full' | 'lite' | 'minimal';
export type TierSource = 'reduced' | 'override' | 'save-data' | 'probe' | 'hints' | 'default';

export const TIER_ATTR = 'data-iz-tier';
// QA override: ?motion=full|lite|minimal is kept in localStorage under this key; ?motion=auto clears it.
export const OVERRIDE_KEY = 'iz-motion';
// Verdict of the runtime frame probe, stored as "lite:<epoch ms>" and trusted for PROBE_TTL_MS.
export const PROBE_KEY = 'iz-motion-probe';
export const PROBE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
// Network types slow enough that the lite tier is the better first experience.
export const SLOW_NETWORKS = ['slow-2g', '2g', '3g'];

const RANK: Record<MotionTier, number> = { minimal: 0, lite: 1, full: 2 };

export function isTier(value: unknown): value is MotionTier {
  return value === 'full' || value === 'lite' || value === 'minimal';
}

/** Reads ?motion= from a query string: a tier, 'auto' (clear the stored override) or null (parameter absent or unknown). */
export function parseOverride(search: string): MotionTier | 'auto' | null {
  const m = /[?&]motion=(full|lite|minimal|auto)(?:&|$)/.exec(search);
  return m ? (m[1] as MotionTier | 'auto') : null;
}

export function encodeProbe(now: number): string {
  return `lite:${Math.round(now)}`;
}

/** A stored probe verdict is honoured for 14 days; a timestamp in the future (clock change) counts as expired. */
export function readProbe(raw: string | null | undefined, now: number): 'lite' | null {
  const m = /^lite:(\d+)$/.exec(raw ?? '');
  if (!m) return null;
  const age = now - Number(m[1]);
  return age >= 0 && age < PROBE_TTL_MS ? 'lite' : null;
}

export type DeviceHints = { deviceMemory?: number; cores?: number; effectiveType?: string };

/**
 * Hints that point at a device or network where the lite tier fits better. Missing APIs (Safari, Firefox) are no hint.
 * The core count only counts where deviceMemory exists too (Chromium, which reports real cores): Safari caps the
 * count it reports for fingerprinting (every iPhone says 4 or less), so there the frame probe decides instead.
 */
export function liteHints({ deviceMemory, cores, effectiveType }: DeviceHints): boolean {
  if (typeof deviceMemory === 'number' && deviceMemory > 0 && deviceMemory <= 4) return true;
  if (typeof deviceMemory === 'number' && typeof cores === 'number' && cores > 0 && cores <= 4) return true;
  return typeof effectiveType === 'string' && SLOW_NETWORKS.includes(effectiveType);
}

export type TierSignals = DeviceHints & {
  reduced: boolean;
  saveData: boolean;
  override: MotionTier | null;
  probe: 'lite' | null;
};

/**
 * Picks the tier. The OS reduced-motion setting comes first, even before the QA override: the engine and the CSS gate
 * their motion on that media query, so a forced "full" could not be honoured and the attribute would lie. Then the
 * override, Save-Data, a stored probe verdict, device and network hints, and finally full.
 */
export function decideTier(s: TierSignals): { tier: MotionTier; source: TierSource } {
  if (s.reduced) return { tier: 'minimal', source: 'reduced' };
  if (s.override) return { tier: s.override, source: 'override' };
  if (s.saveData) return { tier: 'minimal', source: 'save-data' };
  if (s.probe) return { tier: 'lite', source: 'probe' };
  if (liteHints(s)) return { tier: 'lite', source: 'hints' };
  return { tier: 'full', source: 'default' };
}

/** Within a session the tier only ever goes down. */
export function downgrade(current: MotionTier, next: MotionTier): MotionTier {
  return RANK[next] < RANK[current] ? next : current;
}

// Frame gaps longer than this are a hidden tab or a debugger pause, not jank, and are left out of the verdict.
export const PROBE_MAX_GAP_MS = 500;
export const PROBE_MIN_SAMPLES = 30;

/**
 * Verdict of the frame probe over requestAnimationFrame gaps (ms): lite when the 75th percentile is slower than about
 * 45 fps (> 22 ms) or when at least a fifth of the frames missed two refreshes at 60 Hz (> 34 ms). Too few samples
 * give no verdict.
 */
export function probeSaysLite(gaps: readonly number[]): boolean {
  const kept = gaps.filter(g => g > 0 && g < PROBE_MAX_GAP_MS).sort((a, b) => a - b);
  if (kept.length < PROBE_MIN_SAMPLES) return false;
  const p75 = kept[Math.min(kept.length - 1, Math.ceil(kept.length * 0.75) - 1)];
  const slow = kept.filter(g => g > 34).length;
  return p75 > 22 || slow >= kept.length * 0.2;
}
