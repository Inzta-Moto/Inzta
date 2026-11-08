// F-022: product photo limits and the pure helpers behind the admin uploader (components/ImageUpload.tsx), the
// product API validation (app/api/products/_helpers.ts), and the product page gallery (components/v2/product/Gallery.tsx).
// Browser-safe: no Node or Firebase imports.

/**
 * Most photos one product may carry (simple products and the gallery of variable products). Ten = the INZTA photo
 * template (one INZTA template photo + photos 1–9: front, left, right, back, top, inside, detail, on the motorcycle,
 * package contents), the nine marketplace slots (Shopee, TikTok Shop/Tokopedia) plus one, and Google Merchant Center's
 * main image + up to ten additional images. Decision: owner of the website team, 6 Nov 2026 (spec F-022).
 */
export const PRODUCT_IMAGE_MAX = 10;

/** Photos per variant stay at one (colour or side photo, like a marketplace variant photo). */
export const VARIANT_IMAGE_MAX = 1;

/** Longest accepted image URL; Cloudinary secure URLs are far shorter. */
export const IMAGE_URL_MAX_LENGTH = 2048;

export type ImageListError = { code: 'INVALID_IMAGES' | 'IMAGES_TOO_MANY'; message: string };

/**
 * Validates an `images` value from a request body. `undefined` and `null` are valid (the builders then fall back to
 * imageUrl or []), anything else must be an array of at most `max` non-empty strings no longer than IMAGE_URL_MAX_LENGTH.
 */
export function validateImageList(value: unknown, max: number = PRODUCT_IMAGE_MAX, label = 'produk'): ImageListError | null {
  // null is what older clients send for "no photos"; the builders already treat it like a missing list.
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value))
    return { code: 'INVALID_IMAGES', message: `Daftar foto ${label} tidak valid.` };
  if (value.length > max)
    return { code: 'IMAGES_TOO_MANY', message: `Maksimal ${max} foto ${label} (sekarang ${value.length}). Hapus sebagian lalu simpan lagi.` };
  for (const v of value)
    if (typeof v !== 'string' || !v.trim() || v.length > IMAGE_URL_MAX_LENGTH)
      return { code: 'INVALID_IMAGES', message: `Daftar foto ${label} tidak valid.` };
  return null;
}

/**
 * Splits the files an admin picked or dropped into those that fit the remaining slots and those that do not, keeping
 * the picked order. `current` is the number of photos already in the list.
 */
export function planUpload<T>(files: readonly T[], current: number, max: number): { accepted: T[]; skipped: number } {
  const room = Math.max(0, max - Math.max(0, current));
  const accepted = files.slice(0, room);
  return { accepted, skipped: files.length - accepted.length };
}

/** Returns a copy of `list` with the item at `from` moved to `to`; out-of-range or equal indexes return a plain copy. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Text shown to the admin after a batch upload, or '' when every picked file was uploaded. */
export function uploadSummary(opts: { uploaded: number; skipped: number; failed: { name: string; reason: string }[]; max: number }): string {
  const parts: string[] = [];
  if (opts.skipped > 0) parts.push(`${opts.skipped} foto tidak diunggah karena batasnya ${opts.max} foto.`);
  for (const f of opts.failed) parts.push(`${f.name}: ${f.reason}`);
  if (parts.length && opts.uploaded > 0) parts.unshift(`${opts.uploaded} foto berhasil diunggah.`);
  return parts.join(' ');
}

/**
 * Gallery navigation: index of the previous or next photo tile from `active`, wrapping around, skipping placeholders.
 * `photos` holds the tile indexes of photos in order. Returns -1 when there is no photo.
 */
export function stepPhoto(photos: readonly number[], active: number, dir: -1 | 1): number {
  if (photos.length === 0) return -1;
  const at = photos.indexOf(active);
  if (at === -1) return dir > 0 ? photos[0] : photos[photos.length - 1];
  return photos[(at + dir + photos.length) % photos.length];
}

/** 1-based position of the active photo among the photo tiles, for the "3/10" counter; null when not a photo. */
export function photoPosition(photos: readonly number[], active: number): { index: number; total: number } | null {
  const at = photos.indexOf(active);
  return at === -1 ? null : { index: at + 1, total: photos.length };
}

/**
 * Horizontal swipe on the main photo: 'next' for a leftward swipe, 'prev' for a rightward one, null for taps, short
 * moves, and mostly vertical moves (page scrolling stays untouched).
 */
export function swipeDirection(dx: number, dy: number, threshold = 40): 'next' | 'prev' | null {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'prev';
}

/**
 * scrollLeft that brings a thumbnail fully into view in its horizontal strip, or null when it already is.
 * Positions are in the strip's coordinate space (offsetLeft relative to the strip).
 */
export function thumbScrollLeft(strip: { scrollLeft: number; clientWidth: number }, thumb: { left: number; width: number }, pad = 4): number | null {
  if (thumb.left - pad < strip.scrollLeft) return Math.max(0, thumb.left - pad);
  if (thumb.left + thumb.width + pad > strip.scrollLeft + strip.clientWidth) return thumb.left + thumb.width + pad - strip.clientWidth;
  return null;
}

/**
 * Stable React keys for an image list: the URL plus its occurrence number, so a moved photo keeps its DOM node (and
 * the focused arrow button) and duplicate legacy URLs still get unique keys.
 */
export function imageKeys(list: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return list.map(url => {
    const n = seen.get(url) ?? 0;
    seen.set(url, n + 1);
    return `${url}#${n}`;
  });
}

/**
 * After an arrow-button move to index `to`, the arrow to focus on the moved photo: the same direction while the photo
 * can still move that way, else the opposite one (the pressed one is disabled at either end).
 */
export function focusAfterMove(to: number, length: number, dir: 'kiri' | 'kanan'): 'kiri' | 'kanan' {
  if (dir === 'kiri') return to > 0 ? 'kiri' : 'kanan';
  return to < length - 1 ? 'kanan' : 'kiri';
}
