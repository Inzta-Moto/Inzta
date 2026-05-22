import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const snap = await getAdminDb().collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ orders }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
