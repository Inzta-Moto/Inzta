'use client';

import { useState } from 'react';
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered } from 'lucide-react';

export type ToolbarAction = 'h2' | 'h3' | 'bold' | 'italic' | 'ul' | 'ol' | 'link' | 'image';

const BUTTONS: { action: ToolbarAction; label: string; tip: string; icon: JSX.Element }[] = [
  { action: 'h2', label: 'Subjudul H2', tip: 'Subjudul (H2)', icon: <Heading2 size={16} /> },
  { action: 'h3', label: 'Subjudul H3', tip: 'Sub-subjudul (H3)', icon: <Heading3 size={16} /> },
  { action: 'bold', label: 'Tebal', tip: 'Tebal (Ctrl+B)', icon: <Bold size={16} /> },
  { action: 'italic', label: 'Miring', tip: 'Miring (Ctrl+I)', icon: <Italic size={16} /> },
  { action: 'ul', label: 'Daftar', tip: 'Daftar berbutir', icon: <List size={16} /> },
  { action: 'ol', label: 'Daftar bernomor', tip: 'Daftar bernomor', icon: <ListOrdered size={16} /> },
  { action: 'link', label: 'Link', tip: 'Link (Ctrl+K)', icon: <Link2 size={16} /> },
  { action: 'image', label: 'Sisipkan gambar', tip: 'Sisipkan gambar', icon: <ImagePlus size={16} /> },
];

export default function MarkdownToolbar({ onAction, disabled }: { onAction: (a: ToolbarAction) => void; disabled?: boolean }) {
  // Escape hides the tooltips until the pointer or focus leaves the toolbar (WCAG 1.4.13).
  const [tipsHidden, setTipsHidden] = useState(false);
  return (
    <div
      className={`md-toolbar${tipsHidden ? ' tips-hidden' : ''}`}
      role="toolbar"
      aria-label="Format teks"
      onKeyDown={e => { if (e.key === 'Escape') setTipsHidden(true); }}
      onMouseLeave={() => setTipsHidden(false)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTipsHidden(false); }}
    >
      {BUTTONS.map(b => (
        <button
          key={b.action}
          type="button"
          className="md-toolbar-btn"
          aria-label={b.label}
          data-tip={b.tip}
          disabled={disabled}
          // Keeps the textarea selection while clicking.
          onMouseDown={e => e.preventDefault()}
          onClick={() => onAction(b.action)}
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}
