import type { Firestore } from 'firebase-admin/firestore';
import type {
  FeedbackHistoryEntry,
  FeedbackInput,
  FeedbackStatus,
  WarrantyAssignee,
  WarrantyClaimInput,
  WarrantyHistoryEntry,
  WarrantyPhoto,
  WarrantyRejectReason,
  WarrantyResolution,
  WarrantyStatus,
} from '@/types';
import { SITE_ORIGIN } from '@/lib/constants';
import { WARRANTY_COPY } from '@/lib/warranty/copy';
import {
  CLAIM_KEYS,
  CLAIM_PATCH_KEYS,
  FEEDBACK_KEYS,
  FEEDBACK_PATCH_KEYS,
  FEEDBACK_REF_RE,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  MAX_BODY_BYTES,
  NOTE_LIMITS,
  OPEN_STATUSES,
  REJECT_REASONS,
  RESOLUTIONS,
  STATUSES,
  TICKET_RE,
  allowedNext,
  allowedNextFeedback,
  canTransition,
  canTransitionFeedback,
  charLength,
  cleanText,
  generateTicket,
  isClosed,
  isOutsidePeriod,
  isPlainObject,
  rateBuckets,
  requiredFieldsFor,
  statusLabel,
  unknownKeys,
  validateClaimInput,
  validateFeedbackInput,
  waLink,
  whatsappTemplate,
} from '@/lib/warranty/rules';
import { CloudinaryUnavailable, staffPhotoUrls, uploadSignature, randomPublicId, verifyUploadedPhoto, type FetchLike } from '@/lib/warranty/cloudinary';
import { checkFormToken, clientIp, ipHash, issueFormToken, whatsappHash, type WarrantyConfig } from '@/lib/warranty/server';
import { DAY_MS, HOUR_MS, checkLimits, cleanupExpiredLimits, type LimitRule } from '@/lib/warranty/rate-limit';
import type { LocalGate } from '@/lib/warranty/local-gate';
import { authorize, erpCorsHeaders, erpPreflight, type ErpStaff, type TokenVerifier } from '@/lib/warranty/erp-auth';
import { toIso, toMs, type Stamp } from '@/lib/warranty/time';

// F-031 route logic (design.md §5, §12): every route file in app/api/garansi, app/api/masukan, and app/api/erp is a thin
// wrapper around one handler here. Handlers take their dependencies (Firestore, clock, randomness, fetch, token
// verifier, env), so tests/f031-warranty-api.cjs runs them against an in-memory Firestore and a fake Cloudinary.
// Logs carry codes and ticket numbers only, never personal data or the Authorization header (3.5, 6.3a).

const E = WARRANTY_COPY.errors;

export interface Deps {
  db: Firestore;
  env: WarrantyConfig;
  now: () => number;
  randomBytes: (n: number) => Uint8Array;
  fetch: FetchLike;
  stamp: Stamp;
  log: (msg: string, meta?: Record<string, string | number | boolean>) => void;
  gate: LocalGate;
}

export interface ErpDeps extends Deps {
  verify: TokenVerifier;
}

export interface HandlerRequest {
  headers: { get(name: string): string | null };
  body?: string;
  query?: Record<string, string | undefined>;
}

export interface HandlerResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const json = (status: number, body: unknown, headers?: Record<string, string>): HandlerResponse => ({ status, body, headers });
const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}) => json(status, { error, code, ...extra });
const NO_STORE = { 'Cache-Control': 'no-store' };

class HttpError extends Error {
  constructor(public res: HandlerResponse) {
    super('http');
  }
}

/** Size and JSON shape of a public POST body (3.1): 413 over 32 KB, 400 for anything but one JSON object. */
function parseBody(req: HandlerRequest): Record<string, unknown> {
  const declared = Number(req.headers.get('content-length'));
  const raw = req.body ?? '';
  if ((Number.isFinite(declared) && declared > MAX_BODY_BYTES) || Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    throw new HttpError(fail(413, 'TOO_LARGE', E.tooLarge));
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(fail(400, 'BAD_JSON', E.badRequest));
  }
  if (!isPlainObject(body)) throw new HttpError(fail(400, 'BAD_JSON', E.badRequest));
  return body;
}

async function guard(deps: Deps, label: string, run: () => Promise<HandlerResponse>, headers: Record<string, string> = NO_STORE): Promise<HandlerResponse> {
  try {
    const res = await run();
    return { ...res, headers: { ...headers, ...(res.headers ?? {}) } };
  } catch (e) {
    if (e instanceof HttpError) return { ...e.res, headers: { ...headers, ...(e.res.headers ?? {}) } };
    deps.log(`[${label}] failed`, { error: e instanceof Error ? e.name : 'unknown' });
    return { status: 500, body: { error: E.server, code: 'SERVER' }, headers };
  }
}

