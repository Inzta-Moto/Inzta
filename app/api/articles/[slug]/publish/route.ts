import { NextResponse } from 'next/server';
import { ARTICLE_NOT_FOUND as NOT_FOUND, ARTICLE_SERVER_FAIL as SERVER_FAIL } from '@/lib/admin-articles';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { revalidateArticlePaths } from '@/lib/revalidate';
import { isStaleWrite, serializeArticle, serverPublishFailures, unchangedSince } from '@/lib/admin-articles';

const STALE_MESSAGE = 'Artikel berubah saat diterbitkan. Muat ulang lalu coba lagi.';

// Publish: the checks run on the stored document, not on what the browser shows, and the precondition
// makes sure the version that passed is the version that goes live.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const ref = getAdminDb().collection('articles').doc(params.slug);
    const existing = await ref.get();
    if (!existing.exists) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    const stored = existing.data() ?? {};

    const checks = await serverPublishFailures({
      title: stored.title,
      slug: params.slug,
      excerpt: stored.excerpt,
      content: stored.content,
      contentFormat: stored.contentFormat,
      coverImage: stored.coverImage,
      coverAlt: stored.coverAlt,
      metaTitle: stored.metaTitle,
      metaDescription: stored.metaDescription,
    });
    if (checks.length) return NextResponse.json({ error: 'Belum lolos cek sebelum terbit', checks }, { status: 400 });

    const now = new Date().toISOString();
    // publishedAt is set once: republishing keeps the original date (public date, requirement 5.9).
    const update = { status: 'published' as const, publishedAt: stored.publishedAt ?? now, updatedAt: now };
    const precondition = unchangedSince(existing);
    if (precondition) await ref.update(update, precondition);
    else await ref.update(update);
    revalidateArticlePaths(params.slug);
    return NextResponse.json({ status: 'success', item: serializeArticle(params.slug, { ...stored, ...update }) }, { status: 200 });
  } catch (error: any) {
    if (isStaleWrite(error)) return NextResponse.json({ error: STALE_MESSAGE }, { status: 409 });
    console.error('Publish article error:', { slug: params.slug, error });
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}

// Unpublish: back to draft. publishedAt stays, so the slug stays locked (requirement 6.6).
export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const ref = getAdminDb().collection('articles').doc(params.slug);
    const existing = await ref.get();
    if (!existing.exists) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    const stored = existing.data() ?? {};

    const now = new Date().toISOString();
    // Legacy articles have no publishedAt; recording one keeps their indexed URL locked as well.
    const update = { status: 'draft' as const, publishedAt: stored.publishedAt ?? stored.createdAt ?? now, updatedAt: now };
    await ref.update(update);
    revalidateArticlePaths(params.slug);
    return NextResponse.json({ status: 'success', item: serializeArticle(params.slug, { ...stored, ...update }) }, { status: 200 });
  } catch (error: any) {
    console.error('Unpublish article error:', { slug: params.slug, error });
    return NextResponse.json({ error: SERVER_FAIL }, { status: 500 });
  }
}
