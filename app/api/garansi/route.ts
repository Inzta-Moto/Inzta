import { handleCreateClaim } from '@/lib/warranty/handlers';
import { routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 group 3: public warranty claim (validation, honeypot, timer, rate limits, photo check, ticket).
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return toResponse(await handleCreateClaim(routeDeps(), await toHandlerRequest(request, true)));
}
