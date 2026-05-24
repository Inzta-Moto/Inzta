import { NextResponse } from 'next/server';

/**
 * DEPRECATED: Commission tracking is now handled automatically in 
 * /api/admin/orders/[orderId] when status is set to 'completed'.
 */
export async function POST() {
  return NextResponse.json({ 
    error: 'Deprecated: Commission is now tracked when order is marked completed.' 
  }, { status: 410 });
}
