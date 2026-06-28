import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  normalizeProduct,
  validateSimpleProduct,
  validateVariableProduct,
  buildSimplePayload,
  buildVariablePayload,
} from './_helpers';

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection('products').get();
    const products = snapshot.docs.map((doc) =>
      normalizeProduct(doc.id, doc.data() as Record<string, any>),
    );
    return NextResponse.json({ products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data.slug || !data.name)
      return NextResponse.json(
        { code: 'MISSING_FIELDS', message: 'Slug dan nama produk wajib diisi' },
        { status: 400 },
      );

    if (!['simple', 'variable'].includes(data.productType))
      return NextResponse.json(
        { code: 'INVALID_PRODUCT_TYPE', message: 'productType harus simple atau variable' },
        { status: 400 },
      );

    const validationError =
      data.productType === 'simple'
        ? validateSimpleProduct(data)
        : validateVariableProduct(data);

    if (validationError)
      return NextResponse.json(validationError, { status: 400 });

    const payload =
      data.productType === 'simple'
        ? buildSimplePayload(data)
        : buildVariablePayload(data);

    await getAdminDb().collection('products').doc(data.slug).set(payload);

    return NextResponse.json({ status: 'success', product: payload }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