/** Active product name for a submitted slug, read by id (one document, not the catalog). */
async function productNamesFor(db: Firestore, slug: unknown): Promise<Record<string, string>> {
  if (!isProductSlug(slug)) return {};
  const snap = await db.collection('products').doc(slug).get();
  if (!snap.exists) return {};
  const d = snap.data() as { isActive?: boolean; name?: unknown };
  return d.isActive === true && typeof d.name === 'string' && d.name.trim() ? { [slug]: d.name.trim() } : {};
}

const isProductSlug = (slug: unknown): slug is string => typeof slug === 'string' && /^[a-z0-9-]{1,120}$/.test(slug) && slug !== 'lainnya';

/** Placeholder name for the submitted slug, so the pure checks run before the one product read (review SEC-01). */
const provisionalNames = (slug: unknown): Record<string, string> => (isProductSlug(slug) ? { [slug]: '…' } : {});

function requireSecret(deps: Deps): string {
  if (!deps.env.hashSecret) {
    deps.log('[garansi] WARRANTY_HASH_SECRET missing');
    throw new HttpError(fail(503, 'UNAVAILABLE', E.server));
  }
  return deps.env.hashSecret;
}

function requirePhotoConfig(deps: Deps, label: string): { cfg: NonNullable<WarrantyConfig['cloudinary']>; folder: string } {
  const cfg = deps.env.cloudinary;
  const folder = deps.env.folder;
  if (!cfg || !folder) {
    deps.log(`[${label}] ${!cfg ? 'CLOUDINARY_URL' : 'WARRANTY_CLOUDINARY_FOLDER'} missing`);
    throw new HttpError(fail(503, 'UPLOAD_UNAVAILABLE', E.photoUnavailable));
  }
  return { cfg, folder };
}

const RATE_LIMITED = () => fail(429, 'RATE_LIMITED', E.rateLimited);

/**
 * Cheap gate before any Firestore read (review SEC-01): a key Firestore already refused, or a source over its local
 * budget, gets 429 without touching the database.
 */
function gateRefuses(deps: Deps, key: string): boolean {
  return deps.gate.refuse(key, deps.now());
}

/** Firestore limits; a refusal is remembered locally until the end of the longest window of the rules checked. */
async function limits(deps: Deps, gateKey: string, rules: LimitRule[]): Promise<boolean> {
  const now = deps.now();
  const res = await checkLimits(deps.db, rules, now, deps.stamp);
  if (!res.ok) {
    const rule = rules.find(r => r.key === res.key);
    deps.gate.block(gateKey, now + Math.min(rule ? rule.windowMs : HOUR_MS, HOUR_MS));
  }
  return res.ok;
}

// GET /api/garansi/form-token: the timer token both forms send back (3.3, 10.3), bound to the caller's IP bucket.
export async function handleFormToken(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  return guard(deps, 'form-token', async () => {
    const secret = requireSecret(deps);
    return json(200, { token: issueFormToken(secret, deps.now(), ipHash(secret, clientIp(req.headers))) });
  });
}

/** Honeypot and timer (3.3). A filled honeypot gets a silent 200 that looks like success and writes nothing. */
function antiSpam(deps: Deps, body: Record<string, unknown>, secret: string, ip: string, prefix: 'GRN' | 'MSK'): HandlerResponse | null {
  if (typeof body.trap === 'string' ? body.trap !== '' : body.trap !== undefined) {
    deps.log(`[${prefix === 'GRN' ? 'garansi' : 'masukan'}] honeypot`);
    const fake = generateTicket(deps.randomBytes(6), prefix);
    return json(200, prefix === 'GRN' ? { ticket: fake } : { ref: fake });
  }
  const timer = checkFormToken(secret, body.formToken, deps.now(), ip);
  if (timer === 'invalid') return fail(400, 'FORM_EXPIRED', E.formExpired);
  if (timer === 'too-fast') return fail(400, 'TOO_FAST', E.tooFast);
  return null;
}

// POST /api/garansi/upload-signature (group 4). Needs a valid form token, so signatures go to an open form only
// (review SEC-08); budget per IP bucket and a global daily cap (review SEC-02).
export async function handleUploadSignature(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  return guard(deps, 'garansi-sign', async () => {
    const secret = requireSecret(deps);
    const { cfg, folder } = requirePhotoConfig(deps, 'garansi-sign');
    const body = req.body ? parseBody(req) : {};
    if (unknownKeys(body, ['formToken']).length) return fail(400, 'UNKNOWN_KEYS', E.badRequest);
    const ip = ipHash(secret, clientIp(req.headers));
    if (checkFormToken(secret, body.formToken, deps.now(), ip) === 'invalid') return fail(400, 'FORM_EXPIRED', E.formExpired);
    const gateKey = `sign:${ip}`;
    if (gateRefuses(deps, gateKey)) return RATE_LIMITED();
    const now = deps.now();
    const { hour, day } = rateBuckets(now);
    const r = deps.env.rates;
    const ok = await limits(deps, gateKey, [
      { key: `garansi-sign-${ip}-${hour}`, limit: r.signHour, windowMs: HOUR_MS },
      { key: `garansi-sign-global-${day}`, limit: r.signGlobalDay, windowMs: DAY_MS },
    ]);
    if (!ok) return RATE_LIMITED();
    return json(200, uploadSignature(cfg, { folder, now, randomId: randomPublicId(deps.randomBytes(18)) }));
  });
}

