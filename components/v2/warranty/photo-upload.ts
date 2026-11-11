import imageCompression from 'browser-image-compression';
import type { WarrantyPhoto } from '@/types';
import { WARRANTY_COPY } from '@/lib/warranty/copy';

// F-031 2.3: compress in the browser (same library and settings as lib/cloudinary-upload.ts), then upload straight to
// the warranty Cloudinary account with a signature from POST /api/garansi/upload-signature. The unsigned product preset
// is never used here.

const E = WARRANTY_COPY.errors;

interface Signature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  publicId: string;
  allowedFormats: string;
  type: string;
  overwrite: boolean;
}

export class UploadError extends Error {}

async function getSignature(): Promise<Signature> {
  let res: Response;
  try {
    res = await fetch('/api/garansi/upload-signature', { method: 'POST' });
  } catch {
    throw new UploadError(E.network);
  }
  if (res.status === 429) throw new UploadError(E.rateLimited);
  if (res.status === 503) throw new UploadError(E.photoUnavailable);
  if (!res.ok) throw new UploadError(E.photoUpload);
  return res.json();
}

async function compress(file: File): Promise<Blob> {
  try {
    const out = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, initialQuality: 0.85 });
    return out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

/** Uploads one photo; `signal` aborts it when the customer removes the photo. Throws UploadError with a shown message. */
export async function uploadWarrantyPhoto(file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<WarrantyPhoto> {
  const [sig, blob] = await Promise.all([getSignature(), compress(file)]);
  if (signal.aborted) throw new UploadError('aborted');
  const form = new FormData();
  form.append('file', blob, file.name);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('public_id', sig.publicId);
  form.append('allowed_formats', sig.allowedFormats);
  form.append('type', sig.type);
  form.append('overwrite', String(sig.overwrite));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.addEventListener('abort', () => xhr.abort());
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => {
      if (xhr.status !== 200) return reject(new UploadError(E.photoUpload));
      try {
        const r = JSON.parse(xhr.responseText);
        resolve({ publicId: r.public_id, version: Number(r.version), width: Number(r.width), height: Number(r.height), format: r.format });
      } catch {
        reject(new UploadError(E.photoUpload));
      }
    };
    xhr.onerror = () => reject(new UploadError(E.network));
    xhr.onabort = () => reject(new UploadError('aborted'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(sig.cloudName)}/image/upload`);
    xhr.send(form);
  });
}
