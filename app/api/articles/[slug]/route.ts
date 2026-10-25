import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { parseArticleInput } from '@/lib/article-input';

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const doc = await getAdminDb().collection('articles').doc(params.slug).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ item: { id: doc.id, ...doc.data() } }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const ref = getAdminDb().collection('articles').doc(params.slug);
    const existing = await ref.get();
    if (!existing.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json().catch(() => null);
    // The document ID is the slug, so PUT edits in place; renaming goes through DELETE + POST.
    const parsed = parseArticleInput({ ...(body ?? {}), slug: params.slug }, { allowLegacySlug: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const now = new Date().toISOString();
    const createdAt = existing.data()?.createdAt ?? now;
    await ref.set({ ...parsed.value, createdAt, updatedAt: now }, { merge: true });
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Update article error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await getAdminDb().collection('articles').doc(params.slug).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Delete article error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
