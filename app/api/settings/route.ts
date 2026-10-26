// app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

// Without this the GET is static: the flash sale state is frozen at build time and an admin toggle only
// shows after a redeploy. ISR keeps Firestore reads at most one per minute instead of one per home visit.
export const revalidate = 60;

export async function GET() {
  try {
    const db = getAdminDb();
    const doc = await db.collection('settings').doc('flashSale').get();
    if (!doc.exists) return NextResponse.json({ isActive: false, endsAt: null });
    return NextResponse.json(doc.data());
  } catch (error) {
    return NextResponse.json({ isActive: false, endsAt: null });
  }
}