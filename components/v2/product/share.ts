// F-021: "Salin link" on the product page. Replaces the F-016 S3.3.7 share action (image share through
// navigator.share and /api/proxy-image, else WhatsApp with the link). The button now copies only the product link; a
// logged-in affiliate gets their own voucher code as ?aff=<code>, which AffiliateTracker stores for the visitor and
// useOrder auto-applies at checkout (existing S3.3.1 flow).

/** Storage keys of the affiliate session (set by the affiliate login page, cleared on logout). */
export const AFFILIATE_FLAG_KEY = 'is_affiliate_logged_in';
/** Last affiliate code seen: the logged-in affiliate's own code, or the code of the last ?aff= link visited. */
export const AFFILIATE_CODE_KEY = 'inzta_affiliate';
/** The logged-in affiliate's own voucher code ('' when the account has none). Written only at login (F-021). */
export const AFFILIATE_OWN_CODE_KEY = 'inzta_affiliate_own';

type StorageLike = Pick<Storage, 'getItem'>;

/**
 * Code to put in a shared link, or null. Only a logged-in affiliate shares a code (E3): visitors who arrived through
 * someone's ?aff= link copy the plain link. Only the own-code key counts (written at login and on every dashboard
 * visit): `inzta_affiliate` is overwritten by any ?aff= link visited later, so falling back to it could attach another
 * affiliate's code (review REV-01). A session without the own-code key copies the plain link with a hint (E5).
 */
export function affiliateShareCode(storage: StorageLike | null): string | null {
  if (!storage) return null;
  try {
    if (storage.getItem(AFFILIATE_FLAG_KEY) !== 'true') return null;
    const own = (storage.getItem(AFFILIATE_OWN_CODE_KEY) ?? '').trim();
    return own || null;
  } catch {
    return null;
  }
}

/** True for a logged-in affiliate session that has no own-code key yet (logged in before F-021). */
export function affiliateNeedsRefresh(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(AFFILIATE_FLAG_KEY) === 'true' && storage.getItem(AFFILIATE_OWN_CODE_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * The link the button copies (E2): origin + product path, without the current query or #fragment (no UTM, no
 * filters, no other affiliate's code), plus ?aff=<code> for a logged-in affiliate.
 */
export function productShareUrl(origin: string, pathname: string, code: string | null): string {
  const base = origin.replace(/\/+$/, '') + (pathname.startsWith('/') ? pathname : `/${pathname}`);
  return code ? `${base}?aff=${encodeURIComponent(code)}` : base;
}

/** Status line under the button (E5). */
export function copyMessage(result: 'ok' | 'error', url: string, code: string | null, needsRefresh = false): string {
  if (result === 'error') return `Link gagal disalin. Salin manual: ${url}`;
  if (code) return `Link disalin, sudah berisi kode affiliate ${code}.`;
  return needsRefresh ? 'Link disalin tanpa kode affiliate. Buka dashboard affiliate sekali agar link berikutnya berisi kode Anda.' : 'Link disalin.';
}
