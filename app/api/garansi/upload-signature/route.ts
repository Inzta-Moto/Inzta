import { handleUploadSignature } from '@/lib/warranty/handlers';
import { routeDeps, toHandlerRequest, toResponse } from '@/lib/warranty/route-deps';

// F-031 group 4: one signed Cloudinary upload per photo, rate limited per hashed IP.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return toResponse(await handleUploadSignature(routeDeps(), await toHandlerRequest(request, false)));
}
