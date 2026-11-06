'use client';

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, imageFileError, uploadImage } from '@/lib/cloudinary-upload';
import { focusAfterMove, imageKeys, moveItem, planUpload, uploadSummary } from '@/lib/product-images';

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  /** F-022: told true while a batch uploads and false when it ends (or the uploader unmounts), so a form can lock Save. */
  onBusyChange?: (busy: boolean) => void;
}

// Admin image list (products, variants, side presets, article images). F-022: several files per pick or drop
// (uploaded one after another, never past `max`), reorder by drag or by the arrow buttons, and an inline message
// instead of an alert. Photo 1 is the main photo when more than one is allowed. A batch stops writing to the parent
// once the uploader unmounts (form closed), so photos never land in another product's form (review REV-01).
export default function ImageUpload({ value, onChange, max = 1, onBusyChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [batch, setBatch] = useState<{ at: number; of: number } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOn, setDropOn] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The parent's state updates after a render; uploads in one batch append to the latest list, not a stale prop.
  const valueRef = useRef<string[]>(value);
  valueRef.current = value;
  const aliveRef = useRef<boolean>(true);
  const busyRef = useRef<boolean>(false);
  const busyCb = useRef(onBusyChange);
  busyCb.current = onBusyChange;
  const pendingFocus = useRef<{ index: number; dir: 'kiri' | 'kanan' } | null>(null);

  const multi = max > 1;

  const setBusy = (busy: boolean) => {
    if (busyRef.current === busy) return;
    busyRef.current = busy;
    busyCb.current?.(busy);
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      // A batch still running is abandoned; release the parent's lock.
      if (busyRef.current) {
        busyRef.current = false;
        busyCb.current?.(false);
      }
    };
  }, []);

  // REV-02: keep keyboard focus on the moved photo's arrow after an arrow-button move.
  useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    pendingFocus.current = null;
    wrapRef.current?.querySelector<HTMLButtonElement>(`button[aria-label="Geser gambar ${f.index + 1} ke ${f.dir}"]`)?.focus();
  });

  const handleFiles = async (picked: File[]) => {
    if (picked.length === 0) return;
    if (uploading || busyRef.current) {
      setMessage('Tunggu upload yang berjalan selesai dulu.');
      return;
    }
    // Files that can never upload (not an image, over 5 MB) are reported and do not take a free slot.
    const failed: { name: string; reason: string }[] = [];
    const valid = picked.filter((file, i) => {
      const reason = imageFileError(file);
      if (reason) failed.push({ name: file.name || `Foto ${i + 1}`, reason });
      return !reason;
    });
    const { accepted, skipped } = planUpload(valid, valueRef.current.length, max);
    setMessage('');
    if (accepted.length === 0) {
      const reasons = uploadSummary({ uploaded: 0, skipped: 0, failed, max });
      setMessage(skipped > 0 ? `Maksimal ${max} foto. Hapus foto lain dulu untuk menambah.${reasons ? ' ' + reasons : ''}` : reasons);
      return;
    }

    setBusy(true);
    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < accepted.length; i++) {
      if (!aliveRef.current) return;
      const file = accepted[i];
      setBatch({ at: i + 1, of: accepted.length });
      setProgress(0);
      try {
        const { url } = await uploadImage(file, p => { if (aliveRef.current) setProgress(p); });
        // The form was closed while this file uploaded: never write into whatever the parent shows now.
        if (!aliveRef.current) return;
        const next = [...valueRef.current, url].slice(0, max);
        valueRef.current = next;
        onChange(next);
        uploaded++;
      } catch (error) {
        failed.push({ name: file.name || `Foto ${i + 1}`, reason: error instanceof Error ? error.message : 'Upload gagal. Coba lagi.' });
      }
    }
    if (!aliveRef.current) return;
    setUploading(false);
    setBatch(null);
    setMessage(uploadSummary({ uploaded, skipped, failed, max }));
    setBusy(false);
  };

  // Files dropped anywhere on the list (add box, a thumbnail, or a gap) upload; the browser never opens them.
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const onWrapDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (isFileDrag(e)) e.preventDefault();
  };
  const onWrapDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setFileOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    void handleFiles(multi ? files : files.slice(0, 1));
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Reset so picking the same file again fires change.
    e.target.value = '';
    void handleFiles(files);
  };

  const handleRemove = (index: number) => {
    if (uploading) return;
    setMessage('');
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number, focusDir?: 'kiri' | 'kanan') => {
    if (uploading || to < 0 || to >= value.length) return;
    if (focusDir) pendingFocus.current = { index: to, dir: focusAfterMove(to, value.length, focusDir) };
    onChange(moveItem(value, from, to));
  };

  // Reorder by dragging a thumbnail onto another one.
  const onItemDragStart = (e: DragEvent<HTMLDivElement>, i: number) => {
    if (uploading) { e.preventDefault(); return; }
    setDragFrom(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const onItemDragOver = (e: DragEvent<HTMLDivElement>, i: number) => {
    if (dragFrom === null || isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropOn !== i) setDropOn(i);
  };
  const onItemDrop = (e: DragEvent<HTMLDivElement>, i: number) => {
    if (dragFrom === null || isFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    move(dragFrom, i);
    setDragFrom(null);
    setDropOn(null);
  };
  const onItemDragEnd = () => {
    setDragFrom(null);
    setDropOn(null);
  };

  const canAddMore = value.length < max && !uploading;
  // Only multi-photo lists block saving above the limit (variant photos keep legacy extras, F-022 D-2).
  const over = multi && value.length > max;
  const keys = imageKeys(value);

  return (
    <div className="upload-multi-wrap" ref={wrapRef} onDragOver={onWrapDragOver} onDrop={onWrapDrop}>
      <div className="upload-multi">
        {value.map((url, i) => (
          <div
            key={keys[i]}
            className={`upload-multi-item${multi ? ' upload-multi-item--sortable' : ''}${dragFrom === i ? ' is-dragging' : ''}${dropOn === i && dragFrom !== i ? ' is-drop-target' : ''}`}
            draggable={multi && !uploading}
            onDragStart={multi ? e => onItemDragStart(e, i) : undefined}
            onDragOver={multi ? e => onItemDragOver(e, i) : undefined}
            onDrop={multi ? e => onItemDrop(e, i) : undefined}
            onDragEnd={multi ? onItemDragEnd : undefined}
            data-index={i}
          >
            <img src={url} alt={`Gambar ${i + 1}`} draggable={false} />
            <button type="button" className="upload-multi-remove" onClick={() => handleRemove(i)} disabled={uploading} aria-label={`Hapus gambar ${i + 1}`}>&times;</button>
            <span className="upload-multi-num">{i + 1}</span>
            {multi && i === 0 && value.length > 1 && <span className="upload-multi-main">Utama</span>}
            {multi && value.length > 1 && (
              <div className="upload-multi-move">
                <button type="button" onClick={() => move(i, i - 1, 'kiri')} disabled={uploading || i === 0} aria-label={`Geser gambar ${i + 1} ke kiri`}>&lsaquo;</button>
                <button type="button" onClick={() => move(i, i + 1, 'kanan')} disabled={uploading || i === value.length - 1} aria-label={`Geser gambar ${i + 1} ke kanan`}>&rsaquo;</button>
              </div>
            )}
          </div>
        ))}

        {(canAddMore || uploading) && (
          <div
            className={`upload-area upload-area-sm${fileOver ? ' is-file-over' : ''}`}
            role="button"
            tabIndex={uploading ? -1 : 0}
            aria-label={multi ? `Tambah foto (${value.length} dari ${max})` : 'Tambah foto'}
            aria-disabled={uploading || undefined}
            onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            onKeyDown={e => { if (!uploading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { if (isFileDrag(e) && !fileOver) setFileOver(true); }}
            onDragLeave={() => setFileOver(false)}
          >
            <input
              type="file" ref={fileInputRef} onChange={handleChange}
              accept={ACCEPTED_IMAGE_TYPES} multiple={multi} style={{ display: 'none' }}
            />
            {uploading ? (
              <div className="upload-progress">
                <div className="upload-progress-bar" style={{ width: `${progress}%` }}></div>
                <span className="upload-progress-text">{batch && batch.of > 1 ? `${batch.at}/${batch.of} · ` : ''}{progress}%</span>
              </div>
            ) : (
              <div className="upload-placeholder">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>{value.length}/{max}</span>
                <span className="upload-hint">Klik atau drag</span>
              </div>
            )}
          </div>
        )}
      </div>
      {over && (
        <p className="upload-msg upload-msg--error" role="alert">Melebihi batas {max} foto. Hapus {value.length - max} foto sebelum menyimpan.</p>
      )}
      {message && <p className="upload-msg" role="status">{message}</p>}
    </div>
  );
}
