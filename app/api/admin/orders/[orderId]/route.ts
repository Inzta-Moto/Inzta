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
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Order not found');
        
        const orderData = orderSnap.data() as any;
        if (orderData.status === 'completed') throw new Error('Order already completed');

        for (const item of orderData.items) {
          const productRef = db.collection('products').doc(item.id);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists) throw new Error(`Product ${item.name} not found`);
          
          const productData = productSnap.data() as any;
          if (productData.stock < item.quantity) throw new Error(`Insufficient stock for ${item.name}`);
          
          transaction.update(productRef, { stock: admin.firestore.FieldValue.increment(-item.quantity) });
        }
        
        transaction.update(orderRef, { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
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
