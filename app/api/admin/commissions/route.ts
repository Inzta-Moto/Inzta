import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const snap = await getAdminDb().collection('commissions').orderBy('createdAt', 'desc').get();
    const commissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ commissions }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching commissions:', error);
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}
