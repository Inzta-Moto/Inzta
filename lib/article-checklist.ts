import type { Article, ChecklistItem, ChecklistResult, RenderWarning } from '@/types';
import { RESERVED_ARTICLE_SLUGS } from '@/lib/constants';
import { SLUG_PATTERN } from '@/lib/slug';
import { extractBodyImages, formatOf, hasH1, isAllowedImageUrl } from '@/lib/article-format';

// Pre-publish checks (F-012 requirement 10), pure so the editor, PUT on a published article, and the
// publish route all apply the same rules. Meta lengths follow ADR-0014: a guideline, never a block.
export const META_TITLE_GUIDE = 60;
export const META_DESCRIPTION_GUIDE = 155;
export const COVER_MIN_WIDTH = 1200;

export type ChecklistInput = Pick<Article, 'title' | 'slug' | 'excerpt' | 'content'> &
  Partial<Pick<Article, 'contentFormat' | 'coverImage' | 'coverAlt' | 'metaTitle' | 'metaDescription'>>;

export interface ChecklistOptions {
  // Measured in the editor from the loaded image; unknown on the server, so W-4 is editor only.
  coverWidth?: number | null;
  // renderArticle() warnings, added on the server so a case the image regex misses still blocks.
  renderWarnings?: RenderWarning[];
  // The stored document ID of an existing article, which may predate the slug rule (F-000).
  legacySlugOk?: boolean;
}

const item = (id: string, label: string, ok: boolean, detail?: string): ChecklistItem =>
  detail && !ok ? { id, label, ok, detail } : { id, label, ok };

const listNames = (names: string[]) => (names.length > 3 ? `${names.slice(0, 3).join(', ')}, dan ${names.length - 3} lainnya` : names.join(', '));

export function runChecklist(article: ChecklistInput, opts: ChecklistOptions = {}): ChecklistResult {
  const markdown = formatOf(article) === 'markdown';
  const title = (article.title || '').trim();
  const slug = (article.slug || '').trim();
  const content = article.content || '';
  const blocking: ChecklistItem[] = [];

  blocking.push(item('C-1', 'Judul terisi (maksimal 150 karakter)', title.length > 0 && title.length <= 150));
  const slugOk = slug.length > 0 && !RESERVED_ARTICLE_SLUGS.includes(slug) && (opts.legacySlugOk || SLUG_PATTERN.test(slug));
  blocking.push(item('C-2', 'URL (slug) valid', slugOk, 'Hanya huruf kecil, angka, dan tanda hubung; "baru" tidak boleh.'));
  blocking.push(item('C-3', 'Ringkasan (excerpt) terisi', Boolean((article.excerpt || '').trim())));

  if (markdown) {
    const unrenderable = (opts.renderWarnings || []).some(w => w.kind === 'render-error');
    // The editor has no renderer, so it cannot see render-error; the server adds it at publish (design.md).
    blocking.push(item('C-4', 'Isi artikel terisi', Boolean(content.trim()) && !unrenderable,
      unrenderable ? 'Isi tidak bisa diproses: daftar atau kutipan bersarang terlalu dalam. Rapikan strukturnya.' : undefined));
    const coverOk = isAllowedImageUrl(article.coverImage) && Boolean((article.coverAlt || '').trim());
    blocking.push(item('C-5', 'Gambar sampul diunggah dan punya teks alt', coverOk));

    const images = extractBodyImages(content);
    const warnings = opts.renderWarnings || [];
    const noAlt = images.filter(i => !i.alt).map(i => `gambar ${i.index + 1}`);
    const foreign = images.filter(i => i.kind === 'foreign').map(i => `gambar ${i.index + 1}`);
    const rendererImageIssues = warnings.filter(w => w.kind === 'image-host' || w.kind === 'inline-image').length;
    const c6Problems = [
      noAlt.length ? `tanpa alt: ${listNames(noAlt)}` : '',
      foreign.length ? `bukan dari Cloudinary INZTA: ${listNames(foreign)}` : '',
      rendererImageIssues && !foreign.length ? `${rendererImageIssues} gambar tidak bisa ditampilkan (di luar host atau menempel di teks)` : '',
    ].filter(Boolean);
    blocking.push(item('C-6', 'Setiap gambar punya alt dan diunggah lewat panel', c6Problems.length === 0, c6Problems.join('; ')));

    const placeholders = images.filter(i => i.kind === 'placeholder').map(i => i.fileName);
    const rendererPlaceholders = warnings.filter(w => w.kind === 'placeholder').length;
    blocking.push(
      item(
        'C-7',
        'Tidak ada gambar yang belum diunggah',
        placeholders.length === 0 && rendererPlaceholders === 0,
        placeholders.length ? `Belum diunggah: ${listNames(placeholders)}` : `${rendererPlaceholders} gambar belum diunggah`,
      ),
    );
    blocking.push(item('C-8', 'Tidak ada heading "#" (H1) di isi; judul sudah jadi H1', !hasH1(content)));
  }

  const metaTitle = (article.metaTitle || '').trim();
  const metaDescription = (article.metaDescription || '').trim();
  const warnings: ChecklistItem[] = [
    item('W-1', `Judul SEO maksimal ${META_TITLE_GUIDE} karakter (pedoman)`, metaTitle.length <= META_TITLE_GUIDE, `${metaTitle.length} karakter; Google bisa memotongnya.`),
    item('W-2', `Deskripsi SEO maksimal ${META_DESCRIPTION_GUIDE} karakter (pedoman)`, metaDescription.length <= META_DESCRIPTION_GUIDE, `${metaDescription.length} karakter; Google bisa memotongnya.`),
    item('W-3', 'Deskripsi SEO diisi', metaDescription.length > 0, 'Kosong: ringkasan (excerpt) dipakai sebagai deskripsi.'),
  ];
  if (markdown && typeof opts.coverWidth === 'number') {
    warnings.push(item('W-4', `Gambar sampul minimal ${COVER_MIN_WIDTH} px lebarnya`, opts.coverWidth >= COVER_MIN_WIDTH, `Lebar ${opts.coverWidth} px; pratinjau tautan bisa buram.`));
  }

  return { blocking, warnings };
}

export const failedChecks = (result: ChecklistResult) => result.blocking.filter(c => !c.ok);
export const canPublish = (result: ChecklistResult) => failedChecks(result).length === 0;
