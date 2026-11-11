import type {
  FeedbackInput,
  FeedbackKind,
  FeedbackStatus,
  WarrantyChannel,
  WarrantyClaimInput,
  WarrantyDamage,
  WarrantyPhoto,
  WarrantyRejectReason,
  WarrantyResolution,
  WarrantyStaffRole,
  WarrantyStatus,
  WarrantyUsage,
} from '@/types';
import { WARRANTY_COPY } from '@/lib/warranty/copy';

// F-031 pure rules (design.md §7): no Next, no Firebase, no Node crypto, so the public forms, the API routes, and
// tests/f031-warranty.cjs share one implementation.

const E = WARRANTY_COPY.errors;

export const WARRANTY_MONTHS = 6;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_BODY_BYTES = 32 * 1024;
export const MIN_FILL_MS = 5000;
// A form left open longer than this must be reloaded, so an old token cannot be replayed forever.
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
export const ACCEPTED_PHOTO_MIME = 'image/jpeg,image/png,image/webp';
export const PHOTO_FORMATS = ['jpg', 'png', 'webp'] as const;
const EARLIEST_PURCHASE = '2020-01-01';
// Wall clock of the buyers (WIB); used for "today" and for the per-day rate-limit buckets.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const CHANNELS: readonly WarrantyChannel[] = ['website', 'shopee', 'tokopedia', 'toko-partner', 'lainnya'];
export const USAGES: readonly WarrantyUsage[] = ['lt1', '1-3', '3-6', '6-12', 'gt12'];
export const DAMAGES: readonly WarrantyDamage[] = ['resleting', 'jahitan', 'tali-buckle', 'kunci-pengait', 'bocor', 'bahan-robek', 'lainnya'];
export const STATUSES: readonly WarrantyStatus[] = ['new', 'under_review', 'in_progress', 'waiting_customer', 'resolved', 'rejected'];
export const OPEN_STATUSES: readonly WarrantyStatus[] = ['new', 'under_review', 'in_progress', 'waiting_customer'];
export const RESOLUTIONS: readonly WarrantyResolution[] = ['diperbaiki', 'diganti', 'kirim-part', 'refund', 'saran', 'lainnya'];
export const REJECT_REASONS: readonly WarrantyRejectReason[] = ['lewat-masa', 'pemakaian', 'bukan-produk-inzta', 'data-tidak-cocok', 'lainnya'];
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['pengalaman', 'kritik', 'saran'];
export const FEEDBACK_STATUSES: readonly FeedbackStatus[] = ['new', 'read', 'followed_up', 'archived'];
export const PRODUCT_OTHER = 'lainnya';

// Keys accepted by the public routes; anything else is a 400 (requirement 3.1). `trap` is the honeypot (3.3).
export const CLAIM_KEYS = [
  'name', 'whatsapp', 'location', 'product', 'productOther', 'channel', 'purchaseDate', 'orderRef', 'usage', 'damage',
  'description', 'photos', 'videoViaWhatsApp', 'consent', 'formToken', 'trap',
] as const;
export const FEEDBACK_KEYS = ['kind', 'message', 'product', 'productOther', 'name', 'whatsapp', 'consent', 'formToken', 'trap'] as const;
export const CLAIM_PATCH_KEYS = ['expectedUpdatedAt', 'status', 'assignee', 'publicNote', 'internalNote', 'resolution', 'rejectReason'] as const;
export const FEEDBACK_PATCH_KEYS = ['expectedUpdatedAt', 'status', 'internalNote'] as const;

export const NOTE_LIMITS = { publicNote: 1000, internalNote: 2000 } as const;

export type FieldErrors = Record<string, string>;
export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function unknownKeys(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body).filter(k => !allowed.includes(k));
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// C0 and C1 controls plus the bidi overrides, which could reorder text in the ERP view (requirement 5.6a).
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

/** One line of text: control characters removed, line breaks and runs of spaces become one space, trimmed. */
export function cleanLine(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.replace(/[\r\n\t]+/g, ' ').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
}

