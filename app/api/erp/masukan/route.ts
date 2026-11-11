import { handleErpFeedbackList, handleErpPreflight } from '@/lib/warranty/handlers';
import { erpRouteDeps, routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 ERP API: feedback list (requirement 10.6).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return toResponse(await handleErpFeedbackList(erpRouteDeps(), await toHandlerRequest(request, false)));
}

export async function OPTIONS(request: Request) {
  return toResponse(handleErpPreflight(routeDeps(), await toHandlerRequest(request, false)));
}
