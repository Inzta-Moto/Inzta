import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { verifyAdminSession } from '@/lib/auth';
import { computeTotalStock } from '@/lib/product-utils';
import { revalidateProductPaths } from '@/lib/revalidate';
import type { InventorySnapshotItem } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Backward compat: order lama pakai item.id, baru pakai item.productSlug
function itemSlug(item: any): string {
  return item.productSlug ?? item.id ?? '';
}

// Lookup commission: gunakan commissionId jika ada (order baru),
// fallback ke query (order lama yang belum punya field ini).
async function findCommissionRef(
  db: ReturnType<typeof getAdminDb>,
  orderData: any,
): Promise<{ ref: FirebaseFirestore.DocumentReference | null; isPaid: boolean }> {
  if (orderData.commissionId) {
    const ref = db.collection('commissions').doc(orderData.commissionId);
    const snap = await ref.get();
    return { ref: snap.exists ? ref : null, isPaid: snap.data()?.isPaid ?? false };
  }
  // Fallback untuk order lama (query)
  const snap = await db.collection('commissions').where('orderId', '==', orderData.orderId).get();
  if (snap.empty) return { ref: null, isPaid: false };
  const docs = snap.docs;
  const paid = docs.some((d) => d.data().isPaid);
  return { ref: docs[0].ref, isPaid: paid };
}

// ── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } },
) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { orderId } = params;
    const { status: newStatus } = await request.json();
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    // ── Complete Order ─────────────────────────────────────────────────────────
    if (newStatus === 'completed') {
      await db.runTransaction(async (transaction) => {
        // PHASE 1 — READ
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Pesanan tidak ditemukan');

        const orderData = orderSnap.data() as any;
        if (orderData.status !== 'pending') throw new Error('Hanya pesanan berstatus pending yang dapat diselesaikan');

        const items: any[] = orderData.items ?? [];

        // Read semua product docs
        const productRefs = items.map((item) =>
          db.collection('products').doc(itemSlug(item)),
        );
        const productSnaps = await Promise.all(
          productRefs.map((ref) => transaction.get(ref)),
        );

        // Read voucher & affiliate
        let voucherSnap: any = null;
        let affiliateSnap: any = null;
        let affiliateId: string | null = orderData.affiliateId ?? null;

        if (orderData.voucherCode) {
          const vRef = db.collection('vouchers').doc(orderData.voucherCode);
          voucherSnap = await transaction.get(vRef);
          if (!affiliateId && voucherSnap.exists) {
            affiliateId = voucherSnap.data()?.affiliateId ?? null;
          }
        }
        if (affiliateId) {
          const aRef = db.collection('affiliates').doc(affiliateId);
          affiliateSnap = await transaction.get(aRef);
        }

        // PHASE 2 — VALIDATION (throw = tidak di-retry oleh Firestore)
        type ChangeEntry =
          | { kind: 'simple'; ref: any; qty: number; before: number }
          | { kind: 'variable'; ref: any; variants: any[]; totalStock: number; before: number; variationId: string };

        const changes: ChangeEntry[] = [];
        const snapItems: InventorySnapshotItem[] = [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const pSnap = productSnaps[i];
          if (!pSnap.exists) throw new Error(`Produk tidak ditemukan: ${itemSlug(item)}`);

          const pData = pSnap.data() as any;
          const productType = pData.productType ?? 'simple';

          if (productType === 'simple') {
            const before = pData.stock ?? 0;
            if (before < item.quantity)
              throw new Error(`Stok tidak mencukupi untuk "${pData.name}"`);
            changes.push({ kind: 'simple', ref: productRefs[i], qty: item.quantity, before });
            snapItems.push({
              productSlug: itemSlug(item),
              variationId: null,
              stockBefore: before,
              quantity: item.quantity,
              stockAfter: before - item.quantity,
            });
          } else {
            // Variable product — cari variant by variationId (scoped ke product ini)
            const variationId = item.variationId ?? null;
            if (!variationId)
              throw new Error(`Variasi tidak dispesifikasikan untuk produk "${pData.name}"`);

            const variants: any[] = Array.isArray(pData.variants) ? [...pData.variants] : [];
            const idx = variants.findIndex((v) => v.variationId === variationId);
            if (idx === -1)
              throw new Error(`Variasi tidak ditemukan dalam produk "${pData.name}"`);

            const before = variants[idx].stock ?? 0;
            if (before < item.quantity)
              throw new Error(`Stok variasi tidak mencukupi untuk "${pData.name}"`);

            // Modifikasi copy array (belum ditulis — masih validation phase)
            variants[idx] = { ...variants[idx], stock: before - item.quantity };
            const totalStock = computeTotalStock(variants);

            changes.push({ kind: 'variable', ref: productRefs[i], variants, totalStock, before, variationId });
            snapItems.push({
              productSlug: itemSlug(item),
              variationId,
              stockBefore: before,
              quantity: item.quantity,
              stockAfter: before - item.quantity,
            });
          }
        }

        // PHASE 3 — WRITE
        for (const change of changes) {
          if (change.kind === 'simple') {
            transaction.update(change.ref, {
              stock: admin.firestore.FieldValue.increment(-change.qty),
            });
          } else {
            transaction.update(change.ref, {
              variants: change.variants,
              totalStock: change.totalStock,
            });
          }
        }

        // Commission: ID deterministik = orderId (Tahap 7 R1)
        let commissionId: string | null = null;
        if (affiliateId && affiliateSnap?.exists) {
          const aData = affiliateSnap.data() as any;
          const commissionRate = aData.commissionRate ?? 0;
          const commissionAmount = Math.round((orderData.finalPrice ?? 0) * (commissionRate / 100));

          if (commissionAmount > 0) {
            const commRef = db.collection('commissions').doc(orderId);
            commissionId = orderId;
            transaction.set(commRef, {
              affiliateId,
              affiliateName: aData.name ?? 'Unknown',
              voucherCode: orderData.voucherCode ?? '',
              productName: items.map((i: any) => `${i.productName ?? i.name} (x${i.quantity})`).join(', '),
              productSlug: itemSlug(items[0]) ?? '',
              productPrice: items[0]?.price ?? 0,
              discountAmount: orderData.discountAmount ?? 0,
              finalPrice: orderData.finalPrice ?? 0,
              commissionAmount,
              isPaid: false,
              paidAt: null,
              orderId: orderData.orderId,
              items: orderData.items,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        if (orderData.voucherCode && voucherSnap?.exists) {
          transaction.update(
            db.collection('vouchers').doc(orderData.voucherCode),
            { usageCount: admin.firestore.FieldValue.increment(1) },
          );
        }

        transaction.update(orderRef, {
          status: 'completed',
          affiliateId,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(commissionId ? { commissionId } : {}),
          inventorySnapshot: { items: snapItems },  // Tahap 7 R2
        });
      });

      revalidateProductPaths(); // stock changed; the home page shows "Sisa N unit"
      return NextResponse.json({ status: 'success' });
    }

    // ── Revert (completed → pending atau completed → cancelled) ────────────────
    if (newStatus === 'pending' || newStatus === 'cancelled') {
      await db.runTransaction(async (transaction) => {
        // PHASE 1 — READ
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) throw new Error('Pesanan tidak ditemukan');

        const orderData = orderSnap.data() as any;

        // Jika order bukan completed, tidak perlu revert stock/commission
        if (orderData.status !== 'completed') {
          transaction.update(orderRef, { status: newStatus });
          return;
        }

        // Cek paid commission sebelum revert
        const { ref: commRef, isPaid } = await findCommissionRef(db, orderData);
        if (isPaid) throw new Error('Komisi pesanan ini sudah dicairkan. Tidak dapat diubah.');

        const items: any[] = orderData.items ?? [];

        // Read product docs untuk variable products (butuh baca variants[])
        const variableItems = items.filter(
          (item) => (item.productType ?? 'simple') === 'variable' && (item.variationId ?? item.variantSnapshot?.variationId),
        );
        const variableProductSnaps = new Map<string, any>();
        for (const item of variableItems) {
          const slug = itemSlug(item);
          if (!variableProductSnaps.has(slug)) {
            const snap = await transaction.get(db.collection('products').doc(slug));
            variableProductSnaps.set(slug, snap);
          }
        }

        // PHASE 2 — VALIDATION (tentukan perubahan, tandai recovery gagal jika variant hilang)
        let inventoryRecoveryFailed = false;
        let inventoryRecoveryDetails: any = null;

        type RevertEntry =
          | { kind: 'simple'; ref: any; qty: number }
          | { kind: 'variable'; ref: any; variants: any[]; totalStock: number }
          | { kind: 'skip' };

        const reverts: RevertEntry[] = [];

        for (const item of items) {
          const productType = item.productType ?? 'simple';
          const qty = item.quantity;

          if (productType === 'simple') {
            reverts.push({
              kind: 'simple',
              ref: db.collection('products').doc(itemSlug(item)),
              qty,
            });
          } else {
            const variationId = item.variationId ?? item.variantSnapshot?.variationId ?? null;
            const pSnap = variableProductSnaps.get(itemSlug(item));

            if (!pSnap?.exists || !variationId) {
              // Tahap 7 R3 — jangan diam-diam skip, tandai dan lanjut
              inventoryRecoveryFailed = true;
              inventoryRecoveryDetails = {
                variationId: variationId ?? 'unknown',
                productSlug: itemSlug(item),
                reason: !pSnap?.exists ? 'PRODUCT_NOT_FOUND' : 'VARIATION_ID_MISSING',
              };
              reverts.push({ kind: 'skip' });
              continue;
            }

            const pData = pSnap.data() as any;
            const variants: any[] = Array.isArray(pData.variants) ? [...pData.variants] : [];
            const idx = variants.findIndex((v) => v.variationId === variationId);

            if (idx === -1) {
              // Data corruption (harusnya tidak terjadi dengan K6 soft delete)
              inventoryRecoveryFailed = true;
              inventoryRecoveryDetails = {
                variationId,
                productSlug: itemSlug(item),
                reason: 'VARIANT_NOT_IN_PRODUCT',
              };
              reverts.push({ kind: 'skip' });
              continue;
            }

            variants[idx] = { ...variants[idx], stock: (variants[idx].stock ?? 0) + qty };
            reverts.push({
              kind: 'variable',
              ref: db.collection('products').doc(itemSlug(item)),
              variants,
              totalStock: computeTotalStock(variants),
            });
          }
        }

        // PHASE 3 — WRITE
        for (const revert of reverts) {
          if (revert.kind === 'simple') {
            transaction.update(revert.ref, {
              stock: admin.firestore.FieldValue.increment(revert.qty),
            });
          } else if (revert.kind === 'variable') {
            transaction.update(revert.ref, {
              variants: revert.variants,
              totalStock: revert.totalStock,
            });
          }
          // skip: tidak ada write untuk item ini
        }

        if (orderData.voucherCode) {
          transaction.update(
            db.collection('vouchers').doc(orderData.voucherCode),
            { usageCount: admin.firestore.FieldValue.increment(-1) },
          );
        }

        if (commRef) transaction.delete(commRef);

        transaction.update(orderRef, {
          status: newStatus,
          completedAt: null,
          ...(inventoryRecoveryFailed
            ? { inventoryRecoveryFailed: true, inventoryRecoveryDetails }
            : {}),
        });
      });

      revalidateProductPaths(); // stock changed; the home page shows "Sisa N unit"
      return NextResponse.json({ status: 'success' });
    }

    // ── Simple status update (fallback) ────────────────────────────────────────
    await orderRef.update({ status: newStatus });
    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { orderId: string } },
) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const { orderId } = params;
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const orderData = orderSnap.data() as any;

    if (orderData.status === 'completed') {
      // Completed order: gunakan transaction (perlu baca variants[] untuk variable products)
      const { ref: commRef, isPaid } = await findCommissionRef(db, orderData);
      if (isPaid) {
        return NextResponse.json(
          { error: 'Komisi pesanan ini sudah dicairkan. Tidak dapat dihapus.' },
          { status: 400 },
        );
      }

      await db.runTransaction(async (transaction) => {
        const items: any[] = orderData.items ?? [];

        // Read variable product docs
        const variableProductSnaps = new Map<string, any>();
        for (const item of items) {
          if ((item.productType ?? 'simple') === 'variable') {
            const slug = itemSlug(item);
            if (!variableProductSnaps.has(slug)) {
              const snap = await transaction.get(db.collection('products').doc(slug));
              variableProductSnaps.set(slug, snap);
            }
          }
        }

        // Restore stock
        for (const item of items) {
          const productType = item.productType ?? 'simple';
          const slug = itemSlug(item);

          if (productType === 'simple') {
            transaction.update(db.collection('products').doc(slug), {
              stock: admin.firestore.FieldValue.increment(item.quantity),
            });
          } else {
            const variationId = item.variationId ?? item.variantSnapshot?.variationId ?? null;
            const pSnap = variableProductSnaps.get(slug);
            if (!pSnap?.exists || !variationId) continue; // skip — data corruption
            const pData = pSnap.data() as any;
            const variants: any[] = Array.isArray(pData.variants) ? [...pData.variants] : [];
            const idx = variants.findIndex((v) => v.variationId === variationId);
            if (idx === -1) continue; // skip — variant hilang
            variants[idx] = { ...variants[idx], stock: (variants[idx].stock ?? 0) + item.quantity };
            transaction.update(db.collection('products').doc(slug), {
              variants,
              totalStock: computeTotalStock(variants),
            });
          }
        }

        if (orderData.voucherCode) {
          transaction.update(
            db.collection('vouchers').doc(orderData.voucherCode),
            { usageCount: admin.firestore.FieldValue.increment(-1) },
          );
        }

        if (commRef) transaction.delete(commRef);
        transaction.delete(orderRef);
      });
      revalidateProductPaths();
    } else {
      // Non-completed order: batch sederhana (tidak ada stock/commission)
      const batch = db.batch();
      const { ref: commRef } = await findCommissionRef(db, orderData);
      if (commRef) batch.delete(commRef);
      batch.delete(orderRef);
      await batch.commit();
    }

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
