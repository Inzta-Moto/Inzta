import { getAdminDb } from '@/lib/firebaseAdmin';
import { db as clientDb } from '@/lib/firebase';
import { getDocs, collection } from 'firebase/firestore';
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
    // Fallback to client-side fetching if admin fails
    try {
      const productsSnap = await getDocs(collection(clientDb, 'products'));
      products = productsSnap.docs
        .map(doc => {
          const data = doc.data();
          // Handling client-side timestamp which might have toMillis() or seconds
          const createdAt = data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : (data.createdAt.seconds ? data.createdAt.seconds * 1000 : data.createdAt)) : null;
          const updatedAt = data.updatedAt ? (data.updatedAt.toMillis ? data.updatedAt.toMillis() : (data.updatedAt.seconds ? data.updatedAt.seconds * 1000 : data.updatedAt)) : null;
          
          return {
            ...data,
            slug: doc.id,
            createdAt,
            updatedAt,
          } as unknown as Product;
        })
        .filter(p => p.isActive === true)
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 10);
      
      const featuresSnap = await getDocs(collection(clientDb, 'features'));
      features = featuresSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Feature))
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
  }

  return (
    <HomeClient initialProducts={products} initialFeatures={features} />
  );
}
