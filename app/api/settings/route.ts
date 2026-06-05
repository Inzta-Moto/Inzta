// app/api/settings/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

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