import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('products').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ products }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (!data.slug || !data.name) {
      return NextResponse.json({ error: 'Missing slug or name' }, { status: 400 });
    }

    // Set server timestamp for createdAt
    const newProduct = {
      ...data,
      createdAt: new Date().toISOString(),
    };

    await getAdminDb().collection('products').doc(data.slug).set(newProduct, { merge: true });
    
    return NextResponse.json({ status: 'success', product: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
