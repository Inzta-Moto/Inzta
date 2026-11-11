import { handleFormToken } from '@/lib/warranty/handlers';
import { routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031: timer token for the claim and feedback forms (requirement 3.3); never cached, the issue time is the point.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return toResponse(await handleFormToken(routeDeps(), await toHandlerRequest(request, false)));
}