/** Multi-line text: control characters removed except line breaks, at most two blank lines in a row, trimmed. */
export function cleanText(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(CONTROL, '')
    .replace(/[  ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const charLength = (s: string) => [...s].length;
const within = (s: string, min: number, max: number) => charLength(s) >= min && charLength(s) <= max;

/** Indonesian mobile number as 628… (10–15 digits), or null. Accepts 08…, 628…, +628…, spaces, dashes, dots. */
export function normalizeWhatsapp(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('0')) s = '62' + s.slice(1);
  return /^628\d{7,12}$/.test(s) ? s : null;
}

/** "YYYY-MM-DD" of the given instant on the WIB wall clock. */
export function wibDate(ms: number): string {
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** True when the purchase date lies more than `months` before the submission day (WIB); a hint for staff only (3.5a). */
export function isOutsidePeriod(purchaseDate: string | null, createdAtMs: number, months = WARRANTY_MONTHS): boolean {
  if (!purchaseDate || !isRealDate(purchaseDate)) return false;
  return wibDate(createdAtMs) > addMonths(purchaseDate, months);
}

export function isHeic(file: { type?: string; name?: string }): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
}

/** JPG, PNG, or WebP by MIME type and not a HEIC/HEIF name (requirement 2.3a). */
export function isAcceptedPhotoType(mime: string, fileName: string): boolean {
  if (isHeic({ type: mime, name: fileName })) return false;
  return ['image/jpeg', 'image/png', 'image/webp'].includes((mime || '').toLowerCase());
}

/** Message for a picked file that must not be uploaded, or null. HEIC gets its own message (2.3a). */
export function photoFileError(file: { type: string; name: string; size: number }): string | null {
  if (isHeic(file)) return E.photoHeic;
  if (!isAcceptedPhotoType(file.type, file.name)) return E.photoType;
  if (file.size > MAX_PHOTO_BYTES) return E.photoSize;
  return null;
}

const PUBLIC_ID_TAIL = /^[A-Za-z0-9_-]{20,64}$/;

/** A photo reference as the client sends it; `folder` (e.g. "garansi-staging/") is checked on the server only. */
export function parsePhoto(v: unknown, folder?: string): WarrantyPhoto | null {
  if (!isPlainObject(v)) return null;
  const { publicId, version, width, height, format } = v;
  if (typeof publicId !== 'string') return null;
  if (folder !== undefined) {
    if (!publicId.startsWith(folder) || !PUBLIC_ID_TAIL.test(publicId.slice(folder.length))) return null;
  } else if (!/^[a-z0-9-]+\/[A-Za-z0-9_-]{20,64}$/.test(publicId)) return null;
  const posInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;
  if (!posInt(version) || !posInt(width) || !posInt(height)) return null;
  if (typeof format !== 'string' || !(PHOTO_FORMATS as readonly string[]).includes(format)) return null;
  return { publicId, version: version as number, width: width as number, height: height as number, format: format as WarrantyPhoto['format'] };
}

export interface ClaimContext {
  now: number;
  // Active products the submitted slug may name: slug → display name (the route reads only the submitted slug).
  productNames: Record<string, string>;
  folder?: string;
}

/** Server and client check of the claim form (requirement 2.2). The value carries cleaned text and the 628… number. */
export function validateClaimInput(body: Record<string, unknown>, ctx: ClaimContext): Validation<WarrantyClaimInput> {
  const errors: FieldErrors = {};

  const name = cleanLine(body.name);
  if (!name) errors.name = E.nameRequired;
  else if (!within(name, 2, 80)) errors.name = E.nameLength;

  const rawWa = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  const whatsapp = normalizeWhatsapp(rawWa);
  if (!rawWa) errors.whatsapp = E.whatsappRequired;
  else if (!whatsapp) errors.whatsapp = E.whatsappInvalid;

  const location = cleanLine(body.location);
  if (!location) errors.location = E.locationRequired;
  else if (!within(location, 2, 80)) errors.location = E.locationLength;

  let productSlug: string | null = null;
  let productName = '';
  const product = typeof body.product === 'string' ? body.product.trim() : '';
  if (!product) errors.product = E.productRequired;
  else if (product === PRODUCT_OTHER) {
    productName = cleanLine(body.productOther);
    if (!within(productName, 2, 80)) errors.productOther = E.productOtherLength;
  } else if (Object.prototype.hasOwnProperty.call(ctx.productNames, product)) {
    productSlug = product;
    productName = ctx.productNames[product];
  } else errors.product = E.productUnknown;

  const channel = body.channel as WarrantyChannel;
  if (!CHANNELS.includes(channel)) errors.channel = E.channelRequired;

  let purchaseDate: string | null = null;
  if (body.purchaseDate !== undefined && body.purchaseDate !== null && body.purchaseDate !== '') {
    const d = typeof body.purchaseDate === 'string' ? body.purchaseDate : '';
    if (!isRealDate(d)) errors.purchaseDate = E.purchaseDateInvalid;
    else if (d > wibDate(ctx.now)) errors.purchaseDate = E.purchaseDateFuture;
    else if (d < EARLIEST_PURCHASE) errors.purchaseDate = E.purchaseDateTooOld;
    else purchaseDate = d;
  }

  let orderRef: string | null = null;
  const rawRef = typeof body.orderRef === 'string' ? body.orderRef.trim() : body.orderRef;
  if (rawRef !== undefined && rawRef !== null && rawRef !== '') {
    if (typeof rawRef !== 'string' || !/^[A-Za-z0-9_\-/]{3,40}$/.test(rawRef)) errors.orderRef = E.orderRefInvalid;
    else orderRef = rawRef;
  }

  const usage = body.usage as WarrantyUsage;
  if (!USAGES.includes(usage)) errors.usage = E.usageRequired;

  let damage: WarrantyDamage[] = [];
  if (body.damage !== undefined) {
    if (!Array.isArray(body.damage) || body.damage.some(d => !DAMAGES.includes(d as WarrantyDamage))) errors.damage = E.damageInvalid;
    else damage = DAMAGES.filter(d => (body.damage as unknown[]).includes(d));
  }

  const description = cleanText(body.description);
  if (!description) errors.description = E.descriptionRequired;
  else if (!within(description, 20, 2000)) errors.description = E.descriptionLength;

  const photos: WarrantyPhoto[] = [];
  if (!Array.isArray(body.photos) || body.photos.length === 0) errors.photos = E.photosRequired;
  else if (body.photos.length > MAX_PHOTOS) errors.photos = E.photosTooMany;
  else {
    for (const p of body.photos) {
      const parsed = parsePhoto(p, ctx.folder);
      if (!parsed || photos.some(x => x.publicId === parsed.publicId)) {
        errors.photos = E.photosInvalid;
        break;
      }
      photos.push(parsed);
    }
  }

  if (body.videoViaWhatsApp !== undefined && typeof body.videoViaWhatsApp !== 'boolean') errors.videoViaWhatsApp = E.badRequest;
  if (body.consent !== true) errors.consent = E.consentRequired;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      whatsapp: whatsapp as string,
      location,
      productSlug,
      productName,
      channel,
      purchaseDate,
      orderRef,
      usage,
      damage,
      description,
      photos,
      videoViaWhatsApp: body.videoViaWhatsApp === true,
    },
  };
}

