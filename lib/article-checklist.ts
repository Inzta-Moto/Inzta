import type { Article, ChecklistItem, ChecklistResult, RenderWarning } from '@/types';
import { RESERVED_ARTICLE_SLUGS } from '@/lib/constants';
import { SLUG_PATTERN } from '@/lib/slug';
import { MAX_EMBEDS, extractBodyImages, formatOf, hasH1, isAllowedImageUrl, siteLinks } from '@/lib/article-format';

// Pre-publish checks (F-012 requirement 10), pure so the editor, PUT on a published article, and the
// publish route all apply the same rules. Meta lengths follow ADR-0014: a guideline, never a block.
export const META_TITLE_GUIDE = 60;
export const META_DESCRIPTION_GUIDE = 155;
export const COVER_MIN_WIDTH = 1200;

export type ChecklistInput = Pick<Article, 'title' | 'slug' | 'excerpt' | 'content'> &
  Partial<Pick<Article, 'contentFormat' | 'coverImage' | 'coverAlt' | 'showCover' | 'metaTitle' | 'metaDescription'>>;

export interface ChecklistOptions {
  // Measured in the editor from the loaded image; unknown on the server, so W-4 is editor only.
  coverWidth?: number | null;
  // renderArticle() warnings, added on the server so a case the image regex misses still blocks.
  renderWarnings?: RenderWarning[];
  // The stored document ID of an existing article, which may predate the slug rule (F-000).
  legacySlugOk?: boolean;
  // F-013 phase C4: markers whose product or article would not show (missing, inactive, draft, this article),
  // from the server resolver at publish or from the editor's list (C-9, requirement 22.1).
  missingEmbeds?: string[];
  // Slugs of active products and published articles, known in the editor only (W-5, requirement 22.2).
  publicTargets?: { produk: string[]; artikel: string[] };
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
  const images = markdown ? extractBodyImages(content) : [];

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

    // F-013 phase C (K-5): marker problems come from the renderer, so like C-4 they are seen on the server.
    // Listed only when the body has a marker, so articles without cards keep their checklist.
    const embedProblems = warnings.filter((w): w is Extract<RenderWarning, { marker: string }> => 'marker' in w);
    const missing = Array.from(new Set(opts.missingEmbeds || []));
    if (embedProblems.length || missing.length || /\[\[(?:produk|artikel):/i.test(content)) {
      const detail = (kind: string, text: string) => {
        const markers = embedProblems.filter(w => w.kind === kind).map(w => w.marker);
        return markers.length ? `${text}: ${listNames(markers)}` : '';
      };
      const problems = [
        detail('embed-inline', 'harus di baris sendiri, diapit baris kosong'),
        detail('embed-invalid', 'slug hanya huruf kecil, angka, dan tanda hubung'),
        detail('embed-limit', `lebih dari ${MAX_EMBEDS} penanda, tidak ditampilkan`),
        missing.length ? `tidak ada, nonaktif, belum terbit, atau artikel ini sendiri: ${listNames(missing)}` : '',
      ].filter(Boolean);
      blocking.push(item('C-9', 'Penanda produk dan artikel ([[produk:…]], [[artikel:…]]) valid', problems.length === 0, problems.join('; ')));
    }
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
  // F-013 phase A2 (15.4, H-5): "Jadikan juga gambar sampul" copies the URL as is, so equality is enough.
  if (markdown && article.showCover !== false && isAllowedImageUrl(article.coverImage)) {
    const twice = images.some(i => i.url === article.coverImage);
    warnings.push(item('W-6', 'Foto sampul tidak tampil dua kali', !twice, 'Gambar sampul juga ada di isi. Matikan "Tampilkan sampul di halaman artikel" atau hapus gambar itu dari isi.'));
  }
  // F-013 phase C4 (22.2): a link in the text to an INZTA page that is not public would be a 404 or a dead end.
  if (markdown && opts.publicTargets) {
    const targets = opts.publicTargets;
    const links = siteLinks(content);
    const dead = Array.from(new Set(links.filter(l => !targets[l.kind].includes(l.slug)).map(l => l.path)));
    if (links.length) warnings.push(item('W-5', 'Link ke artikel dan produk INZTA menuju halaman yang tayang', dead.length === 0, `Belum tayang atau tidak ada: ${listNames(dead)}`));
  }

  return { blocking, warnings };
}

export const failedChecks = (result: ChecklistResult) => result.blocking.filter(c => !c.ok);
export const canPublish = (result: ChecklistResult) => failedChecks(result).length === 0;
