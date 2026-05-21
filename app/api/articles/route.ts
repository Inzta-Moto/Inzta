import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('articles').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }
    
    const newItem = {
      ...data,
      createdAt: new Date().toISOString(),
    };

    await getAdminDb().collection('articles').doc(data.slug).set(newItem, { merge: true });
    return NextResponse.json({ status: 'success', item: newItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
