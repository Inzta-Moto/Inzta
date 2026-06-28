import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { generateLabel } from '@/lib/product-utils';
import { randomBytes } from 'crypto';
import type { OrderItem, VariantSnapshot } from '@/types';

function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const buf = randomBytes(6);
  let id = '';
  for (let i = 0; i < buf.length; i++) id += chars[buf[i] % chars.length];
  return `ORD-${id}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, voucherCode, affiliateId, buyerUID } = body;

    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json(
        { code: 'MISSING_ITEMS', message: 'Items tidak boleh kosong' },
        { status: 400 },
      );

    const db = getAdminDb();
    let serverSubtotal = 0;
    const validatedItems: OrderItem[] = [];

    for (const item of items) {
      // Backward compat: support productSlug (baru) dan id (legacy ProductCard)
      const productSlug: string = item.productSlug ?? item.id;
      const variationId: string | null = item.variationId ?? null;
      const quantity: number = item.quantity;

      // Langkah 1 — quantity (Tahap 6 R2)
      if (!Number.isInteger(quantity) || quantity < 1)
        return NextResponse.json(
          { code: 'INVALID_QUANTITY', message: 'Quantity harus bilangan bulat minimal 1' },
          { status: 400 },
        );

      if (!productSlug)
        return NextResponse.json(
          { code: 'MISSING_PRODUCT', message: 'productSlug wajib diisi' },
          { status: 400 },
        );

      // Langkah 2 — product exists
      const productSnap = await db.collection('products').doc(productSlug).get();
      if (!productSnap.exists)
        return NextResponse.json(
          { code: 'PRODUCT_NOT_FOUND', message: `Produk tidak ditemukan` },
          { status: 404 },
        );

      const product = productSnap.data() as Record<string, any>;
      const productType = (product.productType ?? 'simple') as 'simple' | 'variable';

      // Langkah 3 — product.isActive (dipisah dari variant.isActive per Tahap 6 R9)
      if (!product.isActive)
        return NextResponse.json(
          { code: 'PRODUCT_INACTIVE', message: `Produk "${product.name}" sedang tidak aktif` },
          { status: 400 },
        );

      let resolvedPrice: number;
      let resolvedCompareAtPrice: number | null;
      let resolvedImageUrl: string | null;
      let selectedVariantLabel: string | null = null;
      let variantSnapshot: VariantSnapshot | null = null;

      if (productType === 'simple') {
        // Langkah 4a — variationId harus kosong untuk simple product
        if (variationId)
          return NextResponse.json(
            { code: 'INVALID_VARIATION', message: 'Produk simple tidak mendukung variasi' },
            { status: 400 },
          );

        // Langkah 7 — stock check
        if ((product.stock ?? 0) < quantity)
          return NextResponse.json(
            { code: 'INSUFFICIENT_STOCK', message: `Stok produk "${product.name}" tidak mencukupi` },
            { status: 400 },
          );

        resolvedPrice = product.price;
        resolvedCompareAtPrice = product.compareAtPrice ?? product.originalPrice ?? null;
        resolvedImageUrl = product.images?.[0] ?? product.imageUrl ?? null;
      } else {
        // Langkah 4b — variationId wajib untuk variable product
        if (!variationId)
          return NextResponse.json(
            { code: 'VARIATION_REQUIRED', message: `Variasi belum dipilih untuk produk "${product.name}"` },
            { status: 400 },
          );

        // Langkah 5 — cari variant dalam product (scoped — Tahap 6 R3)
        const variants: any[] = Array.isArray(product.variants) ? product.variants : [];
        const variant = variants.find((v: any) => v.variationId === variationId);

        if (!variant)
          return NextResponse.json(
            { code: 'VARIANT_NOT_FOUND', message: 'Variasi tidak ditemukan' },
            { status: 400 },
          );

        // Langkah 6 — variant.isActive (dipisah per Tahap 6 R9)
        if (!variant.isActive)
          return NextResponse.json(
            { code: 'VARIANT_INACTIVE', message: 'Variasi ini sudah tidak tersedia' },
            { status: 400 },
          );

        // Langkah 7 — stock check (soft — authoritative di transaction Tahap 7)
        if ((variant.stock ?? 0) < quantity)
          return NextResponse.json(
            { code: 'INSUFFICIENT_STOCK', message: `Stok variasi tidak mencukupi` },
            { status: 400 },
          );

        resolvedPrice = variant.price;
        resolvedCompareAtPrice = variant.compareAtPrice ?? null;
        resolvedImageUrl = variant.images?.[0] ?? product.images?.[0] ?? product.imageUrl ?? null;
        selectedVariantLabel = generateLabel(variant.attributes);

        // Snapshot: tidak menyimpan images[] (K7), hanya satu imageUrl (Tahap 6 R5)
        variantSnapshot = {
          variationId: variant.variationId,
          sku: variant.sku,
          attributes: variant.attributes,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice ?? null,
          imageUrl: variant.images?.[0] ?? null,
        };
      }

      const subtotal = resolvedPrice * quantity;
      serverSubtotal += subtotal;

      validatedItems.push({
        productId: productSlug,
        productSlug,
        productName: product.name,
        productType,
        variationId: variationId ?? null,
        quantity,
        price: resolvedPrice,
        subtotal,
        imageUrl: resolvedImageUrl,
        selectedVariantLabel,
        variantSnapshot,
      });
    }

    // ── Voucher — logika identik dengan existing ───────────────────────────────
    let serverDiscountAmount = 0;
    let appliedVoucherCode: string | null = null;
    let appliedAffiliateId: string | null = affiliateId || null;

    if (voucherCode) {
      const vCode = (voucherCode as string).toUpperCase();
      const vSnap = await db.collection('vouchers').doc(vCode).get();

      if (vSnap.exists) {
        const vData = vSnap.data() as any;
        const now = Date.now();
        let isValid = true;
        let voucherError = '';

        if (!vData.isActive) { isValid = false; voucherError = 'Voucher tidak aktif'; }

        if (isValid && vData.expiresAt && typeof vData.expiresAt === 'string') {
          if (new Date(vData.expiresAt).getTime() < now) {
            isValid = false; voucherError = 'Voucher kadaluarsa';
          }
        }

        if (isValid && vData.minPurchase && serverSubtotal < vData.minPurchase) {
          isValid = false; voucherError = 'Minimal pembelian tidak terpenuhi';
        }

        if (isValid) {
          if (vData.type === 'percentage') {
            serverDiscountAmount = (serverSubtotal * vData.value) / 100;
            if (vData.maxDiscount && serverDiscountAmount > vData.maxDiscount)
              serverDiscountAmount = vData.maxDiscount;
          } else {
            serverDiscountAmount = vData.value;
          }
          if (serverDiscountAmount > serverSubtotal) serverDiscountAmount = serverSubtotal;
          serverDiscountAmount = Math.round(serverDiscountAmount);
          appliedVoucherCode = vCode;
          if (vData.affiliateId) appliedAffiliateId = vData.affiliateId;
        } else {
          return NextResponse.json(
            { error: `Gagal menggunakan voucher: ${voucherError}` },
            { status: 400 },
          );
        }
      }
    }

    const serverFinalPrice = serverSubtotal - serverDiscountAmount;

    // ── Order ID — identik dengan existing ────────────────────────────────────
    let orderId = generateOrderId();
    let exists = await db.collection('orders').doc(orderId).get();
    let attempts = 0;
    while (exists.exists && attempts < 10) {
      orderId = generateOrderId();
      exists = await db.collection('orders').doc(orderId).get();
      attempts++;
    }
    if (attempts >= 10)
      return NextResponse.json({ error: 'Gagal membuat ID Pesanan unik' }, { status: 500 });

    await db.collection('orders').doc(orderId).set({
      orderId,
      customerName: '',
      address: '',
      items: validatedItems,
      totalPrice: serverSubtotal,
      discountAmount: serverDiscountAmount,
      voucherCode: appliedVoucherCode,
      affiliateId: appliedAffiliateId,
      buyerUID: buyerUID || null,
      finalPrice: serverFinalPrice,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Response diperluas dengan items data untuk WhatsApp message (Tahap 6)
    // calculatedTotals dipertahankan untuk backward compat DetailClient.tsx
    return NextResponse.json(
      {
        orderId,
        status: 'success',
        items: validatedItems.map((i) => ({
          productName: i.productName,
          selectedVariantLabel: i.selectedVariantLabel,
          sku: i.variantSnapshot?.sku ?? null,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal,
        })),
        totalPrice: serverSubtotal,
        discountAmount: serverDiscountAmount,
        voucherCode: appliedVoucherCode,
        finalPrice: serverFinalPrice,
        calculatedTotals: {
          totalPrice: serverSubtotal,
          discountAmount: serverDiscountAmount,
          finalPrice: serverFinalPrice,
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 });
  }
}