/** The stored claim document (design.md §3). Photos are the values Cloudinary reported, never the client's. */
export function buildClaim(input: WarrantyClaimInput, o: { ticket: string; now: number; ipHash: string; photos: WarrantyPhoto[]; stamp: Stamp }) {
  const at = new Date(o.now).toISOString();
  const ts = o.stamp(o.now);
  const history: WarrantyHistoryEntry[] = [{ at, by: 'customer', to: 'new' }];
  return {
    ticket: o.ticket,
    customer: { name: input.name, whatsapp: input.whatsapp, location: input.location },
    product: {
      slug: input.productSlug,
      name: input.productName,
      channel: input.channel,
      purchaseDate: input.purchaseDate,
      orderRef: input.orderRef,
      usage: input.usage,
    },
    damage: input.damage,
    description: input.description,
    photos: o.photos,
    videoViaWhatsApp: input.videoViaWhatsApp,
    outsidePeriod: isOutsidePeriod(input.purchaseDate, o.now),
    status: 'new' as WarrantyStatus,
    assignee: 'admin' as WarrantyAssignee,
    publicNote: '',
    resolution: null,
    rejectReason: null,
    history,
    consentAt: at,
    ipHash: o.ipHash,
    createdAt: ts,
    updatedAt: ts,
    statusChangedAt: ts,
    firstResponseAt: null,
    closedAt: null,
  };
}

export function buildFeedback(input: FeedbackInput, o: { ref: string; now: number; ipHash: string; stamp: Stamp }) {
  const at = new Date(o.now).toISOString();
  const ts = o.stamp(o.now);
  const history: FeedbackHistoryEntry[] = [{ at, by: 'customer', to: 'new' }];
  return {
    ref: o.ref,
    kind: input.kind,
    message: input.message,
    product: input.productName ? { slug: input.productSlug, name: input.productName } : null,
    contact: { name: input.name, whatsapp: input.whatsapp },
    status: 'new' as FeedbackStatus,
    internalNote: '',
    history,
    consentAt: at,
    ipHash: o.ipHash,
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Creates `collection/{id}` with a fresh id in one transaction, retrying on a collision at most 5 times (3.4). */
async function createWithFreshId(deps: Deps, collection: string, prefix: 'GRN' | 'MSK', build: (id: string) => Record<string, unknown>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateTicket(deps.randomBytes(6), prefix);
    const ref = deps.db.collection(collection).doc(id);
    const created = await deps.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.create(ref, build(id));
      return true;
    });
    if (created) return id;
  }
  throw new Error('ticket collision');
}

// POST /api/garansi (group 3). Order keeps anonymous cost low: pure checks, local gate, per-IP Firestore limits, one
// product read, photo checks, then the per-number and global counters, which only valid claims with verified photos
// spend, so fake photos cannot use up another customer's number (review SEC-03).
export async function handleCreateClaim(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  return guard(deps, 'garansi', async () => {
    const body = parseBody(req);
    const extra = unknownKeys(body, CLAIM_KEYS);
    if (extra.length) return fail(400, 'UNKNOWN_KEYS', E.badRequest);
    const secret = requireSecret(deps);
    const ip = ipHash(secret, clientIp(req.headers));
    const spam = antiSpam(deps, body, secret, ip, 'GRN');
    if (spam) return spam;
    const { cfg, folder } = requirePhotoConfig(deps, 'garansi');

    const now = deps.now();
    const pre = validateClaimInput(body, { now, productNames: provisionalNames(body.product), folder });
    if (!pre.ok) return fail(400, 'INVALID', E.badRequest, { fields: pre.errors });

    const gateKey = `claim:${ip}`;
    if (gateRefuses(deps, gateKey)) return RATE_LIMITED();
    const { hour, day } = rateBuckets(now);
    const r = deps.env.rates;
    const ipOk = await limits(deps, gateKey, [
      { key: `garansi-submit-${ip}-${hour}`, limit: r.claimHour, windowMs: HOUR_MS },
      { key: `garansi-submit-day-${ip}-${day}`, limit: r.claimDay, windowMs: DAY_MS },
    ]);
    if (!ipOk) return RATE_LIMITED();

    const productNames = await productNamesFor(deps.db, body.product);
    const v = validateClaimInput(body, { now, productNames, folder });
    if (!v.ok) return fail(400, 'INVALID', E.badRequest, { fields: v.errors });

    let verified: (WarrantyPhoto | null)[];
    try {
      verified = await Promise.all(v.value.photos.map(p => verifyUploadedPhoto(cfg, p.publicId, deps.fetch)));
    } catch (e) {
      if (e instanceof CloudinaryUnavailable) {
        deps.log('[garansi] Cloudinary unavailable', { status: e.message });
        return fail(503, 'UPLOAD_UNAVAILABLE', E.photoUnavailable);
      }
      throw e;
    }
    if (verified.some(p => p === null)) return fail(400, 'INVALID', E.badRequest, { fields: { photos: E.photosInvalid } });

    const numberOk = await limits(deps, `claim-wa:${ip}`, [
      { key: `garansi-wa-${whatsappHash(secret, v.value.whatsapp)}-${day}`, limit: r.claimWaDay, windowMs: DAY_MS },
      { key: `garansi-submit-global-${day}`, limit: r.claimGlobalDay, windowMs: DAY_MS },
    ]);
    if (!numberOk) return RATE_LIMITED();

    const ticket = await createWithFreshId(deps, 'warrantyClaims', 'GRN', id =>
      buildClaim(v.value, { ticket: id, now, ipHash: ip, photos: verified as WarrantyPhoto[], stamp: deps.stamp }),
    );
    deps.log('[garansi] created', { ticket });
    return json(201, { ticket });
  });
}

