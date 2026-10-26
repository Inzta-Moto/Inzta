import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/auth';
import { revalidateProductPaths } from '@/lib/revalidate';
import {
  normalizeProduct,
  validateSimpleProduct,
  validateVariableProduct,
  buildSimplePayload,
  buildVariablePayload,
} from '../_helpers';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const doc = await getAdminDb().collection('products').doc(params.slug).get();
    if (!doc.exists)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    return NextResponse.json({
      product: normalizeProduct(doc.id, doc.data() as Record<string, any>),
    });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const data = await request.json();

    if (!data.slug || !data.name)
      return NextResponse.json(
        { code: 'MISSING_FIELDS', message: 'Slug dan nama produk wajib diisi' },
        { status: 400 },
      );

    if (!['simple', 'variable'].includes(data.productType))
      return NextResponse.json(
        { code: 'INVALID_PRODUCT_TYPE', message: 'productType harus simple atau variable' },
        { status: 400 },
      );

    const validationError =
      data.productType === 'simple'
        ? validateSimpleProduct(data)
        : validateVariableProduct(data);

    if (validationError)
      return NextResponse.json(validationError, { status: 400 });

    const productRef = getAdminDb().collection('products').doc(params.slug);
    const currentSnap = await productRef.get();
    if (!currentSnap.exists)
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    // ── Validasi variant removal ────────────────────────────────────────────
    // Variant yang pernah muncul di order tidak boleh dihapus permanen
    // karena akan merusak jejak historis order. Admin harus menonaktifkan
    // (isActive=false) sebagai gantinya.
    if (data.productType === 'variable') {
      const currentVariants: any[] = currentSnap.exists
        ? (Array.isArray((currentSnap.data() as any)?.variants) ? (currentSnap.data() as any).variants : [])
        : [];
      const currentIds = new Set(currentVariants.map((v: any) => v.variationId).filter(Boolean));
      const newIds = new Set(
        (Array.isArray(data.variants) ? data.variants : [])
          .map((v: any) => v.variationId)
          .filter(Boolean),
      );
      const removedIds = Array.from(currentIds).filter(id => !newIds.has(id as string));

      if (removedIds.length > 0) {
        const ordersRef = getAdminDb().collection('orders');
        const blocked: string[] = [];
        // Query per removedId: orders dengan items mengandung variationId ini
        // untuk produk ini. Kita batasi agar tidak membaca semua order jika
        // removedIds sedikit.
        for (const vid of removedIds) {
          const q = await ordersRef.where('items', 'array-contains-any', [{ variationId: vid }]).limit(1).get();
          if (!q.empty) blocked.push(vid as string);
        }
        if (blocked.length > 0) {
          return NextResponse.json(
            {
              code: 'VARIANT_HAS_ORDERS',
              message: `${blocked.length} variant tidak dapat dihapus karena pernah muncul di order. Nonaktifkan variant tersebut sebagai gantinya.`,
              blockedVariantIds: blocked,
            },
            { status: 403 },
          );
        }
      }
    }

    // The document ID is the source of truth for the slug; a different body slug would break product links.
    const payload =
      data.productType === 'simple'
        ? buildSimplePayload({ ...data, slug: params.slug })
        : buildVariablePayload({ ...data, slug: params.slug });

    // Full overwrite — bukan merge, supaya field lama dari tipe sebelumnya
    // (contoh: price/stock di variable product) benar-benar terhapus.
    await getAdminDb().collection('products').doc(params.slug).set(payload);
    revalidateProductPaths();

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await getAdminDb().collection('products').doc(params.slug).delete();
    revalidateProductPaths();
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
