import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  const authSession = await verifyAdminSession();
  if (authSession.error) return NextResponse.json({ error: authSession.error }, { status: 401 });

  try {
    const snap = await getAdminDb().collection('affiliates').orderBy('createdAt', 'desc').get();
    const affiliates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ affiliates }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching affiliates:', error);
    return NextResponse.json({ error: 'Failed to fetch affiliates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authSession = await verifyAdminSession();
  if (authSession.error) return NextResponse.json({ error: authSession.error }, { status: 401 });

  try {
    const data = await request.json();
    // ✅ Tambahkan commissionRate di sini
    const { id, email, password, name, phone, voucherCode, createdAt, commissionRate } = data;

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing affiliate data' }, { status: 400 });
    }

    const auth = getAdminAuth();
    // RUL-02 / FB-01: the linked account comes from the stored document, never from the request body.
    const existing = await getAdminDb().collection('affiliates').doc(id).get();
    let uid: string = existing.data()?.uid || '';

    try {
      if (uid) {
        // The Auth email always follows the document, so the login email and the affiliate email never drift.
        await auth.updateUser(uid, password ? { email, password } : { email });
      } else if (password) {
        const userRecord = await auth.createUser({ email, password, displayName: name });
        uid = userRecord.uid;
      }
    } catch (authErr: any) {
      console.error('Auth error:', authErr);
      const message = authErr.code === 'auth/email-already-exists'
        ? 'Email ini sudah dipakai akun lain. Pakai email lain.'
        : authErr.code === 'auth/user-not-found'
          ? 'Akun login affiliate ini tidak ditemukan di Firebase Auth. Hubungi Tim Developer.'
          : authErr.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const affiliateData = {
      id,
      name,
      phone,
      email,
      uid,
      voucherCode,
      commissionRate: commissionRate || 0, // ✅ TAMBAHKAN INI agar tersimpan ke Firestore
      createdAt: createdAt || new Date().toISOString(),
    };

    await getAdminDb().collection('affiliates').doc(id).set(affiliateData, { merge: true });
    
    return NextResponse.json({ status: 'success', uid }, { status: 201 });
  } catch (error: any) {
    console.error('Error saving affiliate:', error);
    return NextResponse.json({ error: 'Failed to save affiliate' }, { status: 500 });
  }
}