// POST /api/masukan (10.3).
export async function handleCreateFeedback(deps: Deps, req: HandlerRequest): Promise<HandlerResponse> {
  return guard(deps, 'masukan', async () => {
    const body = parseBody(req);
    const extra = unknownKeys(body, FEEDBACK_KEYS);
    if (extra.length) return fail(400, 'UNKNOWN_KEYS', E.badRequest);
    const secret = requireSecret(deps);
    const ip = ipHash(secret, clientIp(req.headers));
    const spam = antiSpam(deps, body, secret, ip, 'MSK');
    if (spam) return spam;

    const now = deps.now();
    const pre = validateFeedbackInput(body, { productNames: provisionalNames(body.product) });
    if (!pre.ok) return fail(400, 'INVALID', E.badRequest, { fields: pre.errors });

    const gateKey = `feedback:${ip}`;
    if (gateRefuses(deps, gateKey)) return RATE_LIMITED();
    const { hour, day } = rateBuckets(now);
    const r = deps.env.rates;
    const ok = await limits(deps, gateKey, [
      { key: `masukan-submit-${ip}-${hour}`, limit: r.feedbackHour, windowMs: HOUR_MS },
      { key: `masukan-submit-day-${ip}-${day}`, limit: r.feedbackDay, windowMs: DAY_MS },
      { key: `masukan-submit-global-${day}`, limit: r.feedbackGlobalDay, windowMs: DAY_MS },
    ]);
    if (!ok) return RATE_LIMITED();

    const productNames = await productNamesFor(deps.db, body.product);
    const v = validateFeedbackInput(body, { productNames });
    if (!v.ok) return fail(400, 'INVALID', E.badRequest, { fields: v.errors });

    const ref = await createWithFreshId(deps, 'feedback', 'MSK', id => buildFeedback(v.value, { ref: id, now, ipHash: ip, stamp: deps.stamp }));
    deps.log('[masukan] created', { ref });
    return json(201, { ref });
  });
}

// ERP API (group 5, 6, 10.6)

type ClaimDoc = ReturnType<typeof buildClaim> & Record<string, unknown>;
type FeedbackDoc = ReturnType<typeof buildFeedback> & Record<string, unknown>;

export type PatchResult<U> = { ok: true; update: U } | { ok: false; status: number; code: string; error: string; fields?: Record<string, string> };

const STALE = { ok: false as const, status: 409, code: 'STALE', error: 'Tiket sudah diubah orang lain, muat ulang.' };
// The history lives on the document (design.md §3); a cap keeps it far below Firestore's 1 MiB limit (review SEC-09).
const MAX_HISTORY = 200;
const HISTORY_FULL = { ok: false as const, status: 409, code: 'HISTORY_FULL', error: 'Riwayat tiket sudah penuh (200 catatan). Hubungi pengelola website.' };

function readNote(body: Record<string, unknown>, key: 'publicNote' | 'internalNote', errors: Record<string, string>): string | undefined {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] !== 'string') {
    errors[key] = 'Catatan harus berupa teks.';
    return undefined;
  }
  const v = cleanText(body[key]);
  if (charLength(v) > NOTE_LIMITS[key]) errors[key] = `Catatan maksimal ${NOTE_LIMITS[key]} karakter.`;
  return v;
}

const compact = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/**
 * Staff change to a claim (6.2–6.6): unknown keys 400, stale `expectedUpdatedAt` 409, disallowed transition 409,
 * missing required fields 400. Returns the Firestore update with one new history entry; customer data is never touched.
 */
