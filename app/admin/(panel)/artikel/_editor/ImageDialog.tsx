'use client';

import { ChangeEvent, FormEvent, RefObject, useRef, useState } from 'react';
import { ACCEPTED_IMAGE_TYPES, uploadImage } from '@/lib/cloudinary-upload';
import { isAllowedImageUrl } from '@/lib/article-format';
import Dialog from './Dialog';

export interface ImageDialogValue {
  url: string;
  alt: string;
  caption: string;
  width?: number;
  asCover: boolean;
}

interface ImageDialogProps {
  title: string;
  // 'body' inserts or edits an image in the article; 'cover' sets the cover (no caption).
  kind: 'body' | 'cover';
  initial?: { url?: string; alt?: string; caption?: string; fileName?: string };
  returnFocusRef?: RefObject<HTMLElement>;
  onClose: () => void;
  onConfirm: (value: ImageDialogValue) => void;
}

// Follows the mockup's "Pengaturan gambar" panel without size, float, and link options (design.md).
export default function ImageDialog({ title, kind, initial, returnFocusRef, onClose, onConfirm }: ImageDialogProps) {
  const startUrl = initial?.url && isAllowedImageUrl(initial.url) ? initial.url : '';
  const [url, setUrl] = useState(startUrl);
  const [alt, setAlt] = useState(initial?.alt || '');
  const [caption, setCaption] = useState(initial?.caption || '');
  const [asCover, setAsCover] = useState(false);
  const [info, setInfo] = useState<{ name: string; size: number; width: number; height: number } | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploading = progress !== null;
  const pendingFile = initial?.fileName && !startUrl ? initial.fileName : '';

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const uploaded = await uploadImage(file, setProgress);
      setUrl(uploaded.url);
      setInfo({ name: file.name, size: file.size, width: uploaded.width, height: uploaded.height });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload gagal. Coba lagi.');
    } finally {
      setProgress(null);
    }
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (uploading) return;
    if (!url) return setError('Unggah gambar dulu.');
    if (!alt.trim()) return setError('Teks alt wajib diisi.');
    onConfirm({ url, alt: alt.trim(), caption: kind === 'body' ? caption.trim() : '', width: info?.width, asCover });
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
          <button type="submit" form="image-dialog-form" className="btn btn-primary" disabled={uploading || !url || !alt.trim()} style={{ fontSize: 11, padding: '8px 16px' }}>
            Simpan gambar
          </button>
        </>
      }
    >
      <form id="image-dialog-form" onSubmit={submit} className="article-editor-stack">
        <div className="article-image-preview">
          {url ? <img src={url} alt="" /> : <span>{pendingFile ? `Belum diunggah: ${pendingFile}` : 'Belum ada gambar'}</span>}
        </div>
        {pendingFile && (
          <p className="article-editor-help">Pilih file <strong>{pendingFile}</strong> dari folder naskah (<code>content/images/</code>). Alt dan caption dari naskah tetap dipakai.</p>
        )}
        {info && (
          <p className="article-editor-help">
            {info.name} · {(info.size / 1024).toFixed(0)} KB · {info.width}×{info.height} px
          </p>
        )}
        <div>
          <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} onChange={onFile} hidden />
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 11, padding: '8px 16px' }} data-autofocus={url ? undefined : true}>
            {uploading ? `Mengunggah ${progress}%` : url ? 'Ganti gambar' : 'Pilih gambar'}
          </button>
          <p className="article-editor-help">JPG, PNG, atau WebP, maksimal 5 MB. Gambar dikompres otomatis.</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="image-alt">Teks alt *</label>
          <input id="image-alt" className="form-input" value={alt} onChange={e => setAlt(e.target.value)} maxLength={200} required data-autofocus={url ? true : undefined} />
          <p className="article-editor-help">Jelaskan isi gambar untuk mesin pencari dan pembaca layar; jangan menumpuk kata kunci.</p>
        </div>
        {kind === 'body' && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="image-caption">Caption (opsional)</label>
              <input id="image-caption" className="form-input" value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} />
              <p className="article-editor-help">Tampil di bawah gambar.</p>
            </div>
            <label className="article-editor-check">
              <input type="checkbox" checked={asCover} onChange={e => setAsCover(e.target.checked)} /> Jadikan juga gambar sampul
            </label>
          </>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
      </form>
    </Dialog>
  );
}
