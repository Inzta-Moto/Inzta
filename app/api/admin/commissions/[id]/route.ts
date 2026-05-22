import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = decodeURIComponent(params.id);
    const body = await request.json();
    const updates: Record<string, any> = {};

    if (typeof body.isPaid === 'boolean') {
      updates.isPaid = body.isPaid;
      updates.paidAt = body.isPaid ? admin.firestore.FieldValue.serverTimestamp() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates' }, { status: 400 });
    }

    await getAdminDb().collection('commissions').doc(id).set(updates, { merge: true });
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating commission:', error);
    return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const id = decodeURIComponent(params.id);
    await getAdminDb().collection('commissions').doc(id).delete();
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting commission:', error);
    return NextResponse.json({ error: 'Failed to delete commission' }, { status: 500 });
  }
}
