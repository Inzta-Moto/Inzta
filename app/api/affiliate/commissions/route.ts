import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessionCookie = cookies().get('affiliate_session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    const email = decodedClaims.email; // Get email for fallback

    // Find the affiliate by uid
    let affSnap = await getAdminDb().collection('affiliates').where('uid', '==', uid).limit(1).get();
    
    // Fallback: If not found by UID, try finding by email
    if (affSnap.empty && email) {
      affSnap = await getAdminDb().collection('affiliates').where('email', '==', email).limit(1).get();
      
      // Self-healing: if found by email, update the document with the correct UID
      if (!affSnap.empty) {
        const docId = affSnap.docs[0].id;
        await getAdminDb().collection('affiliates').doc(docId).update({ uid: uid });
      }
    }

    if (affSnap.empty) {
      return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });
    }
    
    const affiliateDoc = affSnap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();

    // Fetch commissions for this affiliate
    const commSnap = await getAdminDb().collection('commissions').where('affiliateId', '==', affiliateId).get();
    const commissions = commSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    // Fetch the affiliate's voucher status
    let voucherData = null;
    if (affiliateData.voucherCode) {
      const voucherSnap = await getAdminDb().collection('vouchers').doc(affiliateData.voucherCode).get();
      if (voucherSnap.exists) {
        voucherData = voucherSnap.data();
      }
    }

    return NextResponse.json({ 
      commissions, 
      affiliateName: affiliateData.name || 'Afiliasi',
      voucher: voucherData,
      voucherCode: affiliateData.voucherCode
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching affiliate commissions:', error);
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 });
  }
}
