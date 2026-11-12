import { handleErpFeedbackGet, handleErpFeedbackPatch, handleErpPreflight } from '@/lib/warranty/handlers';
import { erpRouteDeps, routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 ERP API: feedback detail and staff changes (status, internal note).
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { ref: string } }) {
  return toResponse(await handleErpFeedbackGet(erpRouteDeps(), await toHandlerRequest(request, false), params.ref));
}

export async function PATCH(request: Request, { params }: { params: { ref: string } }) {
  return toResponse(await handleErpFeedbackPatch(erpRouteDeps(), await toHandlerRequest(request, true), params.ref));
}

export async function OPTIONS(request: Request) {
  return toResponse(handleErpPreflight(routeDeps(), await toHandlerRequest(request, false)));
}
