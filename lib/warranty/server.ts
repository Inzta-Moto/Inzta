import { createHmac, timingSafeEqual } from 'crypto';
import type { CloudinaryConfig } from '@/lib/warranty/cloudinary';
import { MIN_FILL_MS } from '@/lib/warranty/rules';

// F-031 server-only helpers: environment with defaults that fail closed (design.md §11), HMAC hashes for IP and phone
// keys (3.6), and the form timer token (3.3). Never import from a client component.

export const DEFAULT_FOLDER = 'garansi-staging/';
// A form tab left open longer than this must fetch a new token (the form does it by itself on FORM_EXPIRED). Short
// enough that one token cannot be replayed for a day (review SEC-04), long enough to fill the claim form calmly.
export const FORM_TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface WarrantyRates {
  claimHour: number;
  claimDay: number;
  claimWaDay: number;
  claimGlobalDay: number;
  signHour: number;
  signGlobalDay: number;
  feedbackHour: number;
  feedbackDay: number;
  feedbackGlobalDay: number;
}

// Global daily caps (review SEC-02) keep a pool of IPs from draining the Spark write quota or the photo storage; they
// sit far above the expected volume of a few claims a day and are overridable per environment.
export const DEFAULT_RATES: WarrantyRates = {
  claimHour: 3,
  claimDay: 10,
  claimWaDay: 3,
  claimGlobalDay: 100,
  signHour: 20,
  signGlobalDay: 500,
  feedbackHour: 3,
  feedbackDay: 10,
  feedbackGlobalDay: 100,
};

// Env names of the per-environment overrides (requirement 9.4); unset on Production.
export const RATE_ENV: Record<keyof WarrantyRates, string> = {
  claimHour: 'WARRANTY_RATE_CLAIM_HOUR',
  claimDay: 'WARRANTY_RATE_CLAIM_DAY',
  claimWaDay: 'WARRANTY_RATE_CLAIM_WA_DAY',
  claimGlobalDay: 'WARRANTY_RATE_CLAIM_GLOBAL_DAY',
  signHour: 'WARRANTY_RATE_SIGN_HOUR',
  signGlobalDay: 'WARRANTY_RATE_SIGN_GLOBAL_DAY',
  feedbackHour: 'WARRANTY_RATE_FEEDBACK_HOUR',
  feedbackDay: 'WARRANTY_RATE_FEEDBACK_DAY',
  feedbackGlobalDay: 'WARRANTY_RATE_FEEDBACK_GLOBAL_DAY',
};

export interface WarrantyConfig {
  // null on Vercel Production without WARRANTY_CLOUDINARY_FOLDER: photo routes answer 503 instead of mixing real
  // photos into the staging folder (review SEC-06).
  folder: string | null;
  hashSecret: string | null;
  cloudinary: CloudinaryConfig | null;
  // null without ERP_FIREBASE_PROJECT_ID: the ERP API answers 503. No default, because staging and Production use
  // different ERP projects (inzta-erp-staging, database-inzta) and a wrong default would verify against the other one.
  erpProjectId: string | null;
  staff: string;
  origins: string;
  rates: WarrantyRates;
  production: boolean;
}

/**
 * Warranty photos live in their own Cloudinary account (Angkasa, 2026-11-11), named by CLOUDINARY_URL
 * (cloudinary://<api_key>:<api_secret>@<cloud_name>). The product cloud in lib/constants is never used here.
 */
export function parseCloudinaryUrl(raw: string | undefined): CloudinaryConfig | null {
  const m = /^cloudinary:\/\/([^:@\s]+):([^@\s]+)@([a-z0-9_-]+)\/?$/i.exec((raw || '').trim());
  if (!m) return null;
  try {
    return { apiKey: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3] };
  } catch {
    return null;
  }
}

