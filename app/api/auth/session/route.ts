import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';
import { isAllowedAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { idToken, role } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID Token' }, { status: 400 });
    }

    if (!role || (role !== 'admin' && role !== 'affiliate')) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verify the ID token to get the user's UID and email
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // The role in the body is only a request; admin is granted from the verified token and the allowlist.
    if (role === 'admin' && !isAllowedAdmin(decodedToken)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    // Create the session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Determine cookie name based on role
    const cookieName = role === 'admin' ? 'admin_session' : 'affiliate_session';

    // Set cookie
    cookies().set(cookieName, sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    let voucherCode = null;

    if (role === 'affiliate') {
      const db = getAdminDb();
      // First try to find by uid
      let affSnap = await db.collection('affiliates').where('uid', '==', uid).limit(1).get();
      
      // Fallback to email if uid is not set
      if (affSnap.empty && email) {
        affSnap = await db.collection('affiliates').where('email', '==', email).limit(1).get();
      }

      if (!affSnap.empty) {
        voucherCode = affSnap.docs[0].data().voucherCode;
      }
    }

    return NextResponse.json({ status: 'success', voucherCode }, { status: 200 });
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 401 });
  }
}
