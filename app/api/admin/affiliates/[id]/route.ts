import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyAdminSession } from '@/lib/auth';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAdminSession();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  try {
    const id = decodeURIComponent(params.id);
    await getAdminDb().collection('affiliates').doc(id).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting affiliate:', error);
    return NextResponse.json({ error: 'Failed to delete affiliate' }, { status: 500 });
  }
}