export function applyPatch(claim: ClaimDoc, body: Record<string, unknown>, staff: ErpStaff, now: number, stamp: Stamp): PatchResult<Record<string, unknown>> {
  if (unknownKeys(body, CLAIM_PATCH_KEYS).length) return { ok: false, status: 400, code: 'UNKNOWN_KEYS', error: 'Ada isian yang tidak dikenal.' };
  if (typeof body.expectedUpdatedAt !== 'string') return { ok: false, status: 400, code: 'INVALID', error: 'expectedUpdatedAt wajib dikirim.' };
  if (body.expectedUpdatedAt !== toIso(claim.updatedAt)) return STALE;
  if (((claim.history as unknown[]) || []).length >= MAX_HISTORY) return HISTORY_FULL;

  const errors: Record<string, string> = {};
  const from = claim.status as WarrantyStatus;
  let to: WarrantyStatus | undefined;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as WarrantyStatus)) errors.status = 'Status tidak dikenal.';
    else if (body.status !== from) to = body.status as WarrantyStatus;
  }
  let assignee: WarrantyAssignee | undefined;
  if (body.assignee !== undefined) {
    if (body.assignee !== 'admin' && body.assignee !== 'produksi') errors.assignee = 'Penanggung jawab tidak dikenal.';
    else assignee = body.assignee;
  }
  let resolution: WarrantyResolution | undefined;
  if (body.resolution !== undefined && body.resolution !== null) {
    if (!RESOLUTIONS.includes(body.resolution as WarrantyResolution)) errors.resolution = 'Jenis penyelesaian tidak dikenal.';
    else resolution = body.resolution as WarrantyResolution;
  }
  let rejectReason: WarrantyRejectReason | undefined;
  if (body.rejectReason !== undefined && body.rejectReason !== null) {
    if (!REJECT_REASONS.includes(body.rejectReason as WarrantyRejectReason)) errors.rejectReason = 'Alasan penolakan tidak dikenal.';
    else rejectReason = body.rejectReason as WarrantyRejectReason;
  }
  const publicNote = readNote(body, 'publicNote', errors);
  const internalNote = readNote(body, 'internalNote', errors);
  if (Object.keys(errors).length) return { ok: false, status: 400, code: 'INVALID', error: 'Ada isian yang belum benar.', fields: errors };

  if (to && !canTransition(from, to, staff.role)) return { ok: false, status: 409, code: 'TRANSITION', error: 'Perubahan status ini tidak diizinkan. Muat ulang tiket.' };
  if (resolution && to !== 'resolved') errors.resolution = 'Jenis penyelesaian hanya diisi saat status menjadi Resolved.';
  if (rejectReason && to !== 'rejected') errors.rejectReason = 'Alasan penolakan hanya diisi saat status menjadi Rejected.';
  if (to) {
    for (const f of requiredFieldsFor(to, from)) {
      if (f === 'publicNote' && !publicNote) errors.publicNote = 'Catatan untuk customer wajib diisi untuk status ini.';
      if (f === 'resolution' && !resolution) errors.resolution = 'Pilih jenis penyelesaian.';
      if (f === 'rejectReason' && !rejectReason) errors.rejectReason = 'Pilih alasan penolakan.';
      if (f === 'note' && !publicNote && !internalNote) errors.note = 'Tulis catatan alasan membuka ulang tiket.';
    }
  }
  if (Object.keys(errors).length) return { ok: false, status: 400, code: 'INVALID', error: 'Ada isian yang belum lengkap.', fields: errors };

  // Entering in_progress hands the work to the production team (6.6).
  const nextAssignee = to === 'in_progress' ? 'produksi' : assignee;
  const assigneeChanged = nextAssignee !== undefined && nextAssignee !== claim.assignee;
  const publicChanged = publicNote !== undefined && publicNote !== claim.publicNote;
  if (!to && !assigneeChanged && !publicChanged && !internalNote) return { ok: false, status: 400, code: 'NO_CHANGE', error: 'Tidak ada perubahan untuk disimpan.' };

  const ts = stamp(now);
  const entry: WarrantyHistoryEntry = compact({
    at: new Date(now).toISOString(),
    by: staff.email || staff.uid,
    byUid: staff.uid,
    from: to ? from : undefined,
    to,
    assignee: assigneeChanged ? (nextAssignee as WarrantyAssignee) : undefined,
    publicNote: publicChanged ? publicNote : undefined,
    internalNote: internalNote || undefined,
    resolution,
    rejectReason,
  });
  const update: Record<string, unknown> = { updatedAt: ts, history: [...((claim.history as WarrantyHistoryEntry[]) || []), entry] };
  if (to) {
    update.status = to;
    update.statusChangedAt = ts;
    if (from === 'new' && !claim.firstResponseAt) update.firstResponseAt = ts;
    if (isClosed(to)) update.closedAt = ts;
    if (to === 'resolved') update.resolution = resolution;
    if (to === 'rejected') update.rejectReason = rejectReason;
    // Reopening clears the closing data; the history keeps it.
    if (isClosed(from)) {
      update.closedAt = null;
      update.resolution = null;
      update.rejectReason = null;
    }
  }
  if (assigneeChanged) update.assignee = nextAssignee;
  if (publicChanged) update.publicNote = publicNote;
  return { ok: true, update };
}