/** Reads the warranty env; every missing value fails closed (503 or 403), never open. */
export function warrantyConfig(env: NodeJS.ProcessEnv = process.env): WarrantyConfig {
  const production = env.VERCEL_ENV === 'production';
  const rawFolder = (env.WARRANTY_CLOUDINARY_FOLDER || '').trim();
  const validFolder = /^[a-z0-9-]+\/?$/.test(rawFolder) ? rawFolder.replace(/\/?$/, '/') : null;
  const rates = { ...DEFAULT_RATES };
  for (const key of Object.keys(RATE_ENV) as (keyof WarrantyRates)[]) {
    const n = Number(env[RATE_ENV[key]]);
    if (Number.isInteger(n) && n > 0) rates[key] = n;
  }
  const hashSecret = (env.WARRANTY_HASH_SECRET || '').trim();
  return {
    folder: validFolder ?? (production ? null : DEFAULT_FOLDER),
    hashSecret: hashSecret.length >= 16 ? hashSecret : null,
    cloudinary: parseCloudinaryUrl(env.CLOUDINARY_URL),
    erpProjectId: /^[a-z0-9-]{4,40}$/.test((env.ERP_FIREBASE_PROJECT_ID || '').trim()) ? (env.ERP_FIREBASE_PROJECT_ID as string).trim() : null,
    staff: env.WARRANTY_ERP_STAFF || '',
    origins: env.WARRANTY_ERP_ORIGINS || '',
    rates,
    production,
  };
}

function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * The rate-limit bucket of an address: IPv4 as is, IPv6 by its /64 prefix, because one subscriber usually holds a whole
 * /64 and could otherwise rotate addresses inside it (review SEC-02).
 */
export function ipBucket(ip: string): string {
  if (!ip.includes(':')) return ip;
  const clean = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(clean)) return clean.slice(7);
  const [head, tail = ''] = clean.split('::');
  const h = head ? head.split(':') : [];
  const t = clean.includes('::') && tail ? tail.split(':') : [];
  const groups = clean.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map(g => (g || '0').replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** HMAC-SHA256 of the IP bucket; the clear IP is never stored (3.6). 32 hex characters keep rate-limit keys short. */
export function ipHash(secret: string, ip: string): string {
  return hmacHex(secret, `ip:${ipBucket(ip)}`).slice(0, 32);
}

export function whatsappHash(secret: string, whatsapp: string): string {
  return hmacHex(secret, `wa:${whatsapp}`).slice(0, 32);
}

/** Client IP as Vercel reports it; Vercel overwrites these headers, so a client cannot choose its own bucket. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const real = headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();
  const fwd = headers.get('x-forwarded-for');
  if (fwd && fwd.split(',')[0].trim()) return fwd.split(',')[0].trim();
  return 'unknown';
}

function tokenMac(secret: string, issuedAt: number, ipKey: string): string {
  return createHmac('sha256', secret).update(`form:${issuedAt}:${ipKey}`).digest('base64url').slice(0, 32);
}

/**
 * Timer token of the 5-second rule (3.3). Issued by GET /api/garansi/form-token when the form mounts, because the
 * page is ISR: a token printed into the cached HTML would always look old enough. Bound to the hashed IP bucket, so a
 * token fetched once cannot be shared across a pool of addresses (review SEC-04).
 */
export function issueFormToken(secret: string, now: number, ipKey: string): string {
  return `${now}.${tokenMac(secret, now, ipKey)}`;
}

export type FormTokenCheck = 'ok' | 'too-fast' | 'invalid';

export function checkFormToken(secret: string, token: unknown, now: number, ipKey: string): FormTokenCheck {
  if (typeof token !== 'string' || token.length > 80) return 'invalid';
  const [ts, mac] = token.split('.');
  const issuedAt = Number(ts);
  if (!Number.isInteger(issuedAt) || !mac) return 'invalid';
  const expected = Buffer.from(tokenMac(secret, issuedAt, ipKey));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid';
  const age = now - issuedAt;
  if (age < 0 || age > FORM_TOKEN_MAX_AGE_MS) return 'invalid';
  return age < MIN_FILL_MS ? 'too-fast' : 'ok';
}
