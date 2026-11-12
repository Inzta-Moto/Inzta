import { handleErpPreflight, handleErpSummary } from '@/lib/warranty/handlers';
import { erpRouteDeps, routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 ERP API: counts of new claims and new feedback for the sidebar badges.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return toResponse(await handleErpSummary(erpRouteDeps(), await toHandlerRequest(request, false)));
}

export async function OPTIONS(request: Request) {
  return toResponse(handleErpPreflight(routeDeps(), await toHandlerRequest(request, false)));
}
