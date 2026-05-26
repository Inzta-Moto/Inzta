import { cookies } from 'next/headers';
import { getAdminAuth } from './firebaseAdmin';

export async function verifyAdminSession() {
  const sessionCookie = cookies().get('admin_session')?.value;

  if (!sessionCookie) {
    return { error: 'No session cookie' };
  }

  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    // You could also add custom claims check here if needed: 
    // if (decodedClaims.role !== 'admin') ...
    return { uid: decodedClaims.uid, decodedClaims };
  } catch (error) {
    console.error('Verify Admin Session Error:', error);
    return { error: 'Invalid or expired session' };
  }
}

export async function verifyAffiliateSession() {
  const sessionCookie = cookies().get('affiliate_session')?.value;

  if (!sessionCookie) {
    return { error: 'No session cookie' };
  }

  try {
    const decodedClaims = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return { uid: decodedClaims.uid, decodedClaims };
  } catch (error) {
    console.error('Verify Affiliate Session Error:', error);
    return { error: 'Invalid or expired session' };
  }
}
