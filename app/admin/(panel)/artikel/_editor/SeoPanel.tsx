'use client';

import { META_DESCRIPTION_GUIDE, META_TITLE_GUIDE } from '@/lib/article-checklist';

interface SeoPanelProps {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  onChange: (field: 'metaTitle' | 'metaDescription', value: string) => void;
}

function Counter({ length, guide }: { length: number; guide: number }) {
  return (
    <span className={`article-counter${length > guide ? ' is-over' : ''}`}>
      {length}/{guide}
    </span>
  );
}

// 60/155 are a team guideline shown as a warning, not a limit (ADR-0014).
export default function SeoPanel({ title, slug, excerpt, metaTitle, metaDescription, onChange }: SeoPanelProps) {
  const shownTitle = metaTitle.trim() || title.trim() || 'Judul artikel';
  const shownDescription = metaDescription.trim() || excerpt.trim() || 'Ringkasan artikel akan tampil di sini.';
  return (
    <div className="article-editor-stack">
      <div className="form-group">
        <div className="article-label-row">
          <label className="form-label" htmlFor="seo-title">Judul SEO</label>
          <Counter length={metaTitle.trim().length} guide={META_TITLE_GUIDE} />
        </div>
        <input id="seo-title" className="form-input" value={metaTitle} maxLength={200} onChange={e => onChange('metaTitle', e.target.value)} placeholder={title} />
        <p className="article-editor-help">Kosong: judul artikel dipakai, dengan akhiran &quot; | INZTA Moto&quot;. Diisi: dipakai apa adanya, tanpa akhiran.</p>
      </div>
      <div className="form-group">
        <div className="article-label-row">
          <label className="form-label" htmlFor="seo-description">Deskripsi SEO</label>
          <Counter length={metaDescription.trim().length} guide={META_DESCRIPTION_GUIDE} />
        </div>
        <textarea id="seo-description" className="form-input" rows={3} value={metaDescription} maxLength={500} onChange={e => onChange('metaDescription', e.target.value)} />
        <p className="article-editor-help">Kosong: ringkasan (excerpt) dipakai.</p>
      </div>
      <div className="article-snippet" aria-label="Perkiraan tampilan di Google">
        <span className="article-snippet-url">inzta.id › blog › {slug || 'slug-artikel'}</span>
        <span className="article-snippet-title">{shownTitle}</span>
        <span className="article-snippet-desc">{shownDescription}</span>
      </div>
      <p className="article-editor-help">Perkiraan saja: Google memotong judul dan deskripsi berdasarkan lebar piksel, dan kadang menulis deskripsinya sendiri.</p>
    </div>
  );
}