/** Staff change to feedback (10.6): status forward or archived → read, internal note replaced; history appended. */
export function applyFeedbackPatch(doc: FeedbackDoc, body: Record<string, unknown>, staff: ErpStaff, now: number, stamp: Stamp): PatchResult<Record<string, unknown>> {
  if (unknownKeys(body, FEEDBACK_PATCH_KEYS).length) return { ok: false, status: 400, code: 'UNKNOWN_KEYS', error: 'Ada isian yang tidak dikenal.' };
  if (typeof body.expectedUpdatedAt !== 'string') return { ok: false, status: 400, code: 'INVALID', error: 'expectedUpdatedAt wajib dikirim.' };
  if (body.expectedUpdatedAt !== toIso(doc.updatedAt)) return { ...STALE, error: 'Masukan sudah diubah orang lain, muat ulang.' };
  if (((doc.history as unknown[]) || []).length >= MAX_HISTORY) return HISTORY_FULL;
  const errors: Record<string, string> = {};
  const from = doc.status as FeedbackStatus;
  let to: FeedbackStatus | undefined;
  if (body.status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(body.status as FeedbackStatus)) errors.status = 'Status tidak dikenal.';
    else if (body.status !== from) to = body.status as FeedbackStatus;
  }
  const internalNote = readNote(body, 'internalNote', errors);
  if (Object.keys(errors).length) return { ok: false, status: 400, code: 'INVALID', error: 'Ada isian yang belum benar.', fields: errors };
  if (to && !canTransitionFeedback(from, to)) return { ok: false, status: 409, code: 'TRANSITION', error: 'Perubahan status ini tidak diizinkan. Muat ulang.' };
  const noteChanged = internalNote !== undefined && internalNote !== doc.internalNote;
  if (!to && !noteChanged) return { ok: false, status: 400, code: 'NO_CHANGE', error: 'Tidak ada perubahan untuk disimpan.' };
  const entry: FeedbackHistoryEntry = compact({
    at: new Date(now).toISOString(),
    by: staff.email || staff.uid,
    byUid: staff.uid,
    from: to ? from : undefined,
    to,
    internalNote: noteChanged ? internalNote : undefined,
  });
  const update: Record<string, unknown> = { updatedAt: stamp(now), history: [...((doc.history as FeedbackHistoryEntry[]) || []), entry] };
  if (to) update.status = to;
  if (noteChanged) update.internalNote = internalNote;
  return { ok: true, update };
}

const ageDays = (createdAt: unknown, now: number) => {
  const ms = toMs(createdAt);
  return ms === null ? null : Math.max(0, Math.floor((now - ms) / DAY_MS));
};

/** ERP detail of a claim: ISO dates, signed photo URLs, allowed next statuses, and the WhatsApp text for the status. */
export function claimView(d: ClaimDoc, deps: Pick<Deps, 'env' | 'now'>, role: ErpStaff['role']) {
  const now = deps.now();
  const cfg = deps.env.cloudinary;
  const history = ((d.history as WarrantyHistoryEntry[]) || []).map(h => ({ ...h }));
  const message = whatsappTemplate(d.status, { ticket: d.ticket, name: d.customer.name, publicNote: d.publicNote });
  return {
    ticket: d.ticket,
    status: d.status,
    statusLabel: statusLabel(d.status),
    allowedNext: allowedNext(d.status, role).map(s => ({ status: s, label: statusLabel(s), requires: requiredFieldsFor(s, d.status) })),
    assignee: d.assignee,
    customer: { ...d.customer, waLink: `https://wa.me/${d.customer.whatsapp}` },
    product: { ...d.product, url: d.product.slug ? `${SITE_ORIGIN}/produk/${d.product.slug}` : null },
    damage: d.damage,
    description: d.description,
    photos: cfg ? (d.photos || []).map(p => staffPhotoUrls(cfg, p, now)) : [],
    photosUnavailable: !cfg,
    videoViaWhatsApp: d.videoViaWhatsApp === true,
    outsidePeriod: d.outsidePeriod === true,
    publicNote: d.publicNote || '',
    resolution: d.resolution ?? null,
    rejectReason: d.rejectReason ?? null,
    internalNotes: history.filter(h => h.internalNote).map(h => ({ at: h.at, by: h.by, note: h.internalNote as string })),
    history,
    customerMessage: message,
    customerWaLink: message ? waLink(d.customer.whatsapp, message) : null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    statusChangedAt: toIso(d.statusChangedAt),
    firstResponseAt: toIso(d.firstResponseAt),
    closedAt: toIso(d.closedAt),
    ageDays: ageDays(d.createdAt, now),
  };
}

