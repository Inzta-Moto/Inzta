import type { ContentFormat } from '@/types';
import { SLUG_PATTERN } from './slug';
import { RESERVED_ARTICLE_SLUGS } from './constants';
import { isAllowedImageUrl } from './article-format';

export { SLUG_PATTERN };

export type ArticleFields = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: ContentFormat;
  images: string[];
  coverImage: string;
  coverAlt: string;
  metaTitle: string;
  metaDescription: string;
};

export type ArticleInputResult =
  | { ok: true; value: ArticleFields }
  | { ok: false; error: string };

export interface ArticleInputOptions {
  // Legacy documents created before the slug rule keep working when they are edited in place.
  allowLegacySlug?: boolean;
  // Format of the stored document on update; absent on create, where new articles are always Markdown.
  currentFormat?: ContentFormat;
}

function text(value: unknown, field: string, min: number, max: number): string | { error: string } {
  if (value == null) value = '';
  if (typeof value !== 'string') return { error: `${field}: harus berupa teks` };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: `${field}: wajib diisi` };
  if (trimmed.length > max) return { error: `${field}: maksimal ${max} karakter` };
  return trimmed;
}

/**
 * Builds the only article fields a client may set. Anything else in the body (createdAt, status,
 * publishedAt, author, source, ...) is dropped, so a request can never overwrite server-managed fields.
 * Only title and slug are required here: a draft may be empty, and the publish checks
 * (lib/article-checklist.ts) run separately at publish and when a published article is saved.
 * The caps on cover alt and meta fields are abuse limits, not SEO limits (ADR-0014).
 */
export function parseArticleInput(body: unknown, opts: ArticleInputOptions = {}): ArticleInputResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body: format data tidak valid' };
  const data = body as Record<string, unknown>;

  const title = text(data.title, 'title', 1, 150);
  if (typeof title !== 'string') return { ok: false, error: title.error };

  if (typeof data.slug !== 'string' || !data.slug.trim()) return { ok: false, error: 'slug: wajib diisi' };
  const slug = data.slug.trim();
  if (!SLUG_PATTERN.test(slug) && !opts.allowLegacySlug) {
    return { ok: false, error: 'slug: hanya huruf kecil, angka, dan tanda hubung tunggal' };
  }
  if (RESERVED_ARTICLE_SLUGS.includes(slug)) return { ok: false, error: `slug: "${slug}" dipakai sistem, pilih slug lain` };

  const fields: Record<string, [number, number]> = {
    excerpt: [0, 300],
    content: [0, 50000],
    coverAlt: [0, 200],
    metaTitle: [0, 200],
    metaDescription: [0, 500],
  };
  const values: Record<string, string> = {};
  for (const [field, [min, max]] of Object.entries(fields)) {
    const v = text(data[field], field, min, max);
    if (typeof v !== 'string') return { ok: false, error: v.error };
    values[field] = v;
  }

  const coverImage = data.coverImage == null ? '' : data.coverImage;
  if (typeof coverImage !== 'string' || (coverImage !== '' && !isAllowedImageUrl(coverImage))) {
    return { ok: false, error: 'coverImage: hanya gambar yang diunggah lewat panel (Cloudinary INZTA)' };
  }

  // New articles are always Markdown, whatever the body says. On update, Markdown is one-way
  // (requirement 1.6): a request may convert a plain article, never the reverse.
  let contentFormat: ContentFormat = opts.currentFormat ?? 'markdown';
  if (opts.currentFormat && data.contentFormat != null) {
    if (data.contentFormat === 'markdown') contentFormat = 'markdown';
    else if (data.contentFormat !== contentFormat) {
      return { ok: false, error: 'contentFormat: artikel hanya bisa diubah ke Markdown' };
    }
  }

  // The legacy gallery belongs to plain articles; Markdown articles carry their images inline.
  const images: string[] = [];
  if (contentFormat === 'plain') {
    const rawImages = data.images == null ? [] : data.images;
    if (!Array.isArray(rawImages)) return { ok: false, error: 'images: format tidak valid' };
    if (rawImages.length > 5) return { ok: false, error: 'images: maksimal 5 gambar' };
    for (const url of rawImages) {
      if (!isAllowedImageUrl(url)) return { ok: false, error: 'images: hanya gambar yang diunggah lewat panel (Cloudinary INZTA)' };
      images.push(url);
    }
  }

  return {
    ok: true,
    value: {
      title,
      slug,
      excerpt: values.excerpt,
      content: values.content,
      contentFormat,
      images,
      coverImage,
      coverAlt: values.coverAlt,
      metaTitle: values.metaTitle,
      metaDescription: values.metaDescription,
    },
  };
}
