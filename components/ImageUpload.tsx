'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { ACCEPTED_IMAGE_TYPES, uploadImage } from '@/lib/cloudinary-upload';

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export default function ImageUpload({ value, onChange, max = 1 }: ImageUploadProps) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (value.length >= max) { alert(`Maksimal ${max} gambar`); return; }

    setUploading(true);
    setProgress(0);
    try {
      const { url } = await uploadImage(file, setProgress);
      onChange([...value, url]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Upload gagal. Coba lagi.');
    }
    setUploading(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  };

  const canAddMore = value.length < max && !uploading;

  return (
    <div className="upload-multi">
      {value.map((url, i) => (
        <div key={i} className="upload-multi-item">
          <img src={url} alt={`Gambar ${i + 1}`} />
          <button type="button" className="upload-multi-remove" onClick={() => handleRemove(i)}>&times;</button>
          <span className="upload-multi-num">{i + 1}</span>
        </div>
      ))}

      {canAddMore && (
        <div
          className="upload-area upload-area-sm"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            type="file" ref={fileInputRef} onChange={handleChange}
            accept={ACCEPTED_IMAGE_TYPES} style={{ display: 'none' }}
          />
          {uploading ? (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: `${progress}%` }}></div>
              <span className="upload-progress-text">{progress}%</span>
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
  );
}