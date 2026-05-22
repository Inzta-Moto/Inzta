import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

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
  try {
    const db = getAdminDb();
    const products = db.collection('products');

    const [total, active, lowStock] = await Promise.all([
      countQuery(products),
      countQuery(products.where('isActive', '==', true)),
      countQuery(products.where('stock', '<=', 10)),
    ]);

    const lowSnap = await products.where('stock', '<=', 10).orderBy('stock', 'asc').limit(10).get();
    const lowList = lowSnap.docs.map(doc => {
      const data = doc.data() as any;
      return {
        name: data.name || 'Produk',
        slug: data.slug || doc.id,
        stock: typeof data.stock === 'number' ? data.stock : 0,
      };
    });

    return NextResponse.json({ total, active, lowStock, lowList }, { status: 200 });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
