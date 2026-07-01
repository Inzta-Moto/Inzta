import { getAdminDb } from '@/lib/firebaseAdmin';
import ProdukClient from './ProdukClient';
import { Product } from '@/types';
import { normalizeProduct } from '@/lib/product-utils';

export const dynamic = 'force-dynamic';

export default async function ProdukPage() {
  let products: Product[] = [];

  try {
    const db = getAdminDb();
    
    // Ambil data semua produk
    const productsSnapshot = await db.collection('products')
      .where('isActive', '==', true)
      .get();
      
    products = productsSnapshot.docs
      .map(d => {
        const data = d.data();
        // Normalisasi legacy docs (productType undefined → 'simple', dll) supaya
        // ProductCard di listing menampilkan harga & stok yang benar.
        const normalized = normalizeProduct(d.id, data) as any;
        return {
          ...normalized,
          slug: d.id,
          createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : null,
          updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : null,
        } as unknown as Product;
      })
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  } catch (error) {
    console.error('Error fetching products:', error);
  }

  return <ProdukClient initialProducts={products} />;
}
