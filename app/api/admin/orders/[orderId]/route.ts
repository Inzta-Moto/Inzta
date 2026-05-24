import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function PATCH(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    const { status } = await request.json();
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    if (status === 'completed') {
      // Transactional stock update
      await db.runTransaction(async (transaction) => {
        // 1. READ PHASE
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Pesanan tidak ditemukan');
        
        const orderData = orderSnap.data() as any;
        if (orderData.status === 'completed') throw new Error('Pesanan sudah selesai');

        // Read all products first
        const productRefs = orderData.items.map((item: any) => db.collection('products').doc(item.id));
        const productSnaps = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));

        // Read affiliate if exists
        let affiliateSnap = null;
        if (orderData.voucherCode && orderData.affiliateId) {
          const affiliateRef = db.collection('affiliates').doc(orderData.affiliateId);
          affiliateSnap = await transaction.get(affiliateRef);
        }

        // 2. VALIDATION PHASE
        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          const productSnap = productSnaps[i];
          if (!productSnap.exists) throw new Error(`Produk ${item.name} tidak ditemukan`);
          
          const productData = productSnap.data() as any;
          if (productData.stock < item.quantity) throw new Error(`Stok tidak mencukupi untuk ${item.name}`);
        }

        // 3. WRITE PHASE
        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          const productRef = productRefs[i];
          transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
        }
        
        transaction.update(orderRef, { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });

        // Handle Voucher Usage & Commission tracking
        if (orderData.voucherCode) {
          const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
          transaction.update(voucherRef, { usageCount: admin.firestore.FieldValue.increment(1) });

          if (orderData.affiliateId && affiliateSnap) {
            // Check if this is a personal purchase by the affiliate themselves
            const isPersonalPurchase = affiliateSnap.exists && affiliateSnap.data()?.uid === orderData.buyerUID;

            if (!isPersonalPurchase) {
              const commissionAmount = Math.round(orderData.finalPrice * 0.05);
              const commRef = db.collection('commissions').doc();
              transaction.set(commRef, {
                affiliateId: orderData.affiliateId,
                affiliateName: affiliateSnap.exists ? affiliateSnap.data()?.name : 'Unknown',
                voucherCode: orderData.voucherCode,
                productName: orderData.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', '),
                productSlug: orderData.items[0]?.id || '',
                productPrice: orderData.items[0]?.price || 0,
                discountAmount: orderData.discountAmount,
                finalPrice: orderData.finalPrice,
                commissionAmount,
                isPaid: false,
                paidAt: null,
                orderId: orderData.orderId,
                items: orderData.items, // Simpan array items lengkap
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }
        }
      });
    } else if (status === 'pending') {
      // Logic for reverting from completed to pending
      await db.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Order not found');
        
        const orderData = orderSnap.data() as any;
        const oldStatus = orderData.status;

        // If it was completed, we need to revert side effects
        if (oldStatus === 'completed') {
          // 1. Check if commission exists and is already paid
          const commsQuery = db.collection('commissions').where('orderId', '==', orderData.orderId);
          const commsSnap = await transaction.get(commsQuery);
          
          let canRevert = true;
          commsSnap.forEach(doc => {
            if (doc.data().isPaid) canRevert = false;
          });

          if (!canRevert) {
            throw new Error('Komisi pesanan ini sudah dicairkan. Tidak dapat dikembalikan ke pending.');
          }

          // 2. Revert Stock
          for (const item of orderData.items) {
            const productRef = db.collection('products').doc(item.id);
            transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(item.quantity) });
          }

          // 3. Revert Voucher usage
          if (orderData.voucherCode) {
            const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
            transaction.update(voucherRef, { usageCount: admin.firestore.FieldValue.increment(-1) });
          }

          // 4. Delete Commissions
          commsSnap.forEach(doc => {
            transaction.delete(doc.ref);
          });
        }

        // 5. Update Order status
        transaction.update(orderRef, { status: 'pending', completedAt: null });
      });
    } else {
      await orderRef.update({ status });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderData = orderSnap.data() as any;
    
    // Safety check: Don't delete completed orders directly if they have commissions? 
    // Or just delete everything. Usually delete is for failed/junk.
    
    const batch = db.batch();
    
    // Delete associated commissions
    const commsSnap = await db.collection('commissions').where('orderId', '==', orderData.orderId).get();
    commsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete order
    batch.delete(orderRef);
    
    await batch.commit();

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
