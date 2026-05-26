import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const adminSession = request.cookies.get('admin_session');
  const affiliateSession = request.cookies.get('affiliate_session');
  
  // Protect /admin routes (except login)
  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
    if (!adminSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Protect /affiliate routes (except login)
  if (request.nextUrl.pathname.startsWith('/affiliate') && !request.nextUrl.pathname.startsWith('/affiliate/login')) {
    if (!affiliateSession) {
      return NextResponse.redirect(new URL('/affiliate/login', request.url));
    }
  }

  // If user is already logged in and tries to access /admin/login, redirect to /admin
  if (request.nextUrl.pathname === '/admin/login') {
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // If user is already logged in and tries to access /affiliate/login, redirect to /affiliate/dashboard
  if (request.nextUrl.pathname === '/affiliate/login') {
    if (affiliateSession) {
      return NextResponse.redirect(new URL('/affiliate/dashboard', request.url));
    }
  }

  // Protect /api/admin routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Protect /api/affiliate routes
  if (request.nextUrl.pathname.startsWith('/api/affiliate')) {
    if (!affiliateSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/affiliate/:path*', '/api/affiliate/:path*'],
};
