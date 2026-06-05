'use client';

import { useState, useEffect, FormEvent } from 'react';
import { formatPrice } from '@/lib/utils';
import { Product } from '@/types';
import ImageUpload from '@/components/ImageUpload';
import { Edit2, Trash2, Package, ChevronDown, Tag, Layers, DollarSign, Archive, ArrowLeft, Save } from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [formView, setFormView] = useState<'list' | 'add' | 'edit'>('list');
  const [editSlug, setEditSlug] = useState<string>('');
  const ITEMS_PER_PAGE = 10;

  const [fName, setFName] = useState('');
  const [fSlug, setFSlug] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCategory, setFCategory] = useState<'hardcase' | 'softcase' | 'tank'>('hardcase');
  const [fStock, setFStock] = useState(0);
  const [fPrice, setFPrice] = useState('');
  const [fOriginalPrice, setFOriginalPrice] = useState('');
  const [fIsActive, setFIsActive] = useState(true);
  const [fBadge, setFBadge] = useState('');
  const [fBadgeType, setFBadgeType] = useState<'white' | 'outline' | 'dark'>('white');
  const [fFeatures, setFFeatures] = useState('');
  const [fImages, setFImages] = useState<string[]>([]);

  useEffect(() => { loadProducts(); }, []);

  const generateSlug = (text: string) => {
    return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
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

  const resetForm = () => {
    setFName(''); setFSlug(''); setFDesc(''); setFCategory('hardcase');
    setFStock(0); setFPrice(''); setFOriginalPrice(''); setFIsActive(true);
    setFBadge(''); setFBadgeType('white'); setFFeatures(''); setFImages([]);
    setEditSlug(''); setFormError('');
  };

  const openAdd = () => { resetForm(); setFormView('add'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const openEdit = (p: Product) => {
    setEditSlug(p.slug || '');
    setFName(p.name || '');
    setFSlug(p.slug || '');
    setFDesc(p.description || '');
    setFCategory((p.category || 'hardcase') as 'hardcase' | 'softcase' | 'tank');
    setFStock(p.stock ?? 0);
    setFPrice(p.price ? p.price.toLocaleString('id-ID') : '');
    setFOriginalPrice((p as any).originalPrice ? (p as any).originalPrice.toLocaleString('id-ID') : '');
    setFIsActive(p.isActive ?? true);
    setFBadge(p.badge || '');
    setFBadgeType((p.badgeType || 'white') as 'white' | 'outline' | 'dark');
    setFFeatures(p.features?.join(', ') || '');
    setFImages(p.images?.length ? [...p.images] : (p.imageUrl ? [p.imageUrl] : []));
    setFormError('');
    setFormView('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => { setFormView('list'); };
  const openDelete = (slug: string, name: string) => setDeleteTarget({ slug, name });
  const closeDelete = () => setDeleteTarget(null);

  const toggleExpand = (slug: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/products/' + deleteTarget.slug, { method: 'DELETE' });
      if (res.ok) { closeDelete(); loadProducts(); }
      else { const errorData = await res.json(); alert(errorData.error || 'Failed to delete'); }
    } catch (e: any) { alert(e.message); }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    if (!fSlug) { setFormError('Slug kosong, pastikan nama produk diisi.'); setSaving(false); return; }

    const priceVal = parseInt(fPrice.replace(/\D/g, '')) || 0;
    const origPriceVal = parseInt(fOriginalPrice.replace(/\D/g, '')) || 0;

    const data: Product = {
      name: fName, slug: fSlug, description: fDesc, category: fCategory,
      stock: fStock, price: priceVal, originalPrice: origPriceVal,
      isActive: fIsActive, badge: fBadge || null, badgeType: fBadgeType,
      features: fFeatures ? fFeatures.split(',').map(f => f.trim()).filter(Boolean) : [],
      images: fImages, imageUrl: fImages[0] || '',
    };

    try {
      if (formView === 'edit' && editSlug && editSlug !== fSlug) {
        await fetch('/api/products/' + editSlug, { method: 'DELETE' });
      }
      const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || 'Failed to save product'); }
      loadProducts(); setFormView('list');
    } catch (err: any) { console.error(err); setFormError('Gagal menyimpan: ' + err.message); }
    finally { setSaving(false); }
  };

  const pagedProducts = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = { hardcase: 'Hardcase', softcase: 'Softcase', tank: 'Tank Bag' };
    return map[cat] || cat;
  };

  // ── FORM PAGE ──
  if (formView !== 'list') {
    return (
      <div className="prod-form-page">
        <div className="prod-form-topbar">
          <button className="prod-form-back" onClick={cancelForm}>
            <ArrowLeft size={18} />
            <span>Kembali</span>
          </button>
          <h1 className="prod-form-title">{formView === 'edit' ? 'Edit Produk' : 'Tambah Produk'}</h1>
          <div style={{ width: 100 }} />
        </div>

        {formError && <div className="form-error prod-form-error">{formError}</div>}

        <form onSubmit={handleSubmit} className="prod-form-layout">
          <div className="prod-form-main">
            <div className="prod-form-card">
              <div className="prod-form-card-title">Informasi Utama</div>
              <div className="prod-form-fields">
                <div className="form-group">
                  <label className="form-label">Nama Produk *</label>
                  <input
                    name="name" className="form-input" required value={fName}
                    onChange={(e) => { setFName(e.target.value); setFSlug(generateSlug(e.target.value)); }}
                    placeholder="Contoh: Hardcase Yamaha NMAX 2024"
                  />
                  {fSlug && <small className="prod-slug-preview">URL: <strong>/produk/{fSlug}</strong></small>}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kategori *</label>
                    <select name="category" className="form-input" value={fCategory} onChange={e => setFCategory(e.target.value as any)}>
                      <option value="hardcase">Hardcase</option>
                      <option value="softcase">Softcase</option>
                      <option value="tank">Tank Bag</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stok *</label>
                    <input type="number" name="stock" className="form-input" min={0} value={fStock} onChange={e => setFStock(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="isActive" className="form-input" value={String(fIsActive)} onChange={e => setFIsActive(e.target.value === 'true')}>
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="prod-form-card prod-desc-card">
              <div className="prod-desc-header">
                <div className="prod-desc-header-left">
                  <div className="prod-desc-header-title">Deskripsi Produk</div>
                  <span className="prod-desc-hint">Tulis deskripsi lengkap untuk membantu customer memahami produk</span>
                </div>
                <span className="prod-desc-count-badge">{fDesc.length} karakter</span>
              </div>

              <div className="prod-desc-textarea-wrap">
                <textarea
                  name="description"
                  className="prod-desc-textarea"
                  value={fDesc}
                  onChange={e => setFDesc(e.target.value)}
                  placeholder={`Hardcase premium untuk Yamaha NMAX 2024.\n\nFitur:\n• Bahan ABS berkualitas tinggi\n• Anti gores dan tahan benturan\n• Pemasangan plug & play\n• Warna sesuai body motor\n\nCatatan:\nTermasuk double tape 3M untuk pemasangan.`}
                />
              </div>

              <div className="prod-desc-footer">
                <span className="prod-desc-tips">
                  <kbd>Enter</kbd> baris baru &nbsp;·&nbsp; Gunakan untuk detail fitur, bahan, cara pasang
                </span>
                {fDesc.length > 0 && (
                  <span className="prod-desc-count">~{Math.ceil(fDesc.length / 60)} baris</span>
                )}
              </div>
            </div>

            <div className="prod-form-card prod-images-card">
              <div className="prod-form-card-title">Gambar Produk (maks 3)</div>
              <ImageUpload value={fImages} onChange={setFImages} max={3} />
            </div>
          </div>

          <div className="prod-form-sidebar">
            <div className="prod-form-card">
              <div className="prod-form-card-title">Harga</div>
              <div className="prod-form-fields">
                <div className="form-group">
                  <label className="form-label">Harga Jual *</label>
                  <input
                    type="text" name="price" className="form-input" value={fPrice} placeholder="0" required
                    onChange={e => setFPrice(e.target.value.replace(/\D/g, '').replace(/^0+/, '') ? parseInt(e.target.value.replace(/\D/g, '') || '0').toLocaleString('id-ID') : '')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Coret</label>
                  <input
                    type="text" name="originalPrice" className="form-input" value={fOriginalPrice} placeholder="0"
                    onChange={e => setFOriginalPrice(e.target.value.replace(/\D/g, '').replace(/^0+/, '') ? parseInt(e.target.value.replace(/\D/g, '') || '0').toLocaleString('id-ID') : '')}
                  />
                  {fOriginalPrice && parseInt(fOriginalPrice.replace(/\D/g, '')) > parseInt(fPrice.replace(/\D/g, '')) && (
                    <small style={{ color: '#059669', fontSize: 11, marginTop: 4, display: 'block' }}>
                      Diskon {Math.round(((parseInt(fOriginalPrice.replace(/\D/g, '')) - parseInt(fPrice.replace(/\D/g, ''))) / parseInt(fOriginalPrice.replace(/\D/g, ''))) * 100)}%
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className="prod-form-card">
              <div className="prod-form-card-title">Badge & Features</div>
              <div className="prod-form-fields">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Badge</label>
                    <select name="badge" className="form-input" value={fBadge} onChange={e => setFBadge(e.target.value)}>
                      <option value="">Tanpa</option>
                      <option value="BEST SELLER">BEST SELLER</option>
                      <option value="NEW">NEW</option>
                      <option value="SALE">SALE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Style</label>
                    <select name="badgeType" className="form-input" value={fBadgeType} onChange={e => setFBadgeType(e.target.value as any)}>
                      <option value="white">White</option>
                      <option value="outline">Outline</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Features</label>
                  <input name="features" className="form-input" value={fFeatures} onChange={e => setFFeatures(e.target.value)} placeholder="ABS, Anti Gores, Plug & Play" />
                  <small style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, display: 'block' }}>Pisahkan dengan koma</small>
                </div>
              </div>
            </div>

            {fName && (
              <div className="prod-form-card">
                <div className="prod-form-card-title">Preview</div>
                <div className="prod-preview-card">
                  {fImages[0] && <div className="prod-preview-img"><img src={fImages[0]} alt="" /></div>}
                  <div className="prod-preview-body">
                    {fBadge && <span className="prod-preview-badge">{fBadge}</span>}
                    <div className="prod-preview-name">{fName || 'Nama Produk'}</div>
                    <div className="prod-preview-cat">{getCategoryLabel(fCategory)}</div>
                    <div className="prod-preview-price-row">
                      {fOriginalPrice && parseInt(fOriginalPrice.replace(/\D/g, '')) > parseInt(fPrice.replace(/\D/g, '')) && (
                        <span className="prod-preview-old">{formatPrice(parseInt(fOriginalPrice.replace(/\D/g, '')))}</span>
                      )}
                      <span className="prod-preview-price">{fPrice ? formatPrice(parseInt(fPrice.replace(/\D/g, ''))) : 'Rp 0'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="prod-form-save-wrap">
              <button type="submit" className="prod-form-save-btn" disabled={saving}>
                <Save size={16} />
                {saving ? 'Menyimpan...' : 'Simpan Produk'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ── LIST PAGE ──
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Produk</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Produk</button>
      </div>

      {products.length === 0 ? (
        <div className="prod-empty">
          <Package size={40} strokeWidth={1.2} />
          <p>Belum ada produk.</p>
        </div>
      ) : (
        <>
          <div className="prod-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProducts.map(p => {
                    const thumb = p.images?.[0] || p.imageUrl;
                    const origPrice = (p as any).originalPrice || 0;
                    return (
                      <tr key={p.slug}>
                        <td>
                          <div className="table-product-cell">
                            {thumb ? <img src={thumb} className="table-product-thumb" alt="" /> : <div className="table-product-thumb-placeholder"><Package size={16} /></div>}
                            <span className="table-product-name">{p.name}</span>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{getCategoryLabel(p.category)}</td>
                        <td style={{ fontSize: 12 }}>
                          {origPrice > p.price && <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through', marginBottom: 1 }}>{formatPrice(origPrice)}</div>}
                          <span style={{ fontWeight: 600 }}>{formatPrice(p.price)}</span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <span style={{ color: p.stock <= 5 ? '#EF4444' : '#374151', fontWeight: p.stock <= 5 ? 600 : 400 }}>{p.stock}</span>
                        </td>
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
                </tbody>
              </table>
            </div>
          </div>

          <div className="prod-mobile-accordion">
            {pagedProducts.map(p => {
              const isExpanded = expandedProducts.has(p.slug);
              const thumb = p.images?.[0] || p.imageUrl;
              const origPrice = (p as any).originalPrice || 0;
              const hasDiscount = origPrice > p.price;
              const discountPercent = hasDiscount ? Math.round(((origPrice - p.price) / origPrice) * 100) : 0;

              return (
                <div key={p.slug} className={`prod-accordion-card ${isExpanded ? 'expanded' : ''}`}>
                  <button className="prod-accordion-header" onClick={() => toggleExpand(p.slug)}>
                    <div className="prod-accordion-left">
                      <div className="prod-accordion-thumb">
                        {thumb ? <img src={thumb} alt="" /> : <Package size={16} color="#ccc" />}
                      </div>
                      <div className="prod-accordion-identity">
                        <span className="prod-accordion-name">{p.name}</span>
                        <span className="prod-accordion-category"><Layers size={10} />{getCategoryLabel(p.category)}</span>
                      </div>
                    </div>
                    <div className="prod-accordion-right">
                      <div className="prod-accordion-price-col">
                        {hasDiscount && <span className="prod-price-old">{formatPrice(origPrice)}</span>}
                        <span className="prod-price-now">{formatPrice(p.price)}</span>
                        {hasDiscount && <span className="prod-discount-tag">-{discountPercent}%</span>}
                      </div>
                      <ChevronDown size={16} className={`prod-accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </button>

                  <div className="prod-accordion-body">
                    <div className="prod-accordion-body-inner">
                      <div className="prod-accordion-row">
                        <span className="prod-accordion-label">Status</span>
                        {p.isActive
                          ? <span className="prod-status-badge prod-status-active">Aktif</span>
                          : <span className="prod-status-badge prod-status-inactive">Nonaktif</span>
                        }
                      </div>
                      <div className="prod-accordion-row">
                        <span className="prod-accordion-label"><Archive size={11} /> Stok</span>
                        <span className={`prod-accordion-value ${p.stock <= 5 ? 'prod-stock-low' : ''}`}>
                          {p.stock} {p.stock <= 5 && p.stock > 0 ? '(Stok rendah!)' : p.stock === 0 ? '(Habis)' : ''}
                        </span>
                      </div>
                      <div className="prod-accordion-section">
                        <span className="prod-accordion-section-title"><DollarSign size={10} /> Rincian Harga</span>
                        <div className="prod-price-breakdown">
                          <div className="prod-price-breakdown-row"><span>Harga Jual</span><span className="prod-price-breakdown-val">{formatPrice(p.price)}</span></div>
                          {hasDiscount && (
                            <>
                              <div className="prod-price-breakdown-row"><span>Harga Coret</span><span className="prod-price-breakdown-old">{formatPrice(origPrice)}</span></div>
                              <div className="prod-price-breakdown-row highlight"><span>Potongan</span><span className="prod-price-breakdown-disc">-{discountPercent}% ({formatPrice(origPrice - p.price)})</span></div>
                            </>
                          )}
                        </div>
                      </div>
                      {p.badge && (
                        <div className="prod-accordion-row">
                          <span className="prod-accordion-label"><Tag size={11} /> Badge</span>
                          <span className="prod-badge-tag">{p.badge}</span>
                        </div>
                      )}
                      {p.features && p.features.length > 0 && (
                        <div className="prod-accordion-section">
                          <span className="prod-accordion-section-title">Features</span>
                          <div className="prod-features-list">
                            {p.features.map((f, i) => <span key={i} className="prod-feature-chip">{f}</span>)}
                          </div>
                        </div>
                      )}
                      {p.images && p.images.length > 0 && (
                        <div className="prod-accordion-section">
                          <span className="prod-accordion-section-title">Gambar ({p.images.length})</span>
                          <div className="prod-images-preview">
                            {p.images.map((img, i) => <div key={i} className="prod-img-thumb"><img src={img} alt="" /></div>)}
                          </div>
                        </div>
                      )}
                      <div className="prod-accordion-actions">
                        <button className="prod-action-btn prod-action-edit" onClick={() => openEdit(p)}><Edit2 size={14} /> Edit</button>
                        <button className="prod-action-btn prod-action-delete" onClick={() => openDelete(p.slug, p.name)}><Trash2 size={14} /> Hapus</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {products.length > ITEMS_PER_PAGE && (
        <div className="prod-pagination">
          <button className="prod-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Sebelumnya</button>
          <div className="prod-page-info">
            <span className="prod-page-current">{currentPage}</span>
            <span className="prod-page-sep">/</span>
            <span className="prod-page-total">{totalPages}</span>
          </div>
          <button className="prod-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Selanjutnya →</button>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeDelete(); }}>
          <div className="modal modal-sm">
            <div className="modal-header"><h2 className="modal-title">Hapus Produk</h2><button type="button" className="modal-close" onClick={closeDelete}>&times;</button></div>
            <div className="modal-body"><p className="modal-text">Yakin hapus <strong>{deleteTarget.name}</strong>?</p></div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#333' }} onClick={handleDelete}><Trash2 size={12} /> Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}