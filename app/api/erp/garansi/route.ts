import { handleErpClaimList, handleErpPreflight } from '@/lib/warranty/handlers';
import { erpRouteDeps, routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 ERP API (option B): claim list for dashboard.inzta.id, Firebase ID token of the ERP project required.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return toResponse(await handleErpClaimList(erpRouteDeps(), await toHandlerRequest(request, false)));
}

export async function OPTIONS(request: Request) {
  return toResponse(handleErpPreflight(routeDeps(), await toHandlerRequest(request, false)));
}
