import type { ArticleCardV2, ArticleTopic, MotorCategory, PublicArticle } from '@/types';
import { DEFAULT_AUTHOR } from '@/lib/constants';
import { countWords, publicDate, readingMinutes, statusOf } from '@/lib/article-format';
import { normalizeKategoriMotor } from '@/lib/v2/motor-category';

// Pure article helpers for v2 pages (F-016 D3, S6, S7). No Firebase or React imports.

export type { ArticleCardV2 };

// F-016 D3: allowed values in tab order (S6.2). lib/article-input.ts validates against this list.
// Adventure and Motocamp follow inzta-hq ADR-0017 (new articles use adventure, touring, or motocamp); the older
// topics stay so published articles keep their tab and chip.
export const ARTICLE_TOPICS: readonly ArticleTopic[] = ['memilih-tas', 'per-motor', 'touring', 'adventure', 'motocamp', 'komunitas'];

const TOPIC_LABEL: Record<ArticleTopic, string> = {
  'memilih-tas': 'Memilih tas',
  'per-motor': 'Per motor',
  touring: 'Touring',
  adventure: 'Adventure',
  motocamp: 'Motocamp',
  komunitas: 'Komunitas',
};

export function isArticleTopic(v: unknown): v is ArticleTopic {
  return typeof v === 'string' && (ARTICLE_TOPICS as readonly string[]).includes(v);
}

// F-016 S6.8.4: missing, empty, or unknown stored values read as "no topic".
export function normalizeTopik(v: unknown): ArticleTopic | null {
  return isArticleTopic(v) ? v : null;
}

// F-016 S6.2: one label map shared by S1.8, S5, S6, and S7; null means no chip.
export function topicLabel(v: unknown): string | null {
  const t = normalizeTopik(v);
  return t ? TOPIC_LABEL[t] : null;
}

// F-016 S6.8.3/S6.8.4: categories count only for 'per-motor' articles.
export function articleCategories(a: Pick<PublicArticle, 'topik' | 'kategoriMotor'>): MotorCategory[] {
  return normalizeTopik(a.topik) === 'per-motor' ? normalizeKategoriMotor(a.kategoriMotor) : [];
}

// F-017: the motor categories an article is tagged with, for any topic (the "Untuk motor Anda" box and the editor).
// The category pages keep articleCategories(), which lists "Per motor" articles only.
export function articleMotorTags(a: Pick<PublicArticle, 'topik' | 'kategoriMotor'>): MotorCategory[] {
  return normalizeTopik(a.topik) ? normalizeKategoriMotor(a.kategoriMotor) : [];
}

// F-016 S7.2: the F-012 helpers, so the page and the editor footer ("±n menit baca") agree.
export function articleReadingMinutes(content: string | undefined): number {
  return readingMinutes(countWords(content ?? ''));
}

/**
 * F-016 S6.7.2: the only article data sent to v2 list islands; never `content`. Photo = cover, else the legacy
 * gallery, whatever `showCover` is (S6.3); author trimmed or "Tim INZTA"; date = publicDate().
 */
export function articleCardV2(a: PublicArticle): ArticleCardV2 {
  return {
    slug: a.slug,
    title: a.title,
    excerpt: (a.excerpt ?? '').trim(),
    photo: a.coverImage || a.images?.[0] || a.imageUrl || null,
    coverCaption: a.coverCaption?.trim() || null,
    author: a.author?.trim() || DEFAULT_AUTHOR,
    date: publicDate(a),
    topik: normalizeTopik(a.topik),
  };
}

// Newest first by publicDate(); undated articles last; ties keep the input order.
function newestFirst(list: PublicArticle[]): PublicArticle[] {
  return list
    .map((a, i) => ({ a, i, d: publicDate(a) }))
    .sort((x, y) => (y.d ?? -Infinity) - (x.d ?? -Infinity) || x.i - y.i)
    .map(x => x.a);
}

export const OTHER_ARTICLES_MAX = 2;

/**
 * F-016 S7.6.1: published articles except the current one; same topic first (newest first), then the newest
 * others; at most two. An article without a topic gets only "newest others". Works for a draft preview too.
 */
export function otherArticles(
  current: Pick<PublicArticle, 'slug' | 'topik'>,
  all: PublicArticle[],
  max = OTHER_ARTICLES_MAX,
): ArticleCardV2[] {
  const pool = newestFirst(all.filter(a => a.slug !== current.slug && statusOf(a) === 'published'));
  const topic = normalizeTopik(current.topik);
  const same = topic ? pool.filter(a => normalizeTopik(a.topik) === topic) : [];
  const rest = pool.filter(a => !same.includes(a));
  return [...same, ...rest].slice(0, max).map(articleCardV2);
}

// F-017: candidates for the "Untuk motor Anda" box. The visitor's motor is only known in the browser, so the server
// sends published articles (not this one) that are tagged with a motor category, newest first; the island picks.
export const MOTOR_ARTICLES_MAX = 12;
export interface MotorArticleV2 {
  card: ArticleCardV2;
  tags: MotorCategory[];
}

export function motorArticles(
  current: Pick<PublicArticle, 'slug'>,
  all: PublicArticle[],
  max = MOTOR_ARTICLES_MAX,
): MotorArticleV2[] {
  return newestFirst(all.filter(a => a.slug !== current.slug && statusOf(a) === 'published'))
    .map(a => ({ card: articleCardV2(a), tags: articleMotorTags(a) }))
    .filter(x => x.tags.length > 0)
    .slice(0, max);
}
