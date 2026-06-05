import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { verifyAdminSession } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: { orderId: string } }) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { orderId } = params;
    const { status } = await request.json();
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    if (status === 'completed') {
      await db.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Pesanan tidak ditemukan');
        
        const orderData = orderSnap.data() as any;
        if (orderData.status === 'completed') throw new Error('Pesanan sudah selesai');

        const productRefs = orderData.items.map((item: any) => db.collection('products').doc(item.id));
        const productSnaps = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));

        // ✅ BACA VOUCHER & AFFILIATE
        let voucherSnap: any = null;
        let affiliateSnap: any = null;
        let affiliateId = orderData.affiliateId || null;

        if (orderData.voucherCode) {
          const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
          voucherSnap = await transaction.get(voucherRef);
          
          if (!affiliateId && voucherSnap.exists) {
            affiliateId = voucherSnap.data()?.affiliateId || null;
          }

          if (affiliateId) {
            const affiliateRef = db.collection('affiliates').doc(affiliateId);
            affiliateSnap = await transaction.get(affiliateRef);
          }
        }

        // VALIDATION PHASE
        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          const productSnap = productSnaps[i];
          if (!productSnap.exists) throw new Error(`Produk ${item.name} tidak ditemukan`);
          const productData = productSnap.data() as any;
          if (productData.stock < item.quantity) throw new Error(`Stok tidak mencukupi untuk ${item.name}`);
        }

        // WRITE PHASE (Stok & Order)
        for (let i = 0; i < orderData.items.length; i++) {
          const item = orderData.items[i];
          const productRef = productRefs[i];
          transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
        }
        
        transaction.update(orderRef, { 
          status: 'completed', 
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          affiliateId: affiliateId 
        });

        // ✅ HANDLE VOUCHER USAGE & COMMISSION
        if (orderData.voucherCode && voucherSnap && voucherSnap.exists) {
          const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
          transaction.update(voucherRef, { usageCount: admin.firestore.FieldValue.increment(1) });

          // Buat komisi jika ada afiliasi
          if (affiliateId && affiliateSnap && affiliateSnap.exists) {
            const commissionRate = affiliateSnap.data()?.commissionRate ?? 0;
            const commissionAmount = Math.round((orderData.finalPrice || 0) * (commissionRate / 100));
            
            if (commissionAmount > 0) {
              const commRef = db.collection('commissions').doc();
              transaction.set(commRef, {
                affiliateId: affiliateId,
                affiliateName: affiliateSnap.data()?.name || 'Unknown',
                voucherCode: orderData.voucherCode,
                productName: orderData.items.map((i: any) => `${i.name} (x${i.quantity})`).join(', '),
                productSlug: orderData.items[0]?.id || '',
                productPrice: orderData.items[0]?.price || 0,
                discountAmount: orderData.discountAmount || 0,
                finalPrice: orderData.finalPrice || 0,
                commissionAmount,
                isPaid: false,
                paidAt: null,
                orderId: orderData.orderId,
                items: orderData.items,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
          }
        }
      });
    } else if (status === 'pending') {
      await db.runTransaction(async (transaction) => {
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Order not found');
        
        const orderData = orderSnap.data() as any;
        const oldStatus = orderData.status;

        if (oldStatus === 'completed') {
          const commsQuery = db.collection('commissions').where('orderId', '==', orderData.orderId);
          const commsSnap = await transaction.get(commsQuery);
          
          let canRevert = true;
          commsSnap.forEach(doc => {
            if (doc.data().isPaid) canRevert = false;
          });

          if (!canRevert) {
            throw new Error('Komisi pesanan ini sudah dicairkan. Tidak dapat dikembalikan ke pending.');
          }

          for (const item of orderData.items) {
            const productRef = db.collection('products').doc(item.id);
            transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(item.quantity) });
          }

          if (orderData.voucherCode) {
            const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
            transaction.update(voucherRef, { usageCount: admin.firestore.FieldValue.increment(-1) });
          }

          commsSnap.forEach(doc => {
            transaction.delete(doc.ref);
          });
        }

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

// ✅ FUNGSI DELETE YANG HILANG DITAMBAHKAN KEMBALI DI SINI
export async function DELETE(request: Request, { params }: { params: { orderId: string } }) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { orderId } = params;
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderData = orderSnap.data() as any;
    
    // 1. Safety check: Cegah hapus jika komisi sudah dicairkan
    const commsSnap = await db.collection('commissions').where('orderId', '==', orderData.orderId).get();
    let canDelete = true;
    commsSnap.forEach(doc => {
      if (doc.data().isPaid) canDelete = false;
    });

    if (!canDelete) {
      return NextResponse.json({ error: 'Komisi pesanan ini sudah dicairkan. Tidak dapat dihapus.' }, { status: 400 });
    }

    const batch = db.batch();
    
    // 2. Hapus data komisi yang terhubung
    commsSnap.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 3. Jika pesanan sudah "completed", kembalikan stok & kurangi pemakaian voucher
    if (orderData.status === 'completed') {
      
      // Kembalikan stok produk
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          const productRef = db.collection('products').doc(item.id);
          batch.update(productRef, { 
            stock: admin.firestore.FieldValue.increment(item.quantity) 
          });
        }
      }

      // Kurangi usageCount voucher
      if (orderData.voucherCode) {
        const voucherRef = db.collection('vouchers').doc(orderData.voucherCode);
        batch.update(voucherRef, { 
          usageCount: admin.firestore.FieldValue.increment(-1) 
        });
      }
    }

    // 4. Hapus dokumen pesanan
    batch.delete(orderRef);
    
    await batch.commit();

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}