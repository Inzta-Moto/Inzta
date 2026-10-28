'use client';

import { useEffect, useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  Grid2x2X,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Table,
  TableColumnsSplit,
  TableRowsSplit,
  Undo2,
} from 'lucide-react';

type Chain = ReturnType<Editor['chain']>;

interface Button {
  label: string;
  tip: string;
  icon: JSX.Element;
  run?: (c: Chain) => Chain;
  // For aria-pressed (requirement 9.3).
  active?: (e: Editor) => boolean;
  dialog?: 'link' | 'image';
  // Undo and redo start disabled: a freshly loaded document has no history.
  history?: true;
}

// F-013 phase B toolbar (decision B-9): the F-012 subset plus tables and undo/redo, as editor commands.
const MAIN: Button[] = [
  { label: 'Subjudul H2', tip: 'Subjudul (H2)', icon: <Heading2 size={16} />, run: c => c.toggleHeading({ level: 2 }), active: e => e.isActive('heading', { level: 2 }) },
  { label: 'Subjudul H3', tip: 'Sub-subjudul (H3)', icon: <Heading3 size={16} />, run: c => c.toggleHeading({ level: 3 }), active: e => e.isActive('heading', { level: 3 }) },
  { label: 'Tebal', tip: 'Tebal (Ctrl+B)', icon: <Bold size={16} />, run: c => c.toggleBold(), active: e => e.isActive('bold') },
  { label: 'Miring', tip: 'Miring (Ctrl+I)', icon: <Italic size={16} />, run: c => c.toggleItalic(), active: e => e.isActive('italic') },
  { label: 'Daftar', tip: 'Daftar berbutir', icon: <List size={16} />, run: c => c.toggleBulletList(), active: e => e.isActive('bulletList') },
  { label: 'Daftar bernomor', tip: 'Daftar bernomor', icon: <ListOrdered size={16} />, run: c => c.toggleOrderedList(), active: e => e.isActive('orderedList') },
  { label: 'Link', tip: 'Link (Ctrl+K)', icon: <Link2 size={16} />, dialog: 'link', active: e => e.isActive('link') },
  { label: 'Sisipkan gambar', tip: 'Sisipkan gambar', icon: <ImagePlus size={16} />, dialog: 'image' },
  { label: 'Sisipkan tabel', tip: 'Tabel 3×3', icon: <Table size={16} />, run: c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }) },
  { label: 'Urungkan', tip: 'Urungkan (Ctrl+Z)', icon: <Undo2 size={16} />, run: c => c.undo(), history: true },
  { label: 'Ulangi', tip: 'Ulangi (Ctrl+Shift+Z)', icon: <Redo2 size={16} />, run: c => c.redo(), history: true },
];
const TABLE: Button[] = [
  { label: 'Tambah baris', tip: 'Tambah baris di bawah', icon: <BetweenHorizontalEnd size={16} />, run: c => c.addRowAfter() },
  { label: 'Tambah kolom', tip: 'Tambah kolom di kanan', icon: <BetweenVerticalEnd size={16} />, run: c => c.addColumnAfter() },
  { label: 'Hapus baris', tip: 'Hapus baris', icon: <TableRowsSplit size={16} />, run: c => c.deleteRow() },
  { label: 'Hapus kolom', tip: 'Hapus kolom', icon: <TableColumnsSplit size={16} />, run: c => c.deleteColumn() },
  { label: 'Hapus tabel', tip: 'Hapus tabel', icon: <Grid2x2X size={16} />, run: c => c.deleteTable() },
];

interface ToolbarProps {
  editor: Editor | null;
  onLink: () => void;
  onImage: () => void;
}

export default function MarkdownToolbar({ editor, onLink, onImage }: ToolbarProps) {
  // Escape hides the tooltips until the pointer or focus leaves the toolbar (WCAG 1.4.13).
  const [tipsHidden, setTipsHidden] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Toolbar buttons keep focus in the editor (mousedown is prevented), so a mouse user's Escape never
  // reaches the toolbar; listen on the document while the pointer is over it.
  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTipsHidden(true); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hovered]);

  // Re-render on every transaction, so pressed and disabled states follow the selection.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const can = (b: Button) => !b.run || b.run(e.can().chain().focus()).run();
      const inTable = e.isActive('table');
      return {
        main: MAIN.map(b => ({ active: b.active?.(e) ?? null, enabled: can(b) })),
        table: inTable ? TABLE.map(b => can(b)) : null,
      };
    },
  });

  const press = (b: Button) => {
    if (!editor) return;
    if (b.dialog === 'link') onLink();
    else if (b.dialog === 'image') onImage();
    else if (b.run) b.run(editor.chain().focus()).run();
  };

  const button = (b: Button, enabled: boolean, active: boolean | null) => (
    <button
      key={b.label}
      type="button"
      className="md-toolbar-btn"
      aria-label={b.label}
      aria-pressed={active ?? undefined}
      data-tip={b.tip}
      disabled={!editor || !enabled}
      // Keeps the editor selection while clicking.
      onMouseDown={e => e.preventDefault()}
      onClick={() => press(b)}
    >
      {b.icon}
    </button>
  );

  return (
    <div
      className={`md-toolbar${tipsHidden ? ' tips-hidden' : ''}`}
      role="toolbar"
      aria-label="Format teks"
      onKeyDown={e => { if (e.key === 'Escape') setTipsHidden(true); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTipsHidden(false); }}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTipsHidden(false); }}
    >
      {/* Until the first editor transaction the state is null; the buttons are usable as soon as the editor is. */}
      {MAIN.map((b, i) => button(b, state?.main[i].enabled ?? !b.history, state?.main[i].active ?? null))}
      {state?.table && (
        <span className="md-toolbar-group" role="group" aria-label="Tabel">
          {TABLE.map((b, i) => button(b, state.table![i], null))}
        </span>
      )}
    </div>
  );
}
