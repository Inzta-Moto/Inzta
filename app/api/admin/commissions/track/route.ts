import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { affiliateId, affiliateName, voucherCode, productName, productSlug, productPrice, discountAmount, finalPrice } = data;

    const commissionAmount = Math.round(finalPrice * 0.05);

    const db = getAdminDb();
    const batch = db.batch();

    // 1. Create commission record
    const commRef = db.collection('commissions').doc();
    batch.set(commRef, {
      affiliateId,
      affiliateName,
      voucherCode,
      productName,
      productSlug,
      productPrice,
      discountAmount,
      finalPrice,
      commissionAmount,
      isPaid: false,
      paidAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Increment voucher usage
    const voucherRef = db.collection('vouchers').doc(voucherCode);
    batch.update(voucherRef, {
      usageCount: admin.firestore.FieldValue.increment(1),
    });

    await batch.commit();

    return NextResponse.json({ status: 'success' }, { status: 201 });
  } catch (error: any) {
    console.error('Error tracking commission:', error);
    return NextResponse.json({ error: 'Failed to track commission' }, { status: 500 });
  }
}
