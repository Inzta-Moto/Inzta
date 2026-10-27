'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Edit2, Eye, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { readAdminError } from '@/lib/admin-messages';
import { statusOf } from '@/lib/article-format';
import type { ArticleStatus } from '@/types';

// Shape returned by GET /api/articles for an admin: stored fields with dates as epoch milliseconds.
interface ArticleRow {
  slug: string;
  title: string;
  status?: ArticleStatus;
  createdAt: number | null;
  updatedAt: number | null;
}

type Filter = 'all' | ArticleStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'draft', label: 'Draf' },
  { id: 'published', label: 'Terbit' },
];
const ITEMS_PER_PAGE = 10;

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; title: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { loadArticles(); }, []);

  // One collection read per open (requirement 12.4); filters and paging run on the loaded list.
  async function loadArticles() {
    try {
      const res = await fetch('/api/articles');
      if (!res.ok) { setLoadError(await readAdminError(res)); return; }
      const data = await res.json();
      const items: ArticleRow[] = (data.items || []).sort(
        (a: ArticleRow, b: ArticleRow) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
      );
      setArticles(items);
      setLoadError('');
    } catch (e: any) {
      setLoadError('Gagal memuat artikel: ' + e.message);
    } finally {
      setLoaded(true);
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/articles/' + deleteTarget.slug, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTarget(null); loadArticles();
      } else {
        alert(await readAdminError(res));
      }
    } catch (e: any) { alert(e.message); }
  };

  // Legacy articles have no status and count as published (requirement 11.1).
  const visible = filter === 'all' ? articles : articles.filter(a => statusOf(a) === filter);
  const pageCount = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, pageCount);
  const countOf = (f: Filter) => (f === 'all' ? articles.length : articles.filter(a => statusOf(a) === f).length);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Artikel / Blog</h1>
        <Link href="/admin/artikel/baru" className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px' }}>+ Tulis artikel</Link>
      </div>

      <div className="scrollable-tabs article-filter" role="group" aria-label="Saring artikel">
        {FILTERS.map(f => (
          <button
            key={f.id}
            type="button"
            className={`btn ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={filter === f.id}
            onClick={() => { setFilter(f.id); setCurrentPage(1); }}
            style={{ fontSize: 11, padding: '6px 14px' }}
          >
            {f.label} ({countOf(f.id)})
          </button>
        ))}
      </div>

      {loadError && <div className="form-error" role="alert" style={{ marginBottom: 16 }}>{loadError}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Judul Artikel</th><th>Slug</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">{loaded ? 'Belum ada artikel.' : 'Memuat...'}</td></tr>
            ) : visible.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map(a => {
              const status = statusOf(a);
              return (
                <tr key={a.slug}>
                  <td><span className="table-product-name">{a.title}</span></td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{a.slug}</td>
                  <td>
                    <span className={`table-badge ${status === 'published' ? 'table-badge-active' : 'table-badge-inactive'}`}>
                      {status === 'published' ? 'Terbit' : 'Draf'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{formatDate(a.updatedAt ?? a.createdAt)}</td>
                  <td><div className="table-actions">
                    <Link className="table-btn" href={`/admin/artikel/${a.slug}`} aria-label={`Edit ${a.title}`} title="Edit"><Edit2 size={16} /></Link>
                    <a className="table-btn" href={`/admin/pratinjau/${a.slug}`} target="_blank" rel="noopener" aria-label={`Pratinjau ${a.title}`} title="Pratinjau"><Eye size={16} /></a>
                    <button type="button" className="table-btn danger" onClick={() => setDeleteTarget({ slug: a.slug, title: a.title })} aria-label={`Hapus ${a.title}`} title="Hapus"><Trash2 size={16} /></button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length > ITEMS_PER_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
          <button className="btn btn-ghost" disabled={page === 1} onClick={() => setCurrentPage(Math.max(1, page - 1))} style={{ fontSize: 13, padding: '6px 12px' }}>
            Sebelumnya
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Halaman {page} dari {pageCount}</span>
          <button className="btn btn-ghost" disabled={page === pageCount} onClick={() => setCurrentPage(Math.min(pageCount, page + 1))} style={{ fontSize: 13, padding: '6px 12px' }}>
            Selanjutnya
          </button>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="hapus-artikel-title">
            <div className="modal-header">
              <h2 className="modal-title" id="hapus-artikel-title">Hapus Artikel</h2>
              <button className="modal-close" onClick={() => setDeleteTarget(null)} aria-label="Tutup">&times;</button>
            </div>
            <div className="modal-body"><p className="modal-text">Yakin hapus artikel <strong>{deleteTarget.title}</strong>?</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#EF4444' }} onClick={handleDelete}><Trash2 size={12} /> Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
