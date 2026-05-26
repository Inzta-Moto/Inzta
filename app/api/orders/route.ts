import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { randomBytes } from 'crypto';

function generateOrderId(): string {
  // Generate a random 8-character string using upper case letters and numbers
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomBuffer = randomBytes(6);
  let randomStr = '';
  for (let i = 0; i < randomBuffer.length; i++) {
    randomStr += chars[randomBuffer[i] % chars.length];
  }
  return `ORD-${randomStr}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // We ignore totalPrice, discountAmount, and finalPrice from the client 
    // to prevent manipulation. We recalculate them securely on the server.
    const { items, voucherCode, affiliateId, buyerUID } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }

    const db = getAdminDb();
    
    // 1. Validasi Produk & Hitung Subtotal di Server
    let serverSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      if (!item.id || !item.quantity || item.quantity <= 0) {
        return NextResponse.json({ error: 'Format item tidak valid' }, { status: 400 });
      }

      const productSnap = await db.collection('products').doc(item.id).get();
      if (!productSnap.exists) {
        return NextResponse.json({ error: `Produk ${item.id} tidak ditemukan` }, { status: 404 });
      }

      const productData = productSnap.data();
      if (!productData?.isActive) {
        return NextResponse.json({ error: `Produk ${item.id} sedang tidak aktif` }, { status: 400 });
      }

      // Pastikan stok mencukupi
      if (productData.stock < item.quantity) {
        return NextResponse.json({ error: `Stok produk ${item.id} tidak mencukupi` }, { status: 400 });
      }

      const price = productData.price || 0;
      serverSubtotal += price * item.quantity;

      validatedItems.push({
        id: item.id,
        name: productData.name,
        price: price,
        quantity: item.quantity
      });
    }

    // 2. Validasi Voucher & Hitung Diskon
    let serverDiscountAmount = 0;
    let appliedVoucherCode = null;
    let appliedAffiliateId = affiliateId || null;

    if (voucherCode) {
      const vCode = voucherCode.toUpperCase();
      const vSnap = await db.collection('vouchers').doc(vCode).get();
      
      if (vSnap.exists) {
        const vData = vSnap.data() as any;
        const now = Date.now();
        
        let isValid = true;
        let voucherError = '';

        if (!vData.isActive) {
          isValid = false;
          voucherError = 'Voucher tidak aktif';
        }

        if (isValid && vData.expiresAt && typeof vData.expiresAt === 'string') {
           if (new Date(vData.expiresAt).getTime() < now) {
             isValid = false;
             voucherError = 'Voucher kadaluarsa';
           }
        }

        if (isValid && vData.minPurchase && serverSubtotal < vData.minPurchase) {
          isValid = false;
          voucherError = `Minimal pembelian tidak terpenuhi untuk voucher ini`;
        }

        // Catatan: Pengecekan maxUsage bisa ditambahkan di sini jika dibutuhkan (mirip route validasi)
        
        if (isValid) {
          // Hitung diskon
          if (vData.type === 'percentage') {
            serverDiscountAmount = (serverSubtotal * vData.value) / 100;
            if (vData.maxDiscount && serverDiscountAmount > vData.maxDiscount) {
              serverDiscountAmount = vData.maxDiscount;
            }
          } else {
            serverDiscountAmount = vData.value;
          }
          
          if (serverDiscountAmount > serverSubtotal) {
            serverDiscountAmount = serverSubtotal;
          }
          
          serverDiscountAmount = Math.round(serverDiscountAmount);
          appliedVoucherCode = vCode;
          if (vData.affiliateId) {
            appliedAffiliateId = vData.affiliateId;
          }
        } else {
          // Jika tidak mau memblokir pesanan ketika voucher gagal (hanya batalkan vouchernya)
          // console.warn(`Voucher ditolak saat checkout: ${voucherError}`);
          // Atau bisa mereturn error jika pengguna sangat bergantung pada harga setelah diskon
          return NextResponse.json({ error: `Gagal menggunakan voucher: ${voucherError}` }, { status: 400 });
        }
      }
    }

    const serverFinalPrice = serverSubtotal - serverDiscountAmount;

    // 3. Buat Order ID Unik
    let orderId = generateOrderId();
    let exists = await db.collection('orders').doc(orderId).get();
    let attempts = 0;
    while (exists.exists && attempts < 10) {
      orderId = generateOrderId();
      exists = await db.collection('orders').doc(orderId).get();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Gagal membuat ID Pesanan unik' }, { status: 500 });
    }

    const orderData = {
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
    };

    await db.collection('orders').doc(orderId).set(orderData);

    return NextResponse.json({ 
      orderId, 
      status: 'success',
      calculatedTotals: {
        totalPrice: serverSubtotal,
        discountAmount: serverDiscountAmount,
        finalPrice: serverFinalPrice
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Gagal membuat pesanan' }, { status: 500 });
  }
}