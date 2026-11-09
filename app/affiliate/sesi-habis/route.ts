import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// F-023 REV-01: where the dashboard sends a session cookie it no longer accepts. The dashboard cannot clear the cookie
// itself (Server Components cannot write cookies), and with loading.tsx its redirect arrives as a 200 meta refresh,
// which the browser does not count as a redirect. Sent straight to /affiliate/login, the middleware would bounce the
// still-present cookie back to the dashboard forever. Clearing it here breaks that loop without touching the
// middleware, Firebase, or Firestore.
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/affiliate/login', request.url));
  // Same name, path, and flags as app/api/auth/session/route.ts, so the browser replaces that cookie.
  response.cookies.set('affiliate_session', '', {
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
