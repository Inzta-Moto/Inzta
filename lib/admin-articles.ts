import { getAdminDb, hasAdminCredentials } from '@/lib/firebaseAdmin';
import { toMillis, toPublicArticle } from '@/lib/article-format';
import { renderArticle } from '@/lib/markdown';
import { failedChecks, runChecklist, type ChecklistInput } from '@/lib/article-checklist';
import type { ChecklistItem, PublicArticle } from '@/types';

// Server-only helpers for the admin API and the admin preview page. Unlike lib/public-content.ts these
// never filter drafts, so they must only run behind requireAdmin().

// Shown to the admin as is (lib/admin-messages.ts passes server messages through), so each says what to do next.
export const ARTICLE_SERVER_FAIL = 'Server gagal memproses artikel. Coba lagi beberapa menit lagi, dan hubungi Tim Developer bila berulang.';
export const ARTICLE_NOT_FOUND = 'Artikel tidak ditemukan. Mungkin sudah dihapus di tab lain; salin isi Anda dulu, lalu buat artikel baru.';

/** API shape: the stored fields with every date as epoch milliseconds, so the editor can echo
 * updatedAt back as baseUpdatedAt and compare it exactly (legacy Timestamps keep their milliseconds). */
export function serializeArticle(id: string, data: Record<string, any>) {
  return {
    ...data,
    id,
    slug: id,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    publishedAt: toMillis(data.publishedAt),
  };
}

export async function getArticleForAdmin(slug: string): Promise<PublicArticle | null> {
  if (!hasAdminCredentials()) return null;
  const doc = await getAdminDb().collection('articles').doc(slug).get();
  return doc.exists ? toPublicArticle(doc.id, doc.data() ?? {}) : null;
}

/** Blocking checks plus renderer warnings: any image the renderer would drop also blocks publishing. */
export function serverPublishFailures(article: ChecklistInput): ChecklistItem[] {
  const { warnings } = renderArticle(article);
  return failedChecks(runChecklist(article, { renderWarnings: warnings, legacySlugOk: true }));
}

// Firestore precondition codes: the document changed after it was read (FAILED_PRECONDITION).
export function isStaleWrite(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 9 || code === 'failed-precondition' || /FAILED_PRECONDITION/.test(String((error as Error)?.message));
}

/** Precondition that makes an update fail if anyone wrote the document after this read. */
export function unchangedSince(snapshot: { updateTime?: unknown }) {
  return snapshot.updateTime ? { lastUpdateTime: snapshot.updateTime as any } : undefined;
}
