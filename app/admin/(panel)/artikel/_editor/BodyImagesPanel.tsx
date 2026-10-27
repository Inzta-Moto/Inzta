'use client';

import type { BodyImage } from '@/lib/article-format';
import { optimizeCloudinaryUrl } from '@/lib/utils';

interface BodyImagesPanelProps {
  images: BodyImage[];
  onEdit: (image: BodyImage) => void;
  onJump: (image: BodyImage) => void;
}

const STATUS: Record<BodyImage['kind'], string> = {
  allowed: '',
  placeholder: 'Belum diunggah',
  foreign: 'Bukan dari panel; unggah ulang',
};

// Every image in the body, including naskah placeholders (ADR-0013), so each can be uploaded once.
export default function BodyImagesPanel({ images, onEdit, onJump }: BodyImagesPanelProps) {
  if (images.length === 0) {
    return <p className="article-editor-help">Belum ada gambar di isi artikel. Pakai tombol Sisipkan gambar di toolbar.</p>;
  }
  return (
    <ol className="article-images">
      {images.map(img => (
        <li key={`${img.index}-${img.start}`} className={`article-images-item${img.kind === 'allowed' ? '' : ' is-pending'}`}>
          <div className="article-images-thumb">
            {img.kind === 'allowed' ? <img src={optimizeCloudinaryUrl(img.url, 120)} alt="" loading="lazy" /> : <span aria-hidden="true">?</span>}
          </div>
          <div className="article-images-body">
            {STATUS[img.kind] && <span className="article-images-status">{STATUS[img.kind]}: {img.fileName}</span>}
            <span className={img.alt ? 'article-images-alt' : 'article-images-alt is-missing'}>{img.alt || 'Alt kosong'}</span>
            {img.caption && <span className="article-images-caption">{img.caption}</span>}
            <div className="article-images-actions">
              <button type="button" className="btn btn-ghost" onClick={() => onEdit(img)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {img.kind === 'allowed' ? 'Edit' : 'Unggah'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onJump(img)} style={{ fontSize: 11, padding: '4px 10px' }}>
                Baris {img.line}
              </button>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
