import { createHmac, timingSafeEqual } from 'crypto';
import { CLOUDINARY_CLOUD } from '@/lib/constants';
import type { CloudinaryConfig } from '@/lib/warranty/cloudinary';
import { MAX_FORM_AGE_MS, MIN_FILL_MS } from '@/lib/warranty/rules';

// F-031 server-only helpers: environment with safe defaults (design.md §11), HMAC hashes for IP and phone keys (3.6),
// and the form timer token (3.3). Never import from a client component.

export const DEFAULT_FOLDER = 'garansi-staging/';
export const DEFAULT_ERP_PROJECT = 'database-inzta';

export interface WarrantyRates {
  claimHour: number;
  claimDay: number;
  claimWaDay: number;
  signHour: number;
  feedbackHour: number;
  feedbackDay: number;
  feedbackGlobalDay: number;
}

export const DEFAULT_RATES: WarrantyRates = {
  claimHour: 3,
  claimDay: 10,
  claimWaDay: 3,
  signHour: 30,
  feedbackHour: 3,
  feedbackDay: 10,
  feedbackGlobalDay: 100,
};

// Env names of the per-environment overrides (requirement 9.4); unset on Production.
export const RATE_ENV: Record<keyof WarrantyRates, string> = {
  claimHour: 'WARRANTY_RATE_CLAIM_HOUR',
  claimDay: 'WARRANTY_RATE_CLAIM_DAY',
  claimWaDay: 'WARRANTY_RATE_CLAIM_WA_DAY',
  signHour: 'WARRANTY_RATE_SIGN_HOUR',
  feedbackHour: 'WARRANTY_RATE_FEEDBACK_HOUR',
  feedbackDay: 'WARRANTY_RATE_FEEDBACK_DAY',
  feedbackGlobalDay: 'WARRANTY_RATE_FEEDBACK_GLOBAL_DAY',
};

export interface WarrantyConfig {
  folder: string;
  hashSecret: string | null;
  cloudinary: CloudinaryConfig | null;
  erpProjectId: string;
  staff: string;
  origins: string;
  rates: WarrantyRates;
  production: boolean;
}

/** Reads the warranty env with defaults that fail closed: no secret → public routes answer 503, no staff → nobody. */
export function warrantyConfig(env: NodeJS.ProcessEnv = process.env): WarrantyConfig {
  const rawFolder = (env.WARRANTY_CLOUDINARY_FOLDER || '').trim();
  const folder = /^[a-z0-9-]+\/?$/.test(rawFolder) ? rawFolder.replace(/\/?$/, '/') : DEFAULT_FOLDER;
  const apiKey = (env.CLOUDINARY_API_KEY || '').trim();
  const secret = (env.CLOUDINARY_API_SECRET || '').trim();
  const rates = { ...DEFAULT_RATES };
  for (const key of Object.keys(RATE_ENV) as (keyof WarrantyRates)[]) {
    const n = Number(env[RATE_ENV[key]]);
    if (Number.isInteger(n) && n > 0) rates[key] = n;
  }
  const hashSecret = (env.WARRANTY_HASH_SECRET || '').trim();
  return {
    folder,
    hashSecret: hashSecret.length >= 16 ? hashSecret : null,
    cloudinary: apiKey && secret ? { cloud: CLOUDINARY_CLOUD, apiKey, secret } : null,
    erpProjectId: (env.ERP_FIREBASE_PROJECT_ID || '').trim() || DEFAULT_ERP_PROJECT,
    staff: env.WARRANTY_ERP_STAFF || '',
    origins: env.WARRANTY_ERP_ORIGINS || '',
    rates,
    production: env.NODE_ENV === 'production',
  };
}

function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** HMAC-SHA256 of the IP; the clear IP is never stored (3.6). 32 hex characters keep rate-limit keys short. */
export function ipHash(secret: string, ip: string): string {
  return hmacHex(secret, `ip:${ip}`).slice(0, 32);
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

function tokenMac(secret: string, issuedAt: number): string {
  return createHmac('sha256', secret).update(`form:${issuedAt}`).digest('base64url').slice(0, 32);
}

/**
 * Timer token of the 5-second rule (3.3). Issued by GET /api/garansi/form-token when the form mounts, because the
 * page is ISR: a token printed into the cached HTML would always look old enough.
 */
export function issueFormToken(secret: string, now: number): string {
  return `${now}.${tokenMac(secret, now)}`;
}

export type FormTokenCheck = 'ok' | 'too-fast' | 'invalid';

export function checkFormToken(secret: string, token: unknown, now: number): FormTokenCheck {
  if (typeof token !== 'string' || token.length > 80) return 'invalid';
  const [ts, mac] = token.split('.');
  const issuedAt = Number(ts);
  if (!Number.isInteger(issuedAt) || !mac) return 'invalid';
  const expected = Buffer.from(tokenMac(secret, issuedAt));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid';
  const age = now - issuedAt;
  if (age < 0 || age > MAX_FORM_AGE_MS) return 'invalid';
  return age < MIN_FILL_MS ? 'too-fast' : 'ok';
}
