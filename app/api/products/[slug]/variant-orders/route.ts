import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/products/[slug]/variant-orders
 *
 * Mengembalikan daftar variationId yang pernah muncul di order manapun
 * untuk produk dengan slug tertentu. Dipakai oleh admin form untuk
 * menentukan variant mana yang boleh dihapus permanen (yang TIDAK ada
 * di daftar ini) dan mana yang hanya boleh di-nonaktifkan.
 *
 * Response:
 *   { variantsWithOrders: string[] }
 */
export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const db = getAdminDb();
    const withOrders = new Set<string>();

    // Scan semua orders. Items tersimpan sebagai array di field 'items',
    // sehingga kita perlu membaca dokumen dan memfilter di Node.
    // Untuk volume order yang besar, idealnya ada field top-level
    // productSlugs/variationIds di orders. Untuk sekarang, batch-scan
    // sudah cukup karena orders biasanya < beberapa ribu baris.
    const PAGE = 200;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (true) {
      let q = db
        .collection('orders')
        .orderBy('__name__')
        .limit(PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, any>;
        const items: any[] = Array.isArray(data.items) ? data.items : [];
        for (const it of items) {
          if (!it) continue;
          if (it.productSlug === params.slug || it.id === params.slug) {
            if (it.variationId) withOrders.add(String(it.variationId));
          }
        }
      }

      if (snap.size < PAGE) break;
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    return NextResponse.json({ variantsWithOrders: Array.from(withOrders) });
  } catch (error: any) {
    console.error('Error checking variant orders:', error);
    return NextResponse.json(
      { code: 'VARIANT_ORDERS_CHECK_FAILED', message: 'Gagal memeriksa pesanan variant' },
      { status: 500 },
    );
  }
}
