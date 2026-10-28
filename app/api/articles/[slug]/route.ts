import { NextResponse } from 'next/server';
import { ARTICLE_NOT_FOUND as NOT_FOUND, ARTICLE_SERVER_FAIL as SERVER_FAIL } from '@/lib/admin-articles';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { parseArticleInput } from '@/lib/article-input';
import { revalidateArticlePaths } from '@/lib/revalidate';
import { formatOf, statusOf, toMillis } from '@/lib/article-format';
import { isStaleWrite, serializeArticle, serverPublishFailures, unchangedSince } from '@/lib/admin-articles';

const STALE_MESSAGE = 'Artikel ini sudah diubah di tempat lain. Muat ulang versi server atau salin isi Anda dulu.';

// A draft is a 404 for anyone but an admin (requirement 2.7).
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const doc = await getAdminDb().collection('articles').doc(params.slug).get();
    if (!doc.exists) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    const data = doc.data() ?? {};
    if (statusOf(data) !== 'published' && !(await requireAdmin()).ok) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }
    return NextResponse.json({ item: serializeArticle(doc.id, data) }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}

// Edits in place. The document ID is the slug, so renaming goes through POST (new slug) + DELETE (old slug).
// Status never changes here; that is the publish route's job.
export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const ref = getAdminDb().collection('articles').doc(params.slug);
    const existing = await ref.get();
    if (!existing.exists) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    const stored = existing.data() ?? {};

    const body = await request.json().catch(() => null);
    // The editor sends the updatedAt it loaded; anything newer on the server means another save won.
    if (body && typeof body === 'object' && 'baseUpdatedAt' in body) {
      if (toMillis((body as any).baseUpdatedAt) !== toMillis(stored.updatedAt)) {
        return NextResponse.json({ error: STALE_MESSAGE }, { status: 409 });
      }
    }

    // Legacy slugs created before the slug rule can still be edited in place.
    const parsed = parseArticleInput({ ...(body ?? {}), slug: params.slug }, {
      allowLegacySlug: true,
      currentFormat: formatOf(stored),
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Saving a published article changes the live page at once, so it must pass the publish checks.
    const isPublic = statusOf(stored) === 'published';
    if (isPublic) {
      const checks = await serverPublishFailures(parsed.value);
      if (checks.length) {
        return NextResponse.json({ error: 'Artikel yang sudah terbit belum lolos cek sebelum terbit', checks }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const update = { ...parsed.value, createdAt: stored.createdAt ?? now, updatedAt: now };
    // The precondition closes the gap between the baseUpdatedAt check above and this write.
    const precondition = unchangedSince(existing);
    if (precondition) await ref.update(update, precondition);
    else await ref.update(update);
    if (isPublic) revalidateArticlePaths(params.slug);
    return NextResponse.json({ status: 'success', item: serializeArticle(params.slug, { ...stored, ...update }) }, { status: 200 });
  } catch (error: any) {
    if (isStaleWrite(error)) return NextResponse.json({ error: STALE_MESSAGE }, { status: 409 });
    console.error('Update article error:', { slug: params.slug, error });
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await getAdminDb().collection('articles').doc(params.slug).delete();
    revalidateArticlePaths(params.slug);
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Delete article error:', { slug: params.slug, error });
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}
