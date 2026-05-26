import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function DELETE(_: Request, { params }: { params: { code: string } }) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const code = decodeURIComponent(params.code);
    await getAdminDb().collection('vouchers').doc(code).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting voucher:', error);
    return NextResponse.json({ error: 'Failed to delete voucher' }, { status: 500 });
  }
}
