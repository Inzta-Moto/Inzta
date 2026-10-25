import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { parseArticleInput } from '@/lib/article-input';
import { isAlreadyExists } from '@/lib/firestore-errors';

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('articles').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// Create only. Editing an existing article goes through PUT /api/articles/[slug], so a new or
// renamed article can never silently overwrite another one that already uses the slug.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseArticleInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const now = new Date().toISOString();
    const item = { ...parsed.value, createdAt: now, updatedAt: now };
    // create() fails atomically when the document exists, unlike a get() followed by set().
    await getAdminDb().collection('articles').doc(parsed.value.slug).create(item);
    return NextResponse.json({ status: 'success', item }, { status: 201 });
  } catch (error: any) {
    if (isAlreadyExists(error)) {
      return NextResponse.json({ error: 'slug: sudah dipakai artikel lain' }, { status: 409 });
    }
    console.error('Create article error:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
