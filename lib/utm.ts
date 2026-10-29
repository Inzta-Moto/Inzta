import type { OrderUtm } from '@/types';

// F-002: UTM pertama (first touch) pengunjung. Modul murni, tanpa akses
// `window` saat dimuat, supaya /api/orders juga bisa memakai sanitizeUtm().

export const FIRST_UTM_KEY = 'inzta_first_utm';
export const FIRST_UTM_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const VALUE_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const;
const MAX_VALUE = 100;
const MAX_PATH = 200;
// Karakter kontrol + < > " ' `
const UNSAFE = /[\u0000-\u001f\u007f<>"'`]/g;

function cleanValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(UNSAFE, '').trim().toLowerCase().slice(0, MAX_VALUE);
  return s || undefined;
}

function cleanPath(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.split(/[?#]/)[0].replace(UNSAFE, '').trim().slice(0, MAX_PATH);
  return s || undefined;
}

function cleanDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 40) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** Whitelist 7 kunci; null bila source, medium, dan campaign semuanya kosong. */
export function sanitizeUtm(input: unknown): OrderUtm | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  const out: OrderUtm = {};
  for (const k of VALUE_KEYS) {
    const v = cleanValue(raw[k]);
    if (v) out[k] = v;
  }
  if (!out.source && !out.medium && !out.campaign) return null;
  const landingPath = cleanPath(raw.landingPath);
  if (landingPath) out.landingPath = landingPath;
  const capturedAt = cleanDate(raw.capturedAt);
  if (capturedAt) out.capturedAt = capturedAt;
  return out;
}

export function utmFromSearchParams(params: URLSearchParams, pathname: string, now: number): OrderUtm | null {
  return sanitizeUtm({
    source: params.get('utm_source'),
    medium: params.get('utm_medium'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
    term: params.get('utm_term'),
    landingPath: pathname,
    capturedAt: new Date(now).toISOString(),
  });
}

/** localStorage, atau null bila tidak ada/diblokir (akses langsung bisa melempar SecurityError). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** null bila tidak ada, tidak bisa di-parse, atau lebih tua dari 30 hari. */
export function readFirstTouchUtm(storage: Storage | null, now: number): OrderUtm | null {
  try {
    const raw = storage?.getItem(FIRST_UTM_KEY);
    if (!raw) return null;
    const utm = sanitizeUtm(JSON.parse(raw));
    if (!utm?.capturedAt) return null;
    const age = now - Date.parse(utm.capturedAt);
    return age >= 0 && age < FIRST_UTM_TTL_MS ? utm : null;
  } catch {
    return null;
  }
}

/** Menulis hanya bila URL ber-UTM dan belum ada record yang masih berlaku. */
export function captureFirstTouchUtm(params: URLSearchParams, pathname: string, storage: Storage | null, now: number): void {
  try {
    if (!storage) return;
    const utm = utmFromSearchParams(params, pathname, now);
    if (!utm || readFirstTouchUtm(storage, now)) return;
    storage.setItem(FIRST_UTM_KEY, JSON.stringify(utm));
  } catch {
    // localStorage penuh/diblokir: diam saja.
  }
}
