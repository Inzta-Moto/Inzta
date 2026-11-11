import { handleErpClaimGet, handleErpClaimPatch, handleErpPreflight } from '@/lib/warranty/handlers';
import { erpRouteDeps, routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 ERP API: claim detail with signed photo URLs, and staff changes (status, assignee, notes).
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { ticket: string } }) {
  return toResponse(await handleErpClaimGet(erpRouteDeps(), await toHandlerRequest(request, false), params.ticket));
}

export async function PATCH(request: Request, { params }: { params: { ticket: string } }) {
  return toResponse(await handleErpClaimPatch(erpRouteDeps(), await toHandlerRequest(request, true), params.ticket));
}

export async function OPTIONS(request: Request) {
  return toResponse(handleErpPreflight(routeDeps(), await toHandlerRequest(request, false)));
}
