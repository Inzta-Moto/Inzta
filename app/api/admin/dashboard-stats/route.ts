import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

async function countQuery(query: FirebaseFirestore.Query) {
  try {
    const snap = await query.count().get();
    return snap.data().count || 0;
  } catch {
    const snap = await query.get();
    return snap.size;
  }
}

export async function GET() {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const db = getAdminDb();
    const products = db.collection('products');

    const orders = db.collection('orders');
    const affiliates = db.collection('affiliates');

    const [total, active, lowStock, totalOrders, pendingOrders, totalAffiliates] = await Promise.all([
      countQuery(products),
      countQuery(products.where('isActive', '==', true)),
      countQuery(products.where('stock', '<=', 10)),
      countQuery(orders),
      countQuery(orders.where('status', '==', 'pending')),
      countQuery(affiliates),
    ]);

    // Calculate total revenue
    const completedOrdersSnap = await orders.where('status', '==', 'completed').get();
    const totalRevenue = completedOrdersSnap.docs.reduce((sum, doc) => sum + (doc.data().finalPrice || 0), 0);

    const lowSnap = await products.where('stock', '<=', 10).orderBy('stock', 'asc').limit(10).get();
    const lowList = lowSnap.docs.map(doc => {
      const data = doc.data() as any;
      return {
        name: data.name || 'Produk',
        slug: data.slug || doc.id,
        stock: typeof data.stock === 'number' ? data.stock : 0,
      };
    });

    // Fetch Recent Orders
    const recentOrdersSnap = await orders.orderBy('createdAt', 'desc').limit(5).get();
    const recentOrders = recentOrdersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ 
      total, active, lowStock, lowList, 
      totalOrders, pendingOrders, totalAffiliates, totalRevenue,
      recentOrders
    }, { status: 200 });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
