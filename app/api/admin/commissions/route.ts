import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const snap = await getAdminDb().collection('commissions').orderBy('createdAt', 'desc').get();
    const commissions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ commissions }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching commissions:', error);
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}