export function feedbackView(d: FeedbackDoc) {
  return {
    ref: d.ref,
    kind: d.kind,
    message: d.message,
    product: d.product ? { ...d.product, url: d.product.slug ? `${SITE_ORIGIN}/produk/${d.product.slug}` : null } : null,
    contact: { name: d.contact?.name ?? null, whatsapp: d.contact?.whatsapp ?? null, waLink: d.contact?.whatsapp ? `https://wa.me/${d.contact.whatsapp}` : null },
    status: d.status,
    statusLabel: FEEDBACK_STATUS_LABELS[d.status],
    allowedNext: allowedNextFeedback(d.status),
    internalNote: d.internalNote || '',
    history: ((d.history as FeedbackHistoryEntry[]) || []).map(h => ({ ...h })),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

const LIST_READ = 500;
const LIST_ROWS = 200;

async function erp(deps: ErpDeps, req: HandlerRequest, label: string, run: (staff: ErpStaff) => Promise<HandlerResponse>): Promise<HandlerResponse> {
  const cors = erpCorsHeaders(req.headers.get('origin'), deps.env);
  return guard(
    deps,
    label,
    async () => {
      const projectId = deps.env.erpProjectId;
      if (!projectId) {
        deps.log(`[${label}] ERP_FIREBASE_PROJECT_ID missing`);
        return fail(503, 'UNAVAILABLE', 'Layanan garansi belum diatur. Hubungi pengelola website.');
      }
      const auth = await authorize(req.headers.get('authorization'), deps.verify, { erpProjectId: projectId, staff: deps.env.staff });
      if (!auth.ok) return fail(auth.status, auth.code, auth.error);
      return run(auth.staff);
    },
    cors,
  );
}

export function handleErpPreflight(deps: Pick<Deps, 'env'>, req: HandlerRequest): HandlerResponse {
  const p = erpPreflight(req.headers.get('origin'), deps.env);
  return { status: p.status, body: null, headers: p.headers };
}

// GET /api/erp/garansi/ringkasan: badge counts (5.5, 10.7).
export async function handleErpSummary(deps: ErpDeps, req: HandlerRequest): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-ringkasan', async () => {
    const [claims, feedback] = await Promise.all([
      deps.db.collection('warrantyClaims').where('status', '==', 'new').count().get(),
      deps.db.collection('feedback').where('status', '==', 'new').count().get(),
    ]);
    return json(200, { newCount: claims.data().count, newFeedbackCount: feedback.data().count });
  });
}

// GET /api/erp/garansi?status=open|all|<status> (5.2, 5.3).
export async function handleErpClaimList(deps: ErpDeps, req: HandlerRequest): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-garansi-list', async () => {
    const filter = req.query?.status || 'open';
    if (filter !== 'open' && filter !== 'all' && !STATUSES.includes(filter as WarrantyStatus)) return fail(400, 'INVALID', 'Filter status tidak dikenal.');
    const now = deps.now();
    const snap = await deps.db.collection('warrantyClaims').orderBy('createdAt', 'desc').limit(LIST_READ).get();
    const matched = snap.docs
      .map(doc => doc.data() as ClaimDoc)
      .filter(d => (filter === 'all' ? true : filter === 'open' ? OPEN_STATUSES.includes(d.status) : d.status === filter));
    const items = matched.slice(0, LIST_ROWS).map(d => ({
      ticket: d.ticket,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
      customerName: d.customer?.name ?? '',
      productName: d.product?.name ?? '',
      channel: d.product?.channel ?? null,
      status: d.status,
      statusLabel: statusLabel(d.status),
      assignee: d.assignee,
      ageDays: ageDays(d.createdAt, now),
      videoViaWhatsApp: d.videoViaWhatsApp === true,
      outsidePeriod: d.outsidePeriod === true,
    }));
    // Housekeeping instead of a TTL policy: at most 50 expired rate-limit counters per list load (W3).
    await cleanupExpiredLimits(deps.db, now, deps.stamp).catch(() => deps.log('[erp-garansi-list] cleanup failed'));
    return json(200, { items, matched: matched.length, truncated: matched.length > LIST_ROWS || snap.docs.length === LIST_READ, fetchedAt: new Date(now).toISOString() });
  });
}

async function readDoc<T>(deps: Deps, collection: string, id: string): Promise<T | null> {
  const snap = await deps.db.collection(collection).doc(id).get();
  return snap.exists ? (snap.data() as T) : null;
}

// GET /api/erp/garansi/[ticket] (5.4).
export async function handleErpClaimGet(deps: ErpDeps, req: HandlerRequest, ticket: string): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-garansi-get', async staff => {
    if (!TICKET_RE.test(ticket)) return fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.');
    const d = await readDoc<ClaimDoc>(deps, 'warrantyClaims', ticket);
    if (!d) return fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.');
    return json(200, { claim: claimView(d, deps, staff.role) });
  });
}

