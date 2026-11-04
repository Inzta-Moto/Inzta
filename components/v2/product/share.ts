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
 * someone's ?aff= link copy the plain link. The own-code key wins over `inzta_affiliate`, which a ?aff= link visited
 * after login overwrites; sessions that logged in before F-021 have no own-code key and fall back to it.
 */
export function affiliateShareCode(storage: StorageLike | null): string | null {
  if (!storage) return null;
  try {
    if (storage.getItem(AFFILIATE_FLAG_KEY) !== 'true') return null;
    const own = storage.getItem(AFFILIATE_OWN_CODE_KEY);
    const code = (own !== null ? own : storage.getItem(AFFILIATE_CODE_KEY) ?? '').trim();
    return code || null;
  } catch {
    return null;
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
export function copyMessage(result: 'ok' | 'error', url: string, code: string | null): string {
  if (result === 'error') return `Link gagal disalin. Salin manual: ${url}`;
  return code ? `Link disalin, sudah berisi kode affiliate ${code}.` : 'Link disalin.';
}
