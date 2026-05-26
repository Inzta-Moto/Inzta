import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const affiliateId = searchParams.get('affiliateId');

    if (!affiliateId) {
      return NextResponse.json({ error: 'Missing affiliateId' }, { status: 400 });
    }

    // Search for voucher with matching code (passed as affiliateId from frontend)
    const db = getAdminDb();
    const upperCode = affiliateId.toUpperCase();
    
    const vouchersSnap = await db.collection('vouchers')
      .where('code', '==', upperCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (vouchersSnap.empty) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 });
    }

    const voucherDoc = vouchersSnap.docs[0];
    const voucherData = voucherDoc.data();

    // Perform basic validation before returning
    if (voucherData.maxUsage && voucherData.usageCount >= voucherData.maxUsage) {
      return NextResponse.json({ error: 'Voucher limit reached' }, { status: 400 });
    }

    if (voucherData.expiresAt && voucherData.expiresAt._seconds * 1000 < Date.now()) {
      return NextResponse.json({ error: 'Voucher expired' }, { status: 400 });
    }

    return NextResponse.json({ voucher: { id: voucherDoc.id, ...voucherData } }, { status: 200 });
  } catch (error: any) {
    console.error('Error resolving voucher:', error);
    return NextResponse.json({ error: 'Failed to resolve voucher' }, { status: 500 });
  }
}
