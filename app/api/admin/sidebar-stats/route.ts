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
    const productsQuery = db.collection('products');
    const articlesQuery = db.collection('articles');
    const vouchersQuery = db.collection('vouchers');
    const affiliatesQuery = db.collection('affiliates');
    const pendingCommissionsQuery = db.collection('commissions').where('isPaid', '==', false);
    const pendingOrdersQuery = db.collection('orders').where('status', '==', 'pending');

    const [products, articles, vouchers, affiliates, pendingCommissions, pendingOrders] = await Promise.all([
      countQuery(productsQuery),
      countQuery(articlesQuery),
      countQuery(vouchersQuery),
      countQuery(affiliatesQuery),
      countQuery(pendingCommissionsQuery),
      countQuery(pendingOrdersQuery),
    ]);

    return NextResponse.json({
      products,
      articles,
      vouchers,
      affiliates,
      pendingCommissions,
      pendingOrders,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Sidebar stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch sidebar stats' }, { status: 500 });
  }
}
