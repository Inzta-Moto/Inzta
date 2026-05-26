import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Missing voucher code' }, { status: 400 });
    }

    const db = getAdminDb();
    const vSnap = await db.collection('vouchers').doc(code.toUpperCase()).get();

    if (!vSnap.exists) {
      return NextResponse.json({ error: 'Voucher tidak ditemukan' }, { status: 404 });
    }

    const voucher = vSnap.data() as any;
    const now = Date.now();

    // Validasi Dasar
    if (!voucher.isActive) return NextResponse.json({ error: 'Voucher tidak aktif' }, { status: 400 });
    
    if (voucher.maxUsage) {
      // Menghitung jumlah pesanan pending yang menggunakan voucher ini
      const pendingOrdersSnap = await db.collection('orders')
        .where('voucherCode', '==', code.toUpperCase())
        .where('status', '==', 'pending')
        .get();
        
      const pendingCount = pendingOrdersSnap.size;
      const totalUsage = (voucher.usageCount || 0) + pendingCount;
      
      if (totalUsage >= voucher.maxUsage) {
        return NextResponse.json({ error: 'Batas penggunaan voucher tercapai (termasuk antrean)' }, { status: 400 });
      }
    }
    
    // Validasi kadaluarsa
    if (voucher.expiresAt && typeof voucher.expiresAt === 'string') {
        if (new Date(voucher.expiresAt).getTime() < now) return NextResponse.json({ error: 'Voucher kadaluarsa' }, { status: 400 });
    }

    return NextResponse.json({ voucher: { code: vSnap.id, ...voucher } }, { status: 200 });
  } catch (error: any) {
    console.error('Error validating voucher:', error);
    return NextResponse.json({ error: 'Gagal memvalidasi voucher' }, { status: 500 });
  }
}
