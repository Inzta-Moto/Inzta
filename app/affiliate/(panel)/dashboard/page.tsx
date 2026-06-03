import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AffiliateDashboardClient from './AffiliateDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AffiliateDashboardPage() {
  let commissions: any[] = [];
  let affiliateName = '';
  let voucherData = null;

  try {
    const sessionCookie = cookies().get('affiliate_session')?.value;
    if (!sessionCookie) {
      redirect('/affiliate/login');
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    const email = decodedClaims.email;

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
      redirect('/affiliate/login');
    }
    
    const affiliateDoc = affSnap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();
    affiliateName = affiliateData.name || 'Afiliasi';

    // Fetch commissions for this affiliate
    const commSnap = await getAdminDb().collection('commissions').where('affiliateId', '==', affiliateId).get();
    commissions = commSnap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : null,
        paidAt: data.paidAt ? (data.paidAt.toMillis ? data.paidAt.toMillis() : data.paidAt) : null,
      };
    }).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    // Fetch the affiliate's voucher status
    if (affiliateData.voucherCode) {
      const voucherSnap = await getAdminDb().collection('vouchers').doc(affiliateData.voucherCode).get();
      if (voucherSnap.exists) {
        const vData = voucherSnap.data() as any;
        voucherData = {
          ...vData,
          expiresAt: vData.expiresAt ? (vData.expiresAt.toMillis ? vData.expiresAt.toMillis() : vData.expiresAt) : null,
        };
      }
    }

  } catch (error: any) {
    console.error('Error fetching affiliate commissions:', error);
    redirect('/affiliate/login');
  }

  return (
    <AffiliateDashboardClient 
      initialCommissions={commissions} 
      initialAffiliateName={affiliateName} 
      initialVoucherData={voucherData} 
    />
  );
}
