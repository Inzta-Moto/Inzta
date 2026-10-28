import imageCompression from 'browser-image-compression';
import { CLOUDINARY_CLOUD } from '@/lib/constants';

// Browser-only upload to the website's Cloudinary cloud, shared by components/ImageUpload.tsx (products,
// legacy gallery) and the article editor. Same unsigned preset, limits, and compression as before F-012.

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

/** Throws an Error whose message can be shown to the admin as is. */
export async function uploadImage(file: File, onProgress?: (percent: number) => void): Promise<UploadedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Format harus gambar (JPG, PNG, WebP)');
  if (file.size > MAX_BYTES) throw new Error('Ukuran maksimal 5MB');

  let fileToUpload = file;
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.85,
    });
    if (compressed.size < file.size) fileToUpload = compressed;
  } catch (error) {
    console.error('Error compressing image:', error);
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('upload_preset', 'inztaa');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.onload = () => {
      if (xhr.status !== 200) return reject(new Error('Upload gagal. Coba lagi.'));
      try {
        const res = JSON.parse(xhr.responseText);
        resolve({ url: res.secure_url, width: Number(res.width) || 0, height: Number(res.height) || 0 });
      } catch {
        reject(new Error('Upload gagal. Coba lagi.'));
      }
    };
    xhr.onerror = () => reject(new Error('Jaringan error saat upload.'));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`);
    xhr.send(formData);
  });
}
