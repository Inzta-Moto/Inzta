import { cookies } from 'next/headers';
import { getAdminAuth } from './firebaseAdmin';

export type AdminCheck =
  | { ok: true; uid: string; email: string }
  | { ok: false; status: 401 | 403; error: string };

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Admin status comes only from server-side sources: the `admin` custom claim or the
 * ADMIN_EMAILS allowlist. An empty allowlist denies everyone (fail closed), so a missing
 * Vercel variable can never turn every Firebase user into an admin.
 */
export function isAllowedAdmin(decoded: { email?: string; admin?: unknown }): boolean {
  if (decoded.admin === true) return true;
  const email = decoded.email?.toLowerCase();
  if (!email) return false;
  return adminEmails().includes(email);
}

/** Call first in every admin write handler, before touching Firestore. */
export async function requireAdmin(): Promise<AdminCheck> {
  const sessionCookie = cookies().get('admin_session')?.value;
  if (!sessionCookie) return { ok: false, status: 401, error: 'Unauthorized' };

  let decoded;
  try {
    decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error('Verify Admin Session Error:', error);
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (!isAllowedAdmin(decoded)) return { ok: false, status: 403, error: 'Forbidden' };
  return { ok: true, uid: decoded.uid, email: decoded.email || '' };
}

// Kept for the existing /api/admin routes and the admin dashboard, which expect this shape.
export async function verifyAdminSession() {
  const sessionCookie = cookies().get('admin_session')?.value;

  if (!sessionCookie) {
    return { error: 'No session cookie' };
  }

  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (!isAllowedAdmin(decodedClaims)) {
      return { error: 'Forbidden' };
    }
    return { uid: decodedClaims.uid, decodedClaims };
  } catch (error) {
    console.error('Verify Admin Session Error:', error);
    return { error: 'Invalid or expired session' };
  }
}

export async function verifyAffiliateSession() {
  const sessionCookie = cookies().get('affiliate_session')?.value;

  if (!sessionCookie) {
    return { error: 'No session cookie' };
  }

  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decodedClaims.uid, decodedClaims };
  } catch (error) {
    console.error('Verify Affiliate Session Error:', error);
    return { error: 'Invalid or expired session' };
  }
}
