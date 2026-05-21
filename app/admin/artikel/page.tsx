'use client';

import { useState, useEffect, FormEvent } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
      const snap = await getDocs(collection(db, 'articles'));
      let items: Article[] = snap.docs.map(d => d.data() as Article).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setArticles(items);
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
    try { await deleteDoc(doc(db, 'articles', deleteTarget.slug)); closeDelete(); loadArticles(); } catch (e: any) { alert(e.message); }
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
      if (editSlug) { 
        await setDoc(doc(db, 'articles', editSlug), data, { merge: true }); 
        if (editSlug !== slug) await deleteDoc(doc(db, 'articles', editSlug)); 
      } else { 
        data.createdAt = serverTimestamp(); 
        await setDoc(doc(db, 'articles', slug), data); 
      }
      closeModal(); loadArticles();
    } catch (err: any) { setFormError('Error: ' + err.message); }
    setSaving(false);
  };

  const seedDummyArticle = async () => {
    try {
      const dummyData: any = {
        title: 'Tips Aman Riding Saat Hujan',
        slug: 'tips-aman-riding-saat-hujan',
        excerpt: 'Hujan bukan alasan berhenti berkendara. Simak tips aman riding saat hujan menggunakan gear yang tepat dari INZTA.',
        content: 'Hujan bukan alasan berhenti berkendara.\n\nPertama, pastikan kamu menggunakan jas hujan dan tas waterproof seperti INZTA agar barang bawaanmu tetap kering.\n\nKedua, kurangi kecepatan dan jaga jarak aman dengan kendaraan di depanmu. Jalan basah membuat jarak pengereman lebih panjang.\n\nKetiga, pastikan visor helm bersih dan gunakan anti-fog agar visi tetap jelas.\n\nDengan persiapan yang matang, riding di bawah hujan tetap bisa menjadi pengalaman yang menyenangkan!',
        images: ['https://images.unsplash.com/photo-1558981806-ec527fa84c39?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'],
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'articles', dummyData.slug), dummyData);
      loadArticles();
    } catch (err: any) {
      alert('Gagal membuat data contoh: ' + err.message);
    }
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
          <button onClick={seedDummyArticle} className="btn btn-primary" style={{ marginTop: '12px', fontSize: 11, padding: '8px 16px' }}>
            🚀 Buat Data Contoh Sekarang
          </button>
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