/** Server and client check of the feedback form (requirement 10.2). */
export function validateFeedbackInput(body: Record<string, unknown>, ctx: { productNames: Record<string, string> }): Validation<FeedbackInput> {
  const errors: FieldErrors = {};

  const kind = body.kind as FeedbackKind;
  if (!FEEDBACK_KINDS.includes(kind)) errors.kind = E.kindRequired;

  const message = cleanText(body.message);
  if (!message) errors.message = E.messageRequired;
  else if (!within(message, 20, 1000)) errors.message = E.messageLength;

  let productSlug: string | null = null;
  let productName: string | null = null;
  const product = typeof body.product === 'string' ? body.product.trim() : '';
  if (product === PRODUCT_OTHER) {
    productName = cleanLine(body.productOther);
    if (!within(productName, 2, 80)) errors.productOther = E.productOtherLength;
  } else if (product) {
    if (Object.prototype.hasOwnProperty.call(ctx.productNames, product)) {
      productSlug = product;
      productName = ctx.productNames[product];
    } else errors.product = E.productUnknown;
  }

  let name: string | null = cleanLine(body.name) || null;
  if (name && !within(name, 2, 80)) errors.name = E.feedbackNameLength;

  let whatsapp: string | null = null;
  const rawWa = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : '';
  if (rawWa) {
    whatsapp = normalizeWhatsapp(rawWa);
    if (!whatsapp) errors.whatsapp = E.feedbackWhatsappInvalid;
  }

  if (body.consent !== true) errors.consent = E.consentRequired;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { kind, message, productSlug, productName, name, whatsapp } };
}

