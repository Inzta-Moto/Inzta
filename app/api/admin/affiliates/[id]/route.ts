import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = decodeURIComponent(params.id);
    await getAdminDb().collection('affiliates').doc(id).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting affiliate:', error);
    return NextResponse.json({ error: 'Failed to delete affiliate' }, { status: 500 });
  }
}
