'use client';

import { useState, useEffect, FormEvent } from 'react';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';
import ImageUpload from '@/components/ImageUpload';
import { Edit2, Trash2, Package } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [modal, setModal] = useState<Partial<Product> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => { loadProducts(); }, []);

  // ── Fungsi pembuat Slug Otomatis ──
  const generateSlug = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')       // Ganti spasi dengan -
      .replace(/[^\w-]+/g, '')    // Hapus karakter non-alfanumerik
      .replace(/--+/g, '-')       // Ganti double - dengan single -
      .replace(/^-+/, '')         // Hapus - di awal
      .replace(/-+$/, '');        // Hapus - di akhir
  };

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok && data.products) {
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
        let items: Product[] = data.products.sort((a: any, b: any) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
        setProducts(items);
      }
    } catch (e) { console.error(e); }
  }

  const openAdd = () => { 
    setModal({ name: '', slug: '' }); // Inisialisasi state agar input terkontrol
    setFormError(''); 
    setImages([]); 
  };
  
  const openEdit = (data: Product) => {
    setModal({ ...data, name: data.name || '', slug: data.slug || '' });
    setFormError('');
    setImages(data.images?.length ? [...data.images] : (data.imageUrl ? [data.imageUrl] : []));
  };
  
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (slug: string, name: string) => setDeleteTarget({ slug, name });
  const closeDelete = () => setDeleteTarget(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { 
      const res = await fetch('/api/products/' + deleteTarget.slug, { method: 'DELETE' });
      if (res.ok) {
        closeDelete(); 
        loadProducts(); 
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete');
      }
    } catch (e: any) { alert(e.message); }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const editSlug = fd.get('editSlug') as string;
    
    // Slug sekarang diambil dari hidden input yang sudah auto-terisi
    const slug = (fd.get('slug') as string)?.trim();
    if (!slug) { setFormError('Slug kosong, pastikan nama produk diisi.'); setSaving(false); return; }

    const featuresRaw = fd.get('features') as string || '';
    const data: Product = {
      name: fd.get('name') as string, slug,
      description: fd.get('description') as string || '',
      category: fd.get('category') as 'hardcase' | 'softcase' | 'tank',
      stock: parseInt(fd.get('stock') as string) || 0,
      price: parseInt(fd.get('price') as string) || 0,
      originalPrice: parseInt(fd.get('originalPrice') as string) || 0,
      isActive: fd.get('isActive') === 'true',
      badge: fd.get('badge') as string || null,
      badgeType: fd.get('badgeType') as 'white' | 'outline' | 'dark' || 'white',
      features: featuresRaw ? featuresRaw.split(',').map(f => f.trim()).filter(Boolean) : [],
      images: images,
      imageUrl: images[0] || '',
    };

    try {
      if (editSlug && editSlug !== slug) {
        await fetch('/api/products/' + editSlug, { method: 'DELETE' });
      }
      
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save product');
      }

      closeModal(); loadProducts();
    } catch (err: any) { 
      console.error(err);
      setFormError('Gagal menyimpan: ' + err.message); 
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Produk</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Produk</button>
      </div>

      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        {products.length === 0 ? <tr><td colSpan={6} className="table-empty">Belum ada produk.</td></tr> : products.map(p => {
          const thumb = p.images?.[0] || p.imageUrl;
          return (
            <tr key={p.slug}>
              <td>
                <div className="table-product-cell">
                  {thumb ? <img src={thumb} className="table-product-thumb" alt="" /> : <div className="table-product-thumb-placeholder"><Package size={16} /></div>}
                  <span className="table-product-name">{p.name}</span>
                </div>
              </td>
              <td style={{ textTransform: 'capitalize' }}>{p.category}</td>
              <td>{formatPrice(p.price)}</td>
              <td>{p.stock}</td>
              <td>{p.isActive ? <span className="table-badge table-badge-active">Aktif</span> : <span className="table-badge table-badge-inactive">Nonaktif</span>}</td>
              <td>
                <div className="table-actions">
                  <button className="table-btn" onClick={() => openEdit(p)}><Edit2 size={16} /></button>
                  <button className="table-btn danger" onClick={() => openDelete(p.slug, p.name)}><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody></table></div>

      {modal !== null && (<div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}><div className="modal"><div className="modal-header"><h2 className="modal-title">{modal.slug ? 'Edit Produk' : 'Tambah Produk'}</h2><button type="button" className="modal-close" onClick={closeModal}>&times;</button></div><form onSubmit={handleSubmit} className="modal-body">
        
        <input type="hidden" name="editSlug" defaultValue={modal.slug || ''} />
        {/* Slug sekarang otomatis, disembunyikan di hidden input */}
        <input type="hidden" name="slug" value={modal.slug || ''} />

        {formError && <div className="form-error" style={{ marginBottom: 16 }}>{formError}</div>}

        {/* Input Nama Produk (Otomatis membuat slug) */}
        <div className="form-group">
          <label className="form-label">Nama Produk *</label>
          <input 
            name="name" 
            className="form-input" 
            required 
            value={modal.name || ''}
            onChange={(e) => {
              const newName = e.target.value;
              setModal(prev => prev ? { ...prev, name: newName, slug: generateSlug(newName) } : { name: newName, slug: generateSlug(newName) });
            }}
          />
          {/* Preview slug agar admin tahu URL-nya seperti apa */}
          {modal.slug && (
            <small style={{ color: 'var(--text-placeholder)', marginTop: 4, display: 'block', fontSize: 11 }}>
              Slug: <strong>{modal.slug}</strong>
            </small>
          )}
        </div>

        <div className="form-group"><label className="form-label">Deskripsi</label><textarea name="description" className="form-input" rows={4} defaultValue={modal.description || ''} /></div>
        <div className="form-row"><div className="form-group"><label className="form-label">Kategori *</label><select name="category" className="form-input" defaultValue={modal.category || 'hardcase'}><option value="hardcase">Hardcase</option><option value="softcase">Softcase</option><option value="tank">Tank Bag</option></select></div><div className="form-group"><label className="form-label">Stok *</label><input type="number" name="stock" className="form-input" min={0} defaultValue={modal.stock ?? 0} /></div></div>
        <div className="form-section-title">Harga</div>
        <div className="form-row"><div className="form-group"><label className="form-label">Harga Jual *</label><input type="number" name="price" className="form-input" min={0} defaultValue={modal.price || ''} /></div><div className="form-group"><label className="form-label">Harga Coret</label><input type="number" name="originalPrice" className="form-input" min={0} defaultValue={modal.originalPrice || ''} /></div><div className="form-group"><label className="form-label">Aktif</label><select name="isActive" className="form-input" defaultValue={String(modal.isActive ?? true)}><option value="true">Ya</option><option value="false">Tidak</option></select></div></div>
        <div className="form-section-title">Lainnya</div>
        <div className="form-row form-row-3"><div className="form-group"><label className="form-label">Badge</label><select name="badge" className="form-input" defaultValue={modal.badge || ''}><option value="">Tanpa</option><option value="BEST SELLER">BEST SELLER</option><option value="NEW">NEW</option><option value="SALE">SALE</option></select></div><div className="form-group"><label className="form-label">Badge Style</label><select name="badgeType" className="form-input" defaultValue={modal.badgeType || 'white'}><option value="white">White</option><option value="outline">Outline</option><option value="dark">Dark</option></select></div><div className="form-group"><label className="form-label">Features</label><input name="features" className="form-input" defaultValue={modal.features?.join(', ') || ''} /></div></div>

        <div className="form-group">
          <label className="form-label">Gambar Produk (maks 3)</label>
          <ImageUpload value={images} onChange={setImages} max={3} />
        </div>

        <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={closeModal} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button><button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 11, padding: '8px 16px' }}>{saving ? 'Menyimpan...' : 'Simpan'}</button></div>
      </form></div></div>)}

      {deleteTarget && (<div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeDelete(); }}><div className="modal modal-sm"><div className="modal-header"><h2 className="modal-title">Hapus Produk</h2><button type="button" className="modal-close" onClick={closeDelete}>&times;</button></div><div className="modal-body"><p className="modal-text">Yakin hapus <strong>{deleteTarget.name}</strong>?</p></div><div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button><button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#333' }} onClick={handleDelete}><Trash2 size={12} /> Hapus</button></div></div></div>)}
    </>
  );
}