// Status flow of requirement 6.2; the PATCH route is the authority, the ERP copies it for display only.
export const TRANSITIONS: Record<WarrantyStatus, readonly WarrantyStatus[]> = {
  new: ['under_review', 'rejected'],
  under_review: ['in_progress', 'waiting_customer', 'resolved', 'rejected'],
  in_progress: ['waiting_customer', 'resolved'],
  waiting_customer: ['under_review', 'in_progress', 'rejected'],
  resolved: ['under_review'],
  rejected: ['under_review'],
};

export const isClosed = (s: WarrantyStatus) => s === 'resolved' || s === 'rejected';

export function canTransition(from: WarrantyStatus, to: WarrantyStatus, role: WarrantyStaffRole): boolean {
  if (!TRANSITIONS[from]?.includes(to)) return false;
  // Reopening a closed ticket is for admins only (6.2).
  if (isClosed(from) && role !== 'admin') return false;
  return true;
}

export function allowedNext(from: WarrantyStatus, role: WarrantyStaffRole): WarrantyStatus[] {
  return (TRANSITIONS[from] ?? []).filter(to => canTransition(from, to, role));
}

export type RequiredField = 'publicNote' | 'rejectReason' | 'resolution' | 'note';

/** Fields a move to `to` must carry in the same request (6.2, 6.3). 'note' = a public or internal note. */
export function requiredFieldsFor(to: WarrantyStatus, from?: WarrantyStatus): RequiredField[] {
  if (to === 'waiting_customer') return ['publicNote'];
  if (to === 'rejected') return ['rejectReason', 'publicNote'];
  if (to === 'resolved') return ['resolution', 'publicNote'];
  if (to === 'under_review' && from && isClosed(from)) return ['note'];
  return [];
}

/** Any forward move, plus archived → read (requirement 10.6). */
export function canTransitionFeedback(from: FeedbackStatus, to: FeedbackStatus): boolean {
  const a = FEEDBACK_STATUSES.indexOf(from);
  const b = FEEDBACK_STATUSES.indexOf(to);
  if (a < 0 || b < 0) return false;
  return b > a || (from === 'archived' && to === 'read');
}

export function allowedNextFeedback(from: FeedbackStatus): FeedbackStatus[] {
  return FEEDBACK_STATUSES.filter(to => canTransitionFeedback(from, to));
}

/** `uid:role` pairs, comma separated (WARRANTY_ERP_STAFF); malformed entries are ignored. */
export function parseStaffList(env: string | undefined): Map<string, WarrantyStaffRole> {
  const out = new Map<string, WarrantyStaffRole>();
  for (const part of (env || '').split(',')) {
    const [uid, role, extra] = part.split(':').map(s => s.trim());
    if (!uid || extra !== undefined || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) continue;
    if (role === 'admin' || role === 'produksi') out.set(uid, role);
  }
  return out;
}

