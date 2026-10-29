import type { FlashSaleState } from '@/types';

// Pure flash-sale helpers (F-016 24.1, 24.3, 24.5), shared by server render, client components, and tests.

export function endsAtMs(fs: FlashSaleState): number | null {
  if (!fs.endsAt) return null;
  const ms = Date.parse(fs.endsAt);
  return Number.isNaN(ms) ? null : ms;
}

export function isFlashActive(fs: FlashSaleState, now: number): boolean {
  const end = endsAtMs(fs);
  return fs.isActive === true && end !== null && end > now;
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  ended: boolean;
}

export function countdown(endMs: number, now: number): Countdown {
  const left = Math.max(0, endMs - now);
  const s = Math.floor(left / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    ended: left === 0,
  };
}

const TZ = 'Asia/Jakarta';

// Explicit time zone and locale so server and client print the same string (no hydration mismatch).
function parts(ms: number, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('id-ID', { ...opts, timeZone: TZ, hourCycle: 'h23' }).formatToParts(new Date(ms))) {
    out[p.type] = p.value.replace('.', '');
  }
  return out;
}

// "Jumat, 31 Okt, 23.59" (promo bar, desktop)
export function formatBarLong(ms: number): string {
  const p = parts(ms, { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${p.weekday}, ${p.day} ${p.month}, ${p.hour}.${p.minute}`;
}

// "31 Okt, 23.59" (promo bar, phone)
export function formatBarShort(ms: number): string {
  const p = parts(ms, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${p.day} ${p.month}, ${p.hour}.${p.minute}`;
}

// "Jumat, 31 Oktober 2026, 23.59" (countdown panel)
export function formatPanel(ms: number): string {
  const p = parts(ms, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}, ${p.hour}.${p.minute}`;
}