function parsePatchBody(req: HandlerRequest): Record<string, unknown> {
  try {
    return parseBody(req);
  } catch (e) {
    if (e instanceof HttpError) {
      const b = e.res.body as { code: string };
      throw new HttpError(fail(e.res.status, b.code, e.res.status === 413 ? 'Isian terlalu panjang.' : 'Isian tidak bisa dibaca.'));
    }
    throw e;
  }
}

// PATCH /api/erp/garansi/[ticket] (6.2–6.6), in one transaction so the updatedAt check and the write cannot interleave.
export async function handleErpClaimPatch(deps: ErpDeps, req: HandlerRequest, ticket: string): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-garansi-patch', async staff => {
    if (!TICKET_RE.test(ticket)) return fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.');
    const body = parsePatchBody(req);
    const ref = deps.db.collection('warrantyClaims').doc(ticket);
    const now = deps.now();
    const result = await deps.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { res: fail(404, 'NOT_FOUND', 'Tiket tidak ditemukan.') };
      const current = snap.data() as ClaimDoc;
      const p = applyPatch(current, body, staff, now, deps.stamp);
      if (!p.ok) return { res: fail(p.status, p.code, p.error, p.fields ? { fields: p.fields } : {}) };
      tx.update(ref, p.update);
      return { doc: { ...current, ...p.update } as ClaimDoc };
    });
    if ('res' in result && result.res) return result.res;
    const doc = (result as { doc: ClaimDoc }).doc;
    deps.log('[erp-garansi-patch] saved', { ticket });
    return json(200, { claim: claimView(doc, deps, staff.role) });
  });
}

// GET /api/erp/masukan?status=all|<status> (10.6). Default: everything not archived.
export async function handleErpFeedbackList(deps: ErpDeps, req: HandlerRequest): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-masukan-list', async () => {
    const filter = req.query?.status || 'open';
    if (filter !== 'open' && filter !== 'all' && !FEEDBACK_STATUSES.includes(filter as FeedbackStatus)) return fail(400, 'INVALID', 'Filter status tidak dikenal.');
    const now = deps.now();
    const snap = await deps.db.collection('feedback').orderBy('createdAt', 'desc').limit(LIST_READ).get();
    const matched = snap.docs
      .map(doc => doc.data() as FeedbackDoc)
      .filter(d => (filter === 'all' ? true : filter === 'open' ? d.status !== 'archived' : d.status === filter));
    const items = matched.slice(0, LIST_ROWS).map(d => ({
      ref: d.ref,
      createdAt: toIso(d.createdAt),
      kind: d.kind,
      productName: d.product?.name ?? null,
      excerpt: [...(d.message || '')].slice(0, 80).join(''),
      name: d.contact?.name ?? null,
      hasWhatsapp: Boolean(d.contact?.whatsapp),
      status: d.status,
    }));
    return json(200, { items, matched: matched.length, truncated: matched.length > LIST_ROWS || snap.docs.length === LIST_READ, fetchedAt: new Date(now).toISOString() });
  });
}

// GET /api/erp/masukan/[ref].
export async function handleErpFeedbackGet(deps: ErpDeps, req: HandlerRequest, ref: string): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-masukan-get', async () => {
    if (!FEEDBACK_REF_RE.test(ref)) return fail(404, 'NOT_FOUND', 'Masukan tidak ditemukan.');
    const d = await readDoc<FeedbackDoc>(deps, 'feedback', ref);
    if (!d) return fail(404, 'NOT_FOUND', 'Masukan tidak ditemukan.');
    return json(200, { feedback: feedbackView(d) });
  });
}

// PATCH /api/erp/masukan/[ref].
export async function handleErpFeedbackPatch(deps: ErpDeps, req: HandlerRequest, id: string): Promise<HandlerResponse> {
  return erp(deps, req, 'erp-masukan-patch', async staff => {
    if (!FEEDBACK_REF_RE.test(id)) return fail(404, 'NOT_FOUND', 'Masukan tidak ditemukan.');
    const body = parsePatchBody(req);
    const ref = deps.db.collection('feedback').doc(id);
    const now = deps.now();
    const result = await deps.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { res: fail(404, 'NOT_FOUND', 'Masukan tidak ditemukan.') };
      const current = snap.data() as FeedbackDoc;
      const p = applyFeedbackPatch(current, body, staff, now, deps.stamp);
      if (!p.ok) return { res: fail(p.status, p.code, p.error, p.fields ? { fields: p.fields } : {}) };
      tx.update(ref, p.update);
      return { doc: { ...current, ...p.update } as FeedbackDoc };
    });
    if ('res' in result && result.res) return result.res;
    deps.log('[erp-masukan-patch] saved', { ref: id });
    return json(200, { feedback: feedbackView((result as { doc: FeedbackDoc }).doc) });
  });
}
