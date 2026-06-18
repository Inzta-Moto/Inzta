// app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    const doc = await db.collection('settings').doc('flashSale').get();
    if (!doc.exists) return NextResponse.json({ isActive: false, endsAt: null });
    return NextResponse.json(doc.data());
  } catch (error) {
    console.error('[api/settings] Firestore error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}