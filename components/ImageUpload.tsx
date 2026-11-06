'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, imageFileError, uploadImage } from '@/lib/cloudinary-upload';
import { moveItem, planUpload, uploadSummary } from '@/lib/product-images';

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

// Admin image list (products, variants, side presets, article images). F-022: several files per pick or drop
// (uploaded one after another, never past `max`), reorder by drag or by the arrow buttons, and an inline message
// instead of an alert. Photo 1 is the main photo when more than one is allowed.
export default function ImageUpload({ value, onChange, max = 1 }: ImageUploadProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [batch, setBatch] = useState<{ at: number; of: number } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOn, setDropOn] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The parent's state updates after a render; uploads in one batch append to the latest list, not a stale prop.
  const valueRef = useRef<string[]>(value);
  valueRef.current = value;

  const multi = max > 1;

  const handleFiles = async (picked: File[]) => {
    if (uploading || picked.length === 0) return;
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

    setUploading(true);
    let uploaded = 0;
    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];
      setBatch({ at: i + 1, of: accepted.length });
      setProgress(0);
      try {
        const { url } = await uploadImage(file, setProgress);
        const next = [...valueRef.current, url].slice(0, max);
        valueRef.current = next;
        onChange(next);
        uploaded++;
      } catch (error) {
        failed.push({ name: file.name || `Foto ${i + 1}`, reason: error instanceof Error ? error.message : 'Upload gagal. Coba lagi.' });
      }
    }
    setUploading(false);
    setBatch(null);
    setMessage(uploadSummary({ uploaded, skipped, failed, max }));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
    setMessage('');
    onChange(value.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    if (uploading) return;
    onChange(moveItem(value, from, to));
  };

  // Reorder by dragging a thumbnail onto another one. Files dragged from the computer go to the add box instead.
  const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
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
    move(dragFrom, i);
    setDragFrom(null);
    setDropOn(null);
  };
  const onItemDragEnd = () => {
    setDragFrom(null);
    setDropOn(null);
  };

  const canAddMore = value.length < max && !uploading;
  const over = value.length > max;

  return (
    <div className="upload-multi-wrap">
      <div className="upload-multi">
        {value.map((url, i) => (
          <div
            key={`${i}-${url}`}
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
                <button type="button" onClick={() => move(i, i - 1)} disabled={uploading || i === 0} aria-label={`Geser gambar ${i + 1} ke kiri`}>&lsaquo;</button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={uploading || i === value.length - 1} aria-label={`Geser gambar ${i + 1} ke kanan`}>&rsaquo;</button>
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
            onDragOver={(e) => { e.preventDefault(); if (isFileDrag(e) && !fileOver) setFileOver(true); }}
            onDragLeave={() => setFileOver(false)}
            onDrop={handleDrop}
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
