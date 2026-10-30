// Image URLs for v2 pages (Sehan, 2026-10-29: images in WebP, as sharp as possible). Cloudinary serves WebP at its
// highest automatic quality; c_limit never enlarges past the original, so a small source is sent at its own size
// instead of a blurred upscale. lib/utils.ts optimizeCloudinaryUrl keeps serving the old pages and the admin.
const CLD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

// Quality for photos that go through next/image (local files and the hero); the Next default of 75 softens them.
export const PHOTO_QUALITY = 90;

export function isCloudinary(url: string | null | undefined): url is string {
  return !!url && CLD.test(url);
}

export function cldWebp(url: string, width: number, height?: number): string {
  const m = url.match(CLD);
  if (!m) return url;
  const rest = m[2]
    .split('/')
    .filter(part => !/^(q_|f_|w_|h_|c_|dpr_)/.test(part))
    .join('/');
  const size = height ? `c_fill,w_${width},h_${height}` : `c_limit,w_${width}`;
  return `${m[1]}f_webp,q_auto:best,${size}/${rest}`;
}

export function cldSrcSet(url: string, widths: readonly number[]): string {
  return widths.map(w => `${cldWebp(url, w)} ${w}w`).join(', ');
}
