import { SLUG_PATTERN } from './slug';

export { SLUG_PATTERN };

const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';

export type ArticleFields = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  images: string[];
};

export type ArticleInputResult =
  | { ok: true; value: ArticleFields }
  | { ok: false; error: string };

function text(value: unknown, field: string, min: number, max: number): string | { error: string } {
  if (value == null) value = '';
  if (typeof value !== 'string') return { error: `${field}: harus berupa teks` };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: `${field}: wajib diisi` };
  if (trimmed.length > max) return { error: `${field}: maksimal ${max} karakter` };
  return trimmed;
}

/**
 * Builds the only article fields a client may set. Anything else in the body
 * (createdAt, status, author, ...) is dropped, so a request can never overwrite
 * server-managed fields.
 */
export function parseArticleInput(body: unknown, opts: { allowLegacySlug?: boolean } = {}): ArticleInputResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body: format data tidak valid' };
  const data = body as Record<string, unknown>;

  const title = text(data.title, 'title', 1, 150);
  if (typeof title !== 'string') return { ok: false, error: title.error };

  if (typeof data.slug !== 'string' || !data.slug.trim()) return { ok: false, error: 'slug: wajib diisi' };
  const slug = data.slug.trim();
  // Legacy documents created before this rule keep working when they are edited in place.
  if (!SLUG_PATTERN.test(slug) && !opts.allowLegacySlug) {
    return { ok: false, error: 'slug: hanya huruf kecil, angka, dan tanda hubung tunggal' };
  }

  const excerpt = text(data.excerpt, 'excerpt', 0, 300);
  if (typeof excerpt !== 'string') return { ok: false, error: excerpt.error };

  const content = text(data.content, 'content', 1, 50000);
  if (typeof content !== 'string') return { ok: false, error: content.error };

  const rawImages = data.images == null ? [] : data.images;
  if (!Array.isArray(rawImages)) return { ok: false, error: 'images: format tidak valid' };
  if (rawImages.length > 5) return { ok: false, error: 'images: maksimal 5 gambar' };
  const images: string[] = [];
  for (const url of rawImages) {
    if (typeof url !== 'string' || !url.startsWith(CLOUDINARY_PREFIX)) {
      return { ok: false, error: 'images: hanya gambar yang diunggah lewat panel (Cloudinary)' };
    }
    images.push(url);
  }

  return { ok: true, value: { title, slug, excerpt, content, images } };
}
