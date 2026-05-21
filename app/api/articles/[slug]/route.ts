import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

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
  try {
    const data = await request.json();
    await getAdminDb().collection('articles').doc(params.slug).set(data, { merge: true });
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  try {
    await getAdminDb().collection('articles').doc(params.slug).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
