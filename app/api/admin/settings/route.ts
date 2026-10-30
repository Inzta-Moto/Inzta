import { NextResponse } from 'next/server';
import { revalidateV2Paths } from '@/lib/revalidate';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const db = getAdminDb();
    const doc = await db.collection('settings').doc('flashSale').get();
    if (!doc.exists) return NextResponse.json({ isActive: false, endsAt: null });
    return NextResponse.json(doc.data());
  } catch (error) {
    return NextResponse.json({ isActive: false, endsAt: null });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const db = getAdminDb();
    const { durationDays } = await request.json(); // Terima angka hari (1, 3, 7, dll)

    if (durationDays > 0) {
      // Hitung tanggal berakhir (sekarang + X hari)
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + durationDays);
      
      await db.collection('settings').doc('flashSale').set({
        isActive: true,
        endsAt: endsAt.toISOString(), // Simpan tanggal berakhir
      }, { merge: true });
    } else {
      // Jika 0, matikan flash sale
      await db.collection('settings').doc('flashSale').set({
        isActive: false,
        endsAt: null,
      }, { merge: true });
    }

    // F-016 S0.3.4: every v2 page reads the flash sale in its ISR render, so purge them right after the write.
    revalidateV2Paths('flash');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 });
  }
}