import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { role } = await request.json();
    
    if (role === 'admin') {
      cookies().delete('admin_session');
    } else if (role === 'affiliate') {
      cookies().delete('affiliate_session');
    } else {
      // Fallback
      cookies().delete('admin_session');
      cookies().delete('affiliate_session');
    }
    
    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    // If no body provided, delete both to be safe
    cookies().delete('admin_session');
    cookies().delete('affiliate_session');
    return NextResponse.json({ status: 'success' }, { status: 200 });
  }
}
