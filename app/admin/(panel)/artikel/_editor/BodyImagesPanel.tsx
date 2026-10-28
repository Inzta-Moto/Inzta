'use client';

import { DEFAULT_LAYOUT, type BodyImage } from '@/lib/article-format';
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

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// F-013 (5.7): "Kanan · Sedang" for a non-default layout; nothing for Tengah · Penuh.
function layoutLabel({ layout }: BodyImage): string {
  if (layout.posisi === DEFAULT_LAYOUT.posisi && layout.ukuran === DEFAULT_LAYOUT.ukuran) return '';
  return `${capitalise(layout.posisi)} · ${capitalise(layout.ukuran)}`;
}

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
            {layoutLabel(img) && <span className="article-images-layout" style={{ color: 'var(--text-tertiary)' }}>{layoutLabel(img)}</span>}
            {img.caption && <span className="article-images-caption">{img.caption}</span>}
            <div className="article-images-actions">
              <button type="button" className="btn btn-ghost" onClick={() => onEdit(img)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {img.kind === 'allowed' ? 'Edit' : 'Unggah'}
              </button>
              {/* F-013 phase B (B-8): line numbers mean nothing in the visual editor; this selects the image there. */}
              <button type="button" className="btn btn-ghost" onClick={() => onJump(img)} aria-label={`Lihat gambar ${img.index + 1} di editor`} style={{ fontSize: 11, padding: '4px 10px' }}>
                Lihat
              </button>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
