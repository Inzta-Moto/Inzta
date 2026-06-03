import { getAdminDb } from '@/lib/firebaseAdmin';
import HomeClient from './HomeClient';
import { Product, Feature } from '@/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let products: Product[] = [];
  let features: Feature[] = [];

  try {
    const db = getAdminDb();
    
    // Fetch products
    const productsSnapshot = await db.collection('products')
      .where('isActive', '==', true)
      // Note: Admin SDK query ordering might need an index. If not, we can sort in JS.
      .get();
      
    products = productsSnapshot.docs
      .map(d => {
        const data = d.data();
        return {
          ...data,
          slug: d.id,
          createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : null,
          updatedAt: data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : data.updatedAt) : null,
        } as unknown as Product;
      })
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);

    // Fetch features
    const featuresSnapshot = await db.collection('features')
      .where('isActive', '==', true)
      .get();
      
    features = featuresSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as Feature))
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  } catch (e) {
    console.error('Failed to load initial data for home page:', e);
  }

  return (
    <HomeClient initialProducts={products} initialFeatures={features} />
  );
}
