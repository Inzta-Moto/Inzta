import { NextResponse } from 'next/server';

export async function GET() {
  // Middleware handles protection, if it reaches here, session is valid
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}
