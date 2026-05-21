import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  
  // Protect /admin routes (except login)
  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/login')) {
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // If user is already logged in and tries to access /admin/login, redirect to /admin
  if (request.nextUrl.pathname === '/admin/login') {
    if (session) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // Protect /api/admin routes
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
