import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { idToken, role } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID Token' }, { status: 400 });
    }

    if (!role || (role !== 'admin' && role !== 'affiliate')) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    let voucherCode = null;

    if (role === 'affiliate') {
      try {
        const decodedToken = await getAdminAuth().verifyIdToken(idToken);
        const db = getAdminDb();
        let affSnap = await db.collection('affiliates').where('uid', '==', decodedToken.uid).limit(1).get();
        if (affSnap.empty && decodedToken.email) {
          affSnap = await db.collection('affiliates').where('email', '==', decodedToken.email).limit(1).get();
        }
        if (!affSnap.empty) {
          voucherCode = affSnap.docs[0].data().voucherCode || null;
        }
      } catch (e) {
        console.error('Error fetching affiliate data during session creation:', e);
      }
    }

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    // Create the session cookie
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn });

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

    return NextResponse.json({ status: 'success', voucherCode }, { status: 200 });
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 401 });
  }
}
