import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { MAX_BODY_BYTES } from '@/lib/warranty/rules';
import { warrantyConfig } from '@/lib/warranty/server';
import { erpTokenVerifier } from '@/lib/warranty/erp-auth';
import type { Deps, ErpDeps, HandlerRequest, HandlerResponse } from '@/lib/warranty/handlers';

// Real dependencies of the F-031 handlers for the route files. Firestore is resolved on first use, inside the
// handler's error guard, so a request without credentials answers 500 instead of crashing at import.

export function routeDeps(): Deps {
  const env = warrantyConfig();
  return {
    get db() {
      return getAdminDb();
    },
    env,
    now: () => Date.now(),
    randomBytes: n => randomBytes(n),
    fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    stamp: ms => Timestamp.fromMillis(ms),
    log: (msg, meta) => console.log(msg, meta ?? ''),
  };
}

export function erpRouteDeps(): ErpDeps {
  const deps = routeDeps();
  const verify = async (token: string) => (await erpTokenVerifier(deps.env.erpProjectId))(token);
  return Object.defineProperties({} as ErpDeps, {
    ...Object.getOwnPropertyDescriptors(deps),
    verify: { value: verify, enumerable: true },
  });
}

/** Request → handler input. A body declared over the limit is not read; the handler answers 413 from the header. */
export async function toHandlerRequest(request: Request, withBody: boolean): Promise<HandlerRequest> {
  const url = new URL(request.url);
  const declared = Number(request.headers.get('content-length'));
  const body = withBody && !(Number.isFinite(declared) && declared > MAX_BODY_BYTES) ? await request.text() : '';
  return { headers: request.headers, body, query: Object.fromEntries(url.searchParams) };
}

export function toResponse(res: HandlerResponse): NextResponse {
  if (res.body === null) return new NextResponse(null, { status: res.status, headers: res.headers });
  return NextResponse.json(res.body, { status: res.status, headers: res.headers });
}
