import { cache } from 'react';
import { getAdminDb } from '@/lib/firebaseAdmin';

// One Firestore read per request, shared by layout.tsx, generateMetadata, and the page.
export const getCachedProduct = cache(async (slug: string) => {
  const doc = await getAdminDb().collection('products').doc(slug).get();
  if (!doc.exists) return null;
  return doc.data();
});
