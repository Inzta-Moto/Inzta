import type { WarrantyStaffRole } from '@/types';
import { isAllowedOrigin, parseStaffList } from '@/lib/warranty/rules';
import type { WarrantyConfig } from '@/lib/warranty/server';

// F-031 ERP API guard (requirements 5.1, 5.1a, 6.3a; design.md §5, option B). The ERP sends a Firebase ID token of
// project database-inzta; the website verifies it with Google's public keys and an app that only knows the project id,
// so it holds no service account and no access to the ERP database. The Authorization header is never logged.

export interface ErpStaff {
  uid: string;
  email: string | null;
  role: WarrantyStaffRole;
}

export interface DecodedToken {
  uid: string;
  email?: string;
  aud?: string;
  iss?: string;
}

export type TokenVerifier = (token: string) => Promise<DecodedToken>;

export type AuthResult = { ok: true; staff: ErpStaff } | { ok: false; status: 401 | 403; code: string; error: string };

const UNAUTHENTICATED = { ok: false as const, status: 401 as const, code: 'UNAUTHENTICATED', error: 'Sesi habis, silakan masuk lagi.' };
const FORBIDDEN = { ok: false as const, status: 403 as const, code: 'FORBIDDEN', error: 'Akun ini tidak punya akses ke menu ini.' };

/** 401 without a valid token of the ERP project, 403 for a valid token whose UID is not listed as admin (R1). */
export async function authorize(authHeader: string | null, verify: TokenVerifier, cfg: Pick<WarrantyConfig, 'erpProjectId' | 'staff'>): Promise<AuthResult> {
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(authHeader || '');
  if (!m) return UNAUTHENTICATED;
  let decoded: DecodedToken;
  try {
    decoded = await verify(m[1]);
  } catch {
    return UNAUTHENTICATED;
  }
  // verifyIdToken already checks audience and issuer against the project; repeated so an injected verifier cannot drift.
  if (!decoded || !decoded.uid || decoded.aud !== cfg.erpProjectId || decoded.iss !== `https://securetoken.google.com/${cfg.erpProjectId}`) return UNAUTHENTICATED;
  const role = parseStaffList(cfg.staff).get(decoded.uid);
  // Release 1 knows the admin role only; produksi comes with the ERP role work of release 2 (5.8).
  if (role !== 'admin') return FORBIDDEN;
  return { ok: true, staff: { uid: decoded.uid, email: decoded.email ?? null, role } };
}

/** CORS headers for every ERP API response, including errors (5.1a, 6.3a); no Allow-Origin for unknown origins. */
export function erpCorsHeaders(origin: string | null, cfg: Pick<WarrantyConfig, 'origins'>): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin', 'Cache-Control': 'no-store' };
  if (origin && isAllowedOrigin(origin, cfg.origins)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    h['Access-Control-Allow-Methods'] = 'GET, PATCH, DELETE, OPTIONS';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}

/** Preflight: 204 with the CORS headers for an allowed origin, 403 otherwise. */
export function erpPreflight(origin: string | null, cfg: Pick<WarrantyConfig, 'origins'>): { status: number; headers: Record<string, string> } {
  const headers = erpCorsHeaders(origin, cfg);
  return { status: headers['Access-Control-Allow-Origin'] ? 204 : 403, headers };
}

let verifierPromise: Promise<TokenVerifier> | null = null;

/**
 * The real verifier: a second firebase-admin app named "erp" with only the ERP project id. Looked up before init, so
 * warm starts never throw "already exists", and named, so it can never take the [DEFAULT] slot of lib/firebaseAdmin
 * (review REV-05). Revocation is not checked (that needs credentials), so a revoked token works until it expires.
 */
export function erpTokenVerifier(projectId: string): Promise<TokenVerifier> {
  if (!verifierPromise) {
    verifierPromise = (async () => {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.NODE_ENV === 'production') {
        // The emulator flag makes verifyIdToken accept unsigned tokens; it must never be set on Vercel.
        throw new Error('FIREBASE_AUTH_EMULATOR_HOST is set in production');
      }
      const { getApps, initializeApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const app = getApps().find(a => a.name === 'erp') ?? initializeApp({ projectId }, 'erp');
      const auth = getAuth(app);
      return async (token: string) => {
        const d = await auth.verifyIdToken(token, false);
        return { uid: d.uid, email: d.email, aud: d.aud, iss: d.iss };
      };
    })().catch(e => {
      verifierPromise = null;
      throw e;
    });
  }
  return verifierPromise;
}
