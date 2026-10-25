export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  if (typeof value !== 'string') return { error: `${field}: must be a string` };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: `${field}: required` };
  if (trimmed.length > max) return { error: `${field}: max ${max} characters` };
  return trimmed;
}

/**
 * Builds the only article fields a client may set. Anything else in the body
 * (createdAt, status, author, ...) is dropped, so a request can never overwrite
 * server-managed fields.
 */
export function parseArticleInput(body: unknown, opts: { allowLegacySlug?: boolean } = {}): ArticleInputResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body: must be a JSON object' };
  const data = body as Record<string, unknown>;

  const title = text(data.title, 'title', 1, 150);
  if (typeof title !== 'string') return { ok: false, error: title.error };

  if (typeof data.slug !== 'string' || !data.slug.trim()) return { ok: false, error: 'slug: required' };
  const slug = data.slug.trim();
  // Legacy documents created before this rule keep working when they are edited in place.
  if (!SLUG_PATTERN.test(slug) && !opts.allowLegacySlug) {
    return { ok: false, error: 'slug: use lowercase letters, numbers, and single hyphens' };
  }

  const excerpt = text(data.excerpt, 'excerpt', 0, 300);
  if (typeof excerpt !== 'string') return { ok: false, error: excerpt.error };

  const content = text(data.content, 'content', 1, 50000);
  if (typeof content !== 'string') return { ok: false, error: content.error };

  const rawImages = data.images == null ? [] : data.images;
  if (!Array.isArray(rawImages)) return { ok: false, error: 'images: must be an array' };
  if (rawImages.length > 5) return { ok: false, error: 'images: max 5' };
  const images: string[] = [];
  for (const url of rawImages) {
    if (typeof url !== 'string' || !url.startsWith(CLOUDINARY_PREFIX)) {
      return { ok: false, error: 'images: only Cloudinary URLs are allowed' };
    }
    images.push(url);
  }

  return { ok: true, value: { title, slug, excerpt, content, images } };
}
