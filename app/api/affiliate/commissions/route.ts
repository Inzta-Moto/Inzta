import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const sessionCookie = cookies().get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // Find the affiliate by uid
    const affSnap = await getAdminDb().collection('affiliates').where('uid', '==', uid).limit(1).get();
    if (affSnap.empty) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }
    const affiliateId = affSnap.docs[0].id;

    // Fetch commissions for this affiliate
    const commSnap = await getAdminDb().collection('commissions').where('affiliateId', '==', affiliateId).get();
    const commissions = commSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

    return NextResponse.json({ commissions }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching affiliate commissions:', error);
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}
