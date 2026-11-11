import { createHash } from 'crypto';
import type { WarrantyPhoto } from '@/types';
import { MAX_PHOTO_BYTES, PHOTO_FORMATS } from '@/lib/warranty/rules';

// F-031 Cloudinary helpers (design.md §4), server only, Node crypto instead of the SDK (no new dependency). The secret
// never leaves the server: the browser gets one signature per photo, staff get signed URLs from the ERP API.

type Params = Record<string, string | number | boolean | null | undefined>;

/** Cloudinary's string to sign: parameters sorted by name, empty values dropped, joined as k=v with &. */
export function signatureString(params: Params): string {
  return Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
}

export function signParams(params: Params, secret: string): string {
  return createHash('sha1').update(signatureString(params) + secret).digest('hex');
}

/** 24 URL-safe characters from 18 random bytes; unguessable, so a public id cannot be enumerated (4.2). */
export function randomPublicId(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 24);
}

/**
 * Signed parameters of one upload (4.2). The folder is part of public_id instead of a `folder` parameter, because
 * accounts in dynamic folder mode do not prefix public_id with `folder`, and the claim route checks that prefix.
 * overwrite=false so a reused signature cannot replace a photo after the claim was verified.
 */
export function buildUploadParams(o: { folder: string; now: number; randomId: string }) {
  return {
    allowed_formats: PHOTO_FORMATS.join(','),
    overwrite: 'false',
    public_id: `${o.folder}${o.randomId}`,
    timestamp: Math.floor(o.now / 1000),
    // Signed incoming transformation: whatever a script uploads with a signature is stored at most 1920 px, like the
    // browser compression (review SEC-08).
    transformation: INCOMING_TRANSFORMATION,
    type: 'authenticated',
  };
}

export const INCOMING_TRANSFORMATION = 'c_limit,h_1920,w_1920';

export interface CloudinaryConfig {
  cloud: string;
  apiKey: string;
  secret: string;
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  allowedFormats: string;
  type: 'authenticated';
  overwrite: false;
  transformation: string;
  maxBytes: number;
}

/** Response of POST /api/garansi/upload-signature (4.1); the browser posts these fields with the file. */
export function uploadSignature(cfg: CloudinaryConfig, o: { folder: string; now: number; randomId: string }): UploadSignature {
  const params = buildUploadParams(o);
  return {
    cloudName: cfg.cloud,
    apiKey: cfg.apiKey,
    timestamp: params.timestamp,
    signature: signParams(params, cfg.secret),
    folder: o.folder,
    publicId: params.public_id,
    allowedFormats: params.allowed_formats,
    type: 'authenticated',
    overwrite: false,
    transformation: params.transformation,
    maxBytes: MAX_PHOTO_BYTES,
  };
}

/**
 * Signed delivery URL of an authenticated image (design.md §4). The signature covers the transformation and the
 * public id with format; on plans without token authentication it does not expire, so it is sent to staff only.
 */
export function signedDeliveryUrl(o: { cloud: string; secret: string; photo: WarrantyPhoto; transformation: string }): string {
  const source = `${o.photo.publicId}.${o.photo.format}`;
  const toSign = [o.transformation, source].filter(Boolean).join('/');
  const sig = createHash('sha1').update(toSign + o.secret).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
  return `https://res.cloudinary.com/${o.cloud}/image/authenticated/s--${sig}--/${o.transformation}/v${o.photo.version}/${source}`;
}

/** Original file through the API download endpoint with an expiry, so a copied full-size link stops working. */
export function privateDownloadUrl(o: { cloud: string; apiKey: string; secret: string; photo: WarrantyPhoto; now: number; ttlSeconds: number }): string {
  const timestamp = Math.floor(o.now / 1000);
  const params = { public_id: o.photo.publicId, format: o.photo.format, type: 'authenticated', timestamp, expires_at: timestamp + o.ttlSeconds };
  const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: o.apiKey, signature: signParams(params, o.secret) });
  return `https://api.cloudinary.com/v1_1/${o.cloud}/image/download?${q.toString()}`;
}

export interface StaffPhotoUrls {
  thumbUrl: string;
  viewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  format: WarrantyPhoto['format'];
}

/** URLs for the ERP detail view: 400 px thumbnail, 1600 px view, original download that expires after an hour. */
export function staffPhotoUrls(cfg: CloudinaryConfig, photo: WarrantyPhoto, now: number): StaffPhotoUrls {
  return {
    thumbUrl: signedDeliveryUrl({ cloud: cfg.cloud, secret: cfg.secret, photo, transformation: 'c_limit,w_400' }),
    viewUrl: signedDeliveryUrl({ cloud: cfg.cloud, secret: cfg.secret, photo, transformation: 'c_limit,w_1600' }),
    downloadUrl: privateDownloadUrl({ cloud: cfg.cloud, apiKey: cfg.apiKey, secret: cfg.secret, photo, now, ttlSeconds: 3600 }),
    width: photo.width,
    height: photo.height,
    format: photo.format,
  };
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export class CloudinaryUnavailable extends Error {}

/**
 * Checks one uploaded photo with the Admin API before the claim is stored (3.2): it must exist as an authenticated
 * image under that exact public id, in an allowed format and size. Returns the stored values from Cloudinary (never the
 * client's), or null when the photo is not there or not acceptable. Throws CloudinaryUnavailable when Cloudinary itself
 * fails (rate limit 420/429, 5xx, network), so an outage is not reported as a bad photo (review SEC-07).
 */
export async function verifyUploadedPhoto(cfg: CloudinaryConfig, publicId: string, fetchImpl: FetchLike): Promise<WarrantyPhoto | null> {
  const url = `https://api.cloudinary.com/v1_1/${cfg.cloud}/resources/image/authenticated/${publicId.split('/').map(encodeURIComponent).join('/')}`;
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.secret}`).toString('base64');
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Basic ${auth}` } });
  } catch {
    throw new CloudinaryUnavailable('network');
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    if (res.status === 420 || res.status === 429 || res.status >= 500) throw new CloudinaryUnavailable(String(res.status));
    return null;
  }
  const r = await res.json();
  if (!r || r.public_id !== publicId || r.type !== 'authenticated' || r.resource_type !== 'image') return null;
  if (!(PHOTO_FORMATS as readonly string[]).includes(r.format)) return null;
  if (typeof r.bytes !== 'number' || r.bytes > MAX_PHOTO_BYTES) return null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
  const version = n(r.version);
  const width = n(r.width);
  const height = n(r.height);
  if (!version || !width || !height) return null;
  return { publicId, version, width, height, format: r.format };
}
