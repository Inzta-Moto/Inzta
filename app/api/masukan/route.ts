import { handleCreateFeedback } from '@/lib/warranty/handlers';
import { routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 requirement 10.3: public feedback form.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return toResponse(await handleCreateFeedback(routeDeps(), await toHandlerRequest(request, true)));
}
