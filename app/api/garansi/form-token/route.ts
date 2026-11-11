import { handleFormToken } from '@/lib/warranty/handlers';
import { routeDeps, toResponse } from '@/lib/warranty/route-deps';

// F-031: timer token for the claim and feedback forms (requirement 3.3); never cached, the issue time is the point.
export const dynamic = 'force-dynamic';

export async function GET() {
  return toResponse(await handleFormToken(routeDeps()));
}
