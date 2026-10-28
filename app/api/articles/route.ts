import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { parseArticleInput } from '@/lib/article-input';
import { isAlreadyExists } from '@/lib/firestore-errors';
import { ARTICLE_SERVER_FAIL, serializeArticle } from '@/lib/admin-articles';
import { statusOf } from '@/lib/article-format';

// Admins get drafts too; anyone else gets published articles only. A failed admin check is not an
// error here, it just means the filtered list.
export async function GET() {
  try {
    const isAdmin = (await requireAdmin()).ok;
    const snapshot = await getAdminDb().collection('articles').get();
    const items = snapshot.docs
      .filter(doc => isAdmin || statusOf(doc.data()) === 'published')
      .map(doc => serializeArticle(doc.id, doc.data()));
    // viewer tells the admin list that a rejected session is why drafts are missing; it says nothing about anyone else.
    return NextResponse.json({ items, viewer: isAdmin ? 'admin' : 'public' }, { status: 200 });
  } catch (error: any) {
    console.error('List articles error:', error);
    return NextResponse.json({ error: 'Gagal memuat artikel. Muat ulang halaman beberapa saat lagi.' }, { status: 500 });
  }
}

// Create only, always as a Markdown draft (F-012 requirement 1.3). Editing goes through
// PUT /api/articles/[slug], so a new or renamed article can never silently overwrite another one.
// A draft is not public, so nothing is revalidated until it is published.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseArticleInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const now = new Date().toISOString();
    const item = {
      ...parsed.value,
      contentFormat: 'markdown' as const,
      images: [],
      status: 'draft' as const,
      source: 'admin' as const,
      createdAt: now,
      updatedAt: now,
    };
    // create() fails atomically when the document exists, unlike a get() followed by set().
    await getAdminDb().collection('articles').doc(parsed.value.slug).create(item);
    return NextResponse.json({ status: 'success', item: serializeArticle(parsed.value.slug, item) }, { status: 201 });
  } catch (error: any) {
    if (isAlreadyExists(error)) {
      return NextResponse.json({ error: 'slug: sudah dipakai artikel lain' }, { status: 409 });
    }
    console.error('Create article error:', error);
    return NextResponse.json({ error: ARTICLE_SERVER_FAIL }, { status: 500 });
  }
}
