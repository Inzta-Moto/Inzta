import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

function generateOrderId(): string {
  const num = Math.floor(10000 + Math.random() * 90000); // 5-digit random
  return `ORD-${num}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, totalPrice, discountAmount, voucherCode, affiliateId, finalPrice, buyerUID } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }

    if (typeof finalPrice !== 'number' || finalPrice < 0) {
      return NextResponse.json({ error: 'Invalid finalPrice' }, { status: 400 });
    }

    const db = getAdminDb();
    let orderId = generateOrderId();

    // Ensure unique orderId
    let exists = await db.collection('orders').doc(orderId).get();
    let attempts = 0;
    while (exists.exists && attempts < 10) {
      orderId = generateOrderId();
      exists = await db.collection('orders').doc(orderId).get();
      attempts++;
    }

    const orderData = {
      orderId,
      customerName: '',
      address: '',
      items,
      totalPrice: totalPrice || 0,
      discountAmount: discountAmount || 0,
      voucherCode: voucherCode || null,
      affiliateId: affiliateId || null,
      buyerUID: buyerUID || null,
      finalPrice,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await db.collection('orders').doc(orderId).set(orderData);

    return NextResponse.json({ orderId, status: 'success' }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
