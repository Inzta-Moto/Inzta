'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Article } from '@/types';
import ImageUpload from '@/components/ImageUpload';

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [modal, setModal] = useState<Partial<Article> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; title: string } | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => { loadArticles(); }, []);

  async function loadArticles() {
    try {
      const res = await fetch('/api/articles');
      const data = await res.json();
      if (res.ok && data.items) {
        const getTimestamp = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'string') return new Date(val).getTime() || 0;
          if (typeof val === 'number') return val;
          if (typeof val === 'object') {
            if (typeof val.seconds === 'number') return val.seconds * 1000;
            if (typeof val._seconds === 'number') return val._seconds * 1000;
          }
          return 0;
        };
        let items: Article[] = data.items.sort((a: any, b: any) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
        setArticles(items);
      }
    } catch (e) { console.error(e); }
  }

  const openAdd = () => { setModal({}); setFormError(''); setImageUrls([]); };
  
  const openEdit = (data: Article) => { 
    setModal(data); 
    setFormError(''); 
    // Kompatibel: jika data lama cuma punya 1 gambar (imageUrl), ubah ke array
    setImageUrls(Array.isArray((data as any).images) ? (data as any).images : (data.imageUrl ? [data.imageUrl] : [])); 
  };
  
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (slug: string, title: string) => setDeleteTarget({ slug, title });
  const closeDelete = () => setDeleteTarget(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { 
      const res = await fetch('/api/articles/' + deleteTarget.slug, { method: 'DELETE' });
      if (res.ok) {
        closeDelete(); loadArticles(); 
      }
    } catch (e: any) { alert(e.message); }
  };

  const autoSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const editSlug = fd.get('editSlug') as string;
    const slug = (fd.get('slug') as string)?.trim();
    
    if (!slug) { setFormError('Slug wajib diisi.'); setSaving(false); return; }

    const data: any = {
      title: fd.get('title') as string,
      slug,
      excerpt: fd.get('excerpt') as string || '',
      content: fd.get('content') as string || '',
      images: imageUrls, // SIMPAN SEBAGAI ARRAY
    };

    try {
      if (editSlug && editSlug !== slug) { 
        await fetch('/api/articles/' + editSlug, { method: 'DELETE' }); 
      }
      
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!res.ok) throw new Error('Gagal menyimpan');
      
      closeModal(); loadArticles();
    } catch (err: any) { setFormError('Error: ' + err.message); }
    setSaving(false);
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Artikel / Blog</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Artikel</button>
      </div>

      {articles.length === 0 && (
        <div className="empty-state" style={{ marginBottom: '24px' }}>
          <p>Collection <strong>articles</strong> belum ada.</p>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Judul Artikel</th><th>Slug</th><th>Tanggal</th><th>Aksi</th></tr></thead>
          <tbody>
            {articles.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">Belum ada artikel.</td></tr>
            ) : articles.map(a => (
              <tr key={a.slug}>
                <td><span className="table-product-name">{a.title}</span></td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{a.slug}</td>
                <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}</td>
                <td><div className="table-actions">
                  <button className="table-btn" onClick={() => openEdit(a)}>✏️</button>
                  <button className="table-btn danger" onClick={() => openDelete(a.slug, a.title)}>🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit */}
      {modal !== null && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{modal.slug ? 'Edit Artikel' : 'Tambah Artikel'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <input type="hidden" name="editSlug" defaultValue={modal.slug || ''} />
              
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Judul Artikel *</label>
                  <input name="title" className="form-input" required defaultValue={modal.title || ''} 
                    onChange={(e) => { if (!modal.slug) { (document.getElementById('art-slug') as HTMLInputElement).value = autoSlug(e.target.value); } }} 
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Slug *</label>
                  <input id="art-slug" name="slug" className="form-input" required defaultValue={modal.slug || ''} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Excerpt (Ringkasan Pendek) *</label>
                <input name="excerpt" className="form-input" required defaultValue={modal.excerpt || ''} placeholder="Teks singkat yang muncul di halaman list blog..." />
              </div>

              <div className="form-group">
                <label className="form-label">Konten Artikel *</label>
                <textarea name="content" className="form-input" rows={8} required defaultValue={modal.content || ''} placeholder="Tulis isi artikel di sini... (Pindah baris = paragraf baru)" />
              </div>

              <div className="form-group">
                <label className="form-label">Gambar Artikel</label>
                <ImageUpload value={imageUrls} onChange={setImageUrls} max={5} />
              </div>

              {formError && <div className="form-error">{formError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 11, padding: '8px 16px' }}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {deleteTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeDelete(); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">Hapus Artikel</h2>
              <button className="modal-close" onClick={closeDelete}>&times;</button>
            </div>
            <div className="modal-body"><p className="modal-text">Yakin hapus artikel <strong>{deleteTarget.title}</strong>?</p></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#EF4444' }} onClick={handleDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