/** Exact match against WARRANTY_ERP_ORIGINS (comma separated; a trailing slash on an entry is ignored). */
export function isAllowedOrigin(origin: string | null | undefined, env: string | undefined): boolean {
  if (!origin) return false;
  return (env || '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .includes(origin);
}

// 32 characters without 0, O, 1, I; 256 is a multiple of 32, so `byte % 32` has no bias.
export const TICKET_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** `GRN-XXXXXX` (or `MSK-XXXXXX`) from 6 random bytes. */
export function generateTicket(bytes: Uint8Array, prefix: 'GRN' | 'MSK' = 'GRN'): string {
  if (bytes.length < 6) throw new Error('generateTicket needs 6 random bytes');
  let id = '';
  for (let i = 0; i < 6; i++) id += TICKET_ALPHABET[bytes[i] % 32];
  return `${prefix}-${id}`;
}

export const TICKET_RE = /^GRN-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const FEEDBACK_REF_RE = /^MSK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

const STAFF_LABELS: Record<WarrantyStatus, string> = {
  new: 'New Ticket',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  waiting_customer: 'Waiting Customer',
  resolved: 'Resolved',
  rejected: 'Rejected',
};
const CUSTOMER_LABELS: Record<WarrantyStatus, string> = {
  new: 'Diterima',
  under_review: 'Sedang diperiksa',
  in_progress: 'Sedang ditangani',
  waiting_customer: 'Menunggu data dari Anda',
  resolved: 'Selesai',
  rejected: 'Tidak dapat diproses sebagai garansi',
};

/** English labels from the request for staff, Indonesian ones for the customer (release 2 status check). */
export function statusLabel(status: WarrantyStatus, audience: 'staff' | 'customer' = 'staff'): string {
  return (audience === 'staff' ? STAFF_LABELS : CUSTOMER_LABELS)[status] ?? status;
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'Baru',
  read: 'Dibaca',
  followed_up: 'Ditindaklanjuti',
  archived: 'Diarsipkan',
};

// Drafts from design.md §9; final text goes through G2. Nothing is sent automatically (A-017).
const TEMPLATES: Partial<Record<WarrantyStatus, (v: { ticket: string; name: string; note: string }) => string>> = {
  under_review: v => `Halo ${v.name}, klaim garansi ${v.ticket} sudah kami terima dan sedang diperiksa. Kami kabari lagi setelah pengecekan.`,
  waiting_customer: v => `Halo ${v.name}, untuk klaim ${v.ticket} kami butuh: ${v.note}. Bisa dibalas di chat ini. Terima kasih.`,
  in_progress: v => `Halo ${v.name}, klaim ${v.ticket} sedang ditangani tim produksi INZTA.${v.note ? ` ${v.note}` : ''}`,
  resolved: v => `Halo ${v.name}, klaim ${v.ticket} sudah selesai: ${v.note}. Terima kasih sudah memakai INZTA.`,
  rejected: v => `Halo ${v.name}, mohon maaf, klaim ${v.ticket} belum bisa kami proses sebagai garansi: ${v.note}. Bila ada pertanyaan, balas chat ini.`,
};

/** Prefilled WhatsApp text for a status, or null when the status has no template. */
export function whatsappTemplate(status: WarrantyStatus, v: { ticket: string; name: string; publicNote?: string | null }): string | null {
  const t = TEMPLATES[status];
  if (!t) return null;
  const note = cleanLine(v.publicNote ?? '').replace(/[.\s]+$/, '');
  return t({ ticket: v.ticket, name: cleanLine(v.name), note });
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Hour and day buckets (WIB) used in rate-limit keys: yyyymmddhh and yyyymmdd. */
export function rateBuckets(now: number): { hour: string; day: string } {
  const iso = new Date(now + WIB_OFFSET_MS).toISOString();
  const day = iso.slice(0, 10).replace(/-/g, '');
  return { hour: day + iso.slice(11, 13), day };
}
