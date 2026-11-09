import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/** localStorage keys an affiliate session writes (F-017, F-021); login sets them, logout clears them. */
export const AFFILIATE_STORAGE_KEYS = ['inzta_affiliate', 'is_affiliate_logged_in', 'inzta_affiliate_own'] as const;

/**
 * Affiliate logout, moved unchanged from the old panel layout so the header and error.tsx share it. Browser only.
 * F-021 REV-02: the keys are cleared before any network call, so a failed sign-out or a network error cannot leave
 * the affiliate's code on a shared device. The redirect always happens, even when sign-out or the request fails.
 */
export async function logoutAffiliate(): Promise<void> {
  for (const key of AFFILIATE_STORAGE_KEYS) localStorage.removeItem(key);
  try {
    await signOut(auth);
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'affiliate' }),
    });
  } finally {
    window.location.href = '/affiliate/login';
  }
}
