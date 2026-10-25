import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { parseArticleInput } from '@/lib/article-input';

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('articles').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

// The admin panel uses POST for both create and edit, so an existing document keeps its createdAt.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => null);
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
    if (!slug) {
      return NextResponse.json({ error: 'slug: required' }, { status: 400 });
    }

    const ref = getAdminDb().collection('articles').doc(slug);
    const existing = await ref.get();

    const parsed = parseArticleInput(body, { allowLegacySlug: existing.exists });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const now = new Date().toISOString();
    const createdAt = existing.exists ? existing.data()?.createdAt ?? now : now;
    const item = { ...parsed.value, createdAt, updatedAt: now };

    await ref.set(item, { merge: true });
    return NextResponse.json({ status: 'success', item }, { status: existing.exists ? 200 : 201 });
  } catch (error: any) {
    console.error('Create article error:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
