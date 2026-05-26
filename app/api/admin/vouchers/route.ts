import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const snap = await getAdminDb().collection('vouchers').orderBy('createdAt', 'desc').get();
    const vouchers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ vouchers }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching vouchers:', error);
    return NextResponse.json({ error: 'Failed to fetch vouchers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const data = await request.json();
    if (!data.code) {
      return NextResponse.json({ error: 'Missing voucher code' }, { status: 400 });
    }
    const payload = {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
    };
    await getAdminDb().collection('vouchers').doc(data.code).set(payload, { merge: true });
    return NextResponse.json({ status: 'success' }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving voucher:', error);
    return NextResponse.json({ error: 'Failed to save voucher' }, { status: 500 });
  }
}
