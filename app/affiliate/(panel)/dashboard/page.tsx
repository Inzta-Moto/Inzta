import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AffiliateDashboardClient from './AffiliateDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AffiliateDashboardPage() {
  let commissions: any[] = [];
  let affiliateName = '';
  let voucherData = null;
  let ownVoucherCode = '';

  try {
    const sessionCookie = cookies().get('affiliate_session')?.value;
    if (!sessionCookie) {
      redirect('/affiliate/login');
    }

    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // RUL-02 / FB-01: match by uid only. The old email fallback trusted unverified emails and rewrote
    // the document's uid, so any account with that email could take over the dashboard.
    const affSnap = await getAdminDb().collection('affiliates').where('uid', '==', uid).limit(1).get();

    if (affSnap.empty) {
      redirect('/affiliate/login');
    }
    
    const affiliateDoc = affSnap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();
    affiliateName = affiliateData.name || 'Afiliasi';
    ownVoucherCode = typeof affiliateData.voucherCode === 'string' ? affiliateData.voucherCode : '';

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
          // Some vouchers store createdAt as a Timestamp; a class instance cannot cross into the client component.
          createdAt: vData.createdAt?.toMillis ? vData.createdAt.toMillis() : vData.createdAt ?? null,
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
      ownVoucherCode={ownVoucherCode}
    />
  );
}
