'use client';

import { useState, useEffect, FormEvent, useMemo, useRef } from 'react';
import { formatPrice, calcDiscount, optimizeCloudinaryUrl } from '@/lib/utils';
import { generateVariants, computePriceRange, countCombinations } from '@/lib/product-utils';
import type { Product, ProductAttribute, ProductVariant } from '@/types';
import ImageUpload from '@/components/ImageUpload';
import { toSlug } from '@/lib/slug';
import { readAdminError } from '@/lib/admin-messages';
import { Edit2, Trash2, Package, ChevronDown, Tag, Layers, DollarSign, Archive, ArrowLeft, Save, Plus, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type FormVariant = ProductVariant & { _dirty?: boolean };

// ── Helpers ────────────────────────────────────────────────────────────────────

// Same rules as the API's slug check, so a generated slug is never rejected on save.
const generateSlug = toSlug;

const getCategoryLabel = (cat: string) => ({ hardcase: 'Hardcase', softcase: 'Softcase', tank: 'Tank Bag' } as any)[cat] || cat;

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

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; name: string } | null>(null);
  const [formError, setFormError] = useState<string>('');
  const formErrorRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [formView, setFormView] = useState<'list' | 'add' | 'edit'>('list');
  const [editSlug, setEditSlug] = useState<string>('');
  const [variantsWithOrders, setVariantsWithOrders] = useState<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 10;

  // ── Shared fields ──────────────────────────────────────────────────────────
  const [fName, setFName] = useState('');
  const [fSlug, setFSlug] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fCategory, setFCategory] = useState<'hardcase' | 'softcase' | 'tank'>('hardcase');
  const [fIsActive, setFIsActive] = useState(true);
  const [fBadge, setFBadge] = useState('');
  const [fBadgeType, setFBadgeType] = useState<'white' | 'outline' | 'dark'>('white');
  const [fFeatures, setFFeatures] = useState('');
  const [fImages, setFImages] = useState<string[]>([]);
  const [fProductType, setFProductType] = useState<'simple' | 'variable'>('simple');

  // ── Simple-only fields ─────────────────────────────────────────────────────
  const [fStock, setFStock] = useState(0);
  const [fPrice, setFPrice] = useState('');
  const [fCompareAtPrice, setFCompareAtPrice] = useState('');
  const [fSku, setFSku] = useState('');

  // ── Variable-only fields ───────────────────────────────────────────────────
  const [fAttributes, setFAttributes] = useState<ProductAttribute[]>([]);
  const [fVariants, setFVariants] = useState<FormVariant[]>([]);
  const [showInactiveVariants, setShowInactiveVariants] = useState(false);

  // Per-attribute raw input text. The controlled input's value is bound to this
  // draft so the user can freely type commas, trailing spaces, etc. without the
  // input erasing them mid-keystroke. The parsed array (fAttributes[i].values)
  // is derived on each change for downstream logic and is only re-joined into
  // the draft on blur (see commitAttrValuesDraft below).
  const [attrDrafts, setAttrDrafts] = useState<Record<string, string>>({});

  useEffect(() => { loadProducts(); }, []);

  // The Save button is fixed at the bottom of a long form, so bring the error into view when it appears.
  useEffect(() => {
    if (formError) {
      formErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      formErrorRef.current?.focus({ preventScroll: true });
    }
  }, [formError]);

  async function loadProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (res.ok && data.products) {
        setProducts([...data.products].sort((a: any, b: any) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt)));
      }
    } catch (e) { console.error(e); }
  }

  const resetForm = () => {
    setFName(''); setFSlug(''); setFDesc(''); setFCategory('hardcase');
    setFStock(0); setFPrice(''); setFCompareAtPrice(''); setFIsActive(true);
    setFBadge(''); setFBadgeType('white'); setFFeatures(''); setFImages([]);
    setFProductType('simple'); setFSku('');
    setFAttributes([]); setFVariants([]);
    setAttrDrafts({});
    setEditSlug(''); setFormError('');
    setVariantsWithOrders(new Set());
  };

  const openAdd = () => { resetForm(); setFormView('add'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const openEdit = (p: Product) => {
    const pt = (p as any).productType ?? 'simple';
    setEditSlug(p.slug || '');
    setFName(p.name || '');
    setFSlug(p.slug || '');
    setFDesc(p.description || '');
    setFCategory((p.category || 'hardcase') as any);
    setFIsActive(p.isActive ?? true);
    setFBadge(p.badge || '');
    setFBadgeType(((p as any).badgeType || 'white') as any);
    setFFeatures(p.features?.join(', ') || '');
    setFImages(p.images?.length ? [...p.images] : (p.imageUrl ? [p.imageUrl] : []));
    setFProductType(pt);

    if (pt === 'simple') {
      setFStock((p as any).stock ?? 0);
      setFPrice((p as any).price ? (p as any).price.toLocaleString('id-ID') : '');
      const comp = (p as any).compareAtPrice ?? (p as any).originalPrice ?? null;
      setFCompareAtPrice(comp ? comp.toLocaleString('id-ID') : '');
      setFSku((p as any).sku || '');
      setFAttributes([]); setFVariants([]);
    } else {
      setFStock(0); setFPrice(''); setFCompareAtPrice(''); setFSku('');
      const loadedAttrs: ProductAttribute[] = (p as any).attributes ?? [];
      setFAttributes(loadedAttrs);
      setAttrDrafts(Object.fromEntries(loadedAttrs.map(a => [a.id, a.values.join(', ')])));
      setFVariants((p as any).variants ?? []);

      // Cek variant mana yang pernah muncul di order \u2014 hanya itu yang boleh dihapus permanen.
      // Fetch di background; UI tidak阻塞 menunggu hasilnya.
      setVariantsWithOrders(new Set());
      fetch(`/api/products/${encodeURIComponent(p.slug || '')}/variant-orders`)
        .then(r => r.ok ? r.json() : { variantsWithOrders: [] })
        .then(data => {
          const ids = Array.isArray(data?.variantsWithOrders) ? data.variantsWithOrders : [];
          setVariantsWithOrders(new Set(ids.map((s: any) => String(s))));
        })
        .catch(() => { /* diamkan jika gagal */ });
    }

    setFormError('');
    setFormView('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => setFormView('list');
  const openDelete = (slug: string, name: string) => setDeleteTarget({ slug, name });
  const closeDelete = () => setDeleteTarget(null);

  const toggleExpand = (slug: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/products/' + deleteTarget.slug, { method: 'DELETE' });
      if (res.ok) { closeDelete(); loadProducts(); }
      else { alert(await readAdminError(res)); }
    } catch (e: any) { alert(e.message); }
  };

  // ── Attribute Builder ──────────────────────────────────────────────────────

  const addAttribute = () => {
    const id = crypto.randomUUID();
    setFAttributes(prev => [...prev, { id, name: '', values: [] }]);
    setAttrDrafts(prev => ({ ...prev, [id]: '' }));
  };

  const removeAttribute = (idx: number) => {
    const removed = fAttributes[idx];
    setFAttributes(prev => prev.filter((_, i) => i !== idx));
    if (removed) {
      setAttrDrafts(prev => { const { [removed.id]: _drop, ...rest } = prev; return rest; });
    }
  };

  const updateAttrName = (idx: number, name: string) => {
    setFAttributes(prev => prev.map((a, i) => i === idx ? { ...a, name } : a));
  };

  // Update the raw input draft (controlled input value) AND derive the parsed
  // array in the same keystroke so combinationCount stays live. The draft is
  // the source of truth for the input, so commas, trailing spaces, and empty
  // segments are preserved as the user types.
  const updateAttrValuesDraft = (idx: number, raw: string) => {
    const attr = fAttributes[idx];
    if (!attr) return;
    setAttrDrafts(prev => ({ ...prev, [attr.id]: raw }));
    const values = raw.split(',').map(v => v.trim()).filter(Boolean);
    setFAttributes(prev => prev.map((a, i) => i === idx ? { ...a, values } : a));
  };

  // On blur, normalize the draft to match the canonical parsed array so any
  // trailing comma / extra whitespace is cleaned up for visual consistency.
  const commitAttrValuesDraft = (idx: number) => {
    const attr = fAttributes[idx];
    if (!attr) return;
    const normalized = attr.values.join(', ');
    setAttrDrafts(prev => prev[attr.id] === normalized ? prev : { ...prev, [attr.id]: normalized });
  };

  const combinationCount = useMemo(() => countCombinations(fAttributes.filter(a => a.name && a.values.length)), [fAttributes]);

  const generateVariantsFromAttrs = () => {
    const validAttrs = fAttributes.filter(a => a.name.trim() && a.values.length);
    if (!validAttrs.length) { alert('Tambahkan minimal 1 atribut dengan nilai'); return; }
    const generated = generateVariants(validAttrs, fVariants, { price: 0, compareAtPrice: null, stock: 0 });
    setFVariants(generated);
  };

  // ── Variant Table Updates ──────────────────────────────────────────────────

  const updateVariant = (variationId: string, field: keyof FormVariant, value: any) => {
    setFVariants(prev => prev.map(v => v.variationId === variationId ? { ...v, [field]: value } : v));
  };

  // Hapus variant dari form state. Hanya variant yang belum pernah di-order
  // yang boleh dihapus. Perubahan baru tersimpan setelah klik Simpan.
  const deleteVariant = (variationId: string) => {
    if (variantsWithOrders.has(variationId)) return;
    const variant = fVariants.find(v => v.variationId === variationId);
    if (!variant) return;
    const label = Object.entries(variant.attributes || {}).map(([, val]) => val).join(' / ') || variant.sku || variationId;
    if (!window.confirm(`Hapus variant "${label}"?\n\nPerubahan baru berlaku setelah klik Simpan.`)) return;
    setFVariants(prev => prev.filter(v => v.variationId !== variationId));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    if (!fSlug) { setFormError('Slug kosong, pastikan nama produk diisi.'); setSaving(false); return; }

    if (fProductType === 'variable') {
      if (fAttributes.length === 0) {
        setFormError('Produk variasi wajib memiliki minimal 1 atribut (contoh: Warna, Ukuran). Tambahkan atribut terlebih dahulu.'); setSaving(false); return;
      }
      const emptyAttr = fAttributes.find(a => !a.values || a.values.map(v => v.trim()).filter(Boolean).length === 0);
      if (emptyAttr) {
        setFormError(`Atribut "${emptyAttr.name}" belum memiliki nilai. Tambahkan minimal 1 nilai pada setiap atribut.`); setSaving(false); return;
      }
    }

    let data: any = {
      name: fName,
      slug: fSlug,
      description: fDesc,
      category: fCategory,
      isActive: fIsActive,
      badge: fBadge || null,
      badgeType: fBadgeType,
      features: fFeatures ? fFeatures.split(',').map(f => f.trim()).filter(Boolean) : [],
      images: fImages,
      imageUrl: fImages[0] || '',
      productType: fProductType,
    };

    if (fProductType === 'simple') {
      const priceVal = parseInt(fPrice.replace(/\D/g, '')) || 0;
      const compVal = parseInt(fCompareAtPrice.replace(/\D/g, '')) || 0;
      data = { ...data, price: priceVal, compareAtPrice: compVal > priceVal ? compVal : null, stock: fStock, sku: fSku || null };
    } else {
      data = { ...data, attributes: fAttributes, variants: fVariants };
    }

    try {
      let url = '/api/products';
      let method = 'POST';

      const renamedFrom = formView === 'edit' && editSlug && editSlug !== fSlug ? editSlug : null;
      if (formView === 'edit' && !renamedFrom) {
        url = '/api/products/' + (editSlug || fSlug);
        method = 'PUT';
      }

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) {
        setFormError(await readAdminError(res));
        return;
      }

      // Delete the old slug only after the new one is saved, so a rejected save never loses the product.
      if (renamedFrom) {
        const del = await fetch('/api/products/' + renamedFrom, { method: 'DELETE' });
        if (!del.ok) {
          loadProducts();
          setFormError(`Tersimpan dengan slug baru, tetapi produk lama "${renamedFrom}" gagal dihapus. Hapus manual dari daftar agar stok tidak ganda.`);
          return;
        }
      }

      loadProducts();
      setFormView('list');
    } catch (err: any) {
      console.error(err);
      setFormError('Gagal terhubung ke server: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const pagedProducts = products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (formView !== 'list') {
    const activeVariants = fVariants.filter(v => v.isActive);
    const inactiveVariants = fVariants.filter(v => !v.isActive);

    return (
      <div className="prod-form-page">
        <div className="prod-form-topbar">
          <button className="prod-form-back" onClick={cancelForm}><ArrowLeft size={18} /><span>Kembali</span></button>
          <h1 className="prod-form-title">{formView === 'edit' ? 'Edit Produk' : 'Tambah Produk'}</h1>
          <div style={{ width: 100 }} />
        </div>

        {formError && <div ref={formErrorRef} tabIndex={-1} role="alert" className="form-error prod-form-error">{formError}</div>}

        <form onSubmit={handleSubmit} className="prod-form-layout">
          <div className="prod-form-main">
            {/* ── Informasi Utama ────────────────────────────────────── */}
            <div className="prod-form-card">
              <div className="prod-form-card-title">Informasi Utama</div>
              <div className="prod-form-fields">
                <div className="form-group">
                  <label className="form-label">Nama Produk *</label>
                  <input
                    name="name" className="form-input" required value={fName}
                    onChange={e => { setFName(e.target.value); setFSlug(generateSlug(e.target.value)); }}
                    placeholder="Contoh: Hardcase Yamaha NMAX 2024"
                  />
                  {fSlug && <small className="prod-slug-preview">URL: <strong>/produk/{fSlug}</strong></small>}
                </div>

                {/* productType toggle */}
                <div className="form-group">
                  <label className="form-label">Tipe Produk *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['simple', 'variable'] as const).map(pt => (
                      <button
                        key={pt} type="button"
                        onClick={() => setFProductType(pt)}
                        style={{
                          padding: '8px 20px', borderRadius: 8, border: '1px solid',
                          borderColor: fProductType === pt ? '#1a1a1a' : '#E5E7EB',
                          background: fProductType === pt ? '#1a1a1a' : '#fff',
                          color: fProductType === pt ? '#fff' : '#374151',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {pt === 'simple' ? 'Simple' : 'Variable (Variasi)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kategori *</label>
                    <select className="form-input" value={fCategory} onChange={e => setFCategory(e.target.value as any)}>
                      <option value="hardcase">Hardcase</option>
                      <option value="softcase">Softcase</option>
                      <option value="tank">Tank Bag</option>
                    </select>
                  </div>
                  {fProductType === 'simple' && (
                    <div className="form-group">
                      <label className="form-label">Stok *</label>
                      <input type="number" className="form-input" min={0} value={fStock} onChange={e => setFStock(parseInt(e.target.value) || 0)} />
                      <small className="prod-form-hint">Stok untuk produk tanpa variasi. Jika produk punya variasi, stok diatur per variant di tabel bawah.</small>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={String(fIsActive)} onChange={e => setFIsActive(e.target.value === 'true')}>
                      <option value="true">Aktif</option>
                      <option value="false">Nonaktif</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deskripsi ──────────────────────────────────────────── */}
            <div className="prod-form-card prod-desc-card">
              <div className="prod-desc-header">
                <div className="prod-desc-header-left">
                  <div className="prod-desc-header-title">Deskripsi Produk</div>
                  <span className="prod-desc-hint">Tulis deskripsi lengkap untuk membantu customer memahami produk</span>
                </div>
                <span className="prod-desc-count-badge">{fDesc.length} karakter</span>
              </div>
              <div className="prod-desc-textarea-wrap">
                <textarea className="prod-desc-textarea" value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Deskripsi produk..." />
              </div>
              <div className="prod-desc-footer">
                <span className="prod-desc-tips"><kbd>Enter</kbd> baris baru</span>
                {fDesc.length > 0 && <span className="prod-desc-count">~{Math.ceil(fDesc.length / 60)} baris</span>}
              </div>
            </div>

            {/* ── Gambar ─────────────────────────────────────────────── */}
            {fProductType === 'simple' ? (
              <div className="prod-form-card prod-images-card">
                <div className="prod-form-card-title">Gambar produk (maks 3)</div>
                <ImageUpload value={fImages} onChange={setFImages} max={3} />
              </div>
            ) : (
              <div className="prod-form-card prod-main-image-card">
                <div className="prod-form-card-title">Gambar utama</div>
                <ImageUpload value={fImages} onChange={setFImages} max={1} />
                <small className="prod-form-hint">Gambar ini menjadi pratinjau di admin dan gambar utama pada kartu produk di sisi pelanggan.</small>
              </div>
            )}

            {/* ── Attribute Builder (variable only) ─────────────────── */}
            {fProductType === 'variable' && (
              <div className="prod-form-card">
                <div className="prod-form-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Atribut Variasi</span>
                  <button type="button" onClick={addAttribute} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', border: '1px solid #1a1a1a', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    <Plus size={12} /> Tambah Atribut
                  </button>
                </div>

                {fAttributes.length === 0 && (
                  <p style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>Belum ada atribut. Contoh: Warna, Ukuran.</p>
                )}

                {fAttributes.map((attr, idx) => (
                  <div key={attr.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 8, background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input
                        className="form-input" value={attr.name}
                        onChange={e => updateAttrName(idx, e.target.value)}
                        placeholder="Nama atribut (contoh: Warna)"
                        style={{ flex: '0 0 160px', fontSize: 13 }}
                      />
                      <button type="button" onClick={() => removeAttribute(idx)} style={{ padding: '4px 8px', border: '1px solid #FCA5A5', borderRadius: 6, background: '#FEF2F2', color: '#EF4444', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      className="form-input" value={attrDrafts[attr.id] ?? ''}
                      onChange={e => updateAttrValuesDraft(idx, e.target.value)}
                      onBlur={() => commitAttrValuesDraft(idx)}
                      placeholder="Nilai: Merah, Biru, Hijau (pisahkan koma)"
                      style={{ fontSize: 13 }}
                    />
                    {attr.values.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {attr.values.map(v => <span key={v} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #E5E7EB', borderRadius: 20, background: '#fff', color: '#374151' }}>{v}</span>)}
                      </div>
                    )}
                  </div>
                ))}

                {fAttributes.length > 0 && combinationCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <span style={{ fontSize: 13, color: '#6B7280' }}>
                      {combinationCount} kombinasi tersedia
                    </span>
                    <button
                      type="button"
                      onClick={generateVariantsFromAttrs}
                      style={{ fontSize: 12, padding: '6px 16px', border: '1px solid #1a1a1a', borderRadius: 6, background: '#1a1a1a', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Generate Variasi
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Variant Table (variable only) ─────────────────────── */}
            {fProductType === 'variable' && fVariants.length > 0 && (
              <div className="prod-form-card">
                <div className="prod-form-card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Tabel Variasi ({activeVariants.length} aktif)</span>
                  {inactiveVariants.length > 0 && (
                    <button type="button" onClick={() => setShowInactiveVariants(p => !p)} style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      {showInactiveVariants ? 'Sembunyikan' : `Tampilkan ${inactiveVariants.length} nonaktif`}
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Variasi</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>SKU</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Harga *</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Harga Coret</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Stok</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Gambar</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>Aktif</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#374151', width: 50 }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...activeVariants, ...(showInactiveVariants ? inactiveVariants : [])].map(v => {
                        const label = Object.entries(v.attributes).map(([, val]) => val).join(' / ');
                        return (
                          <tr key={v.variationId} style={{ borderBottom: '1px solid #F3F4F6', opacity: v.isActive ? 1 : 0.5 }}>
                            <td style={{ padding: '6px 10px', fontWeight: 500, color: '#374151' }}>{label}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                className="form-input" value={v.sku ?? ''} placeholder="SKU-001"
                                onChange={e => updateVariant(v.variationId, 'sku', e.target.value)}
                                style={{ width: 90, fontSize: 12, padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="number" className="form-input" value={v.price ?? ''} placeholder="0"
                                min={0}
                                onChange={e => updateVariant(v.variationId, 'price', parseFloat(e.target.value) || 0)}
                                style={{ width: 90, fontSize: 12, padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="number" className="form-input" value={v.compareAtPrice ?? ''} placeholder="-"
                                min={0}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateVariant(v.variationId, 'compareAtPrice', val > 0 ? val : null);
                                }}
                                style={{ width: 90, fontSize: 12, padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                type="number" className="form-input" value={v.stock ?? 0} min={0}
                                onChange={e => updateVariant(v.variationId, 'stock', parseInt(e.target.value) || 0)}
                                style={{ width: 70, fontSize: 12, padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <ImageUpload
                                value={v.images || []}
                                onChange={urls => updateVariant(v.variationId, 'images', urls)}
                                max={1}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox" checked={v.isActive}
                                onChange={e => updateVariant(v.variationId, 'isActive', e.target.checked)}
                                style={{ cursor: 'pointer', width: 16, height: 16 }}
                              />
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {variantsWithOrders.has(v.variationId) ? (
                                <span
                                  title="Variant ini pernah muncul di order, tidak dapat dihapus. Nonaktifkan sebagai gantinya."
                                  style={{ display: 'inline-flex', cursor: 'not-allowed', opacity: 0.35 }}
                                >
                                  <Trash2 size={14} color="#9CA3AF" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => deleteVariant(v.variationId)}
                                  title="Hapus variant"
                                  aria-label="Hapus variant"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'inline-flex', color: '#EF4444', borderRadius: 4 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FEF2F2'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {activeVariants.length > 0 && (() => {
                  const { priceFrom, priceTo } = computePriceRange(activeVariants);
                  return priceFrom != null ? (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#6B7280', padding: '8px 10px', background: '#F9FAFB', borderRadius: 6 }}>
                      Rentang harga: <strong>{priceFrom === priceTo ? formatPrice(priceFrom) : `${formatPrice(priceFrom)} – ${formatPrice(priceTo ?? 0)}`}</strong>
                      {' · '}Total stok: <strong>{activeVariants.reduce((s, v) => s + (v.stock ?? 0), 0)}</strong>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <div className="prod-form-sidebar">
            {/* Harga (simple only) */}
            {fProductType === 'simple' && (
              <div className="prod-form-card">
                <div className="prod-form-card-title">Harga</div>
                <div className="prod-form-fields">
                  <div className="form-group">
                    <label className="form-label">Harga Jual *</label>
                    <input
                      type="text" className="form-input" value={fPrice} placeholder="0" required
                      onChange={e => setFPrice(e.target.value.replace(/\D/g, '').replace(/^0+/, '') ? parseInt(e.target.value.replace(/\D/g, '') || '0').toLocaleString('id-ID') : '')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Harga Coret</label>
                    <input
                      type="text" className="form-input" value={fCompareAtPrice} placeholder="0"
                      onChange={e => setFCompareAtPrice(e.target.value.replace(/\D/g, '').replace(/^0+/, '') ? parseInt(e.target.value.replace(/\D/g, '') || '0').toLocaleString('id-ID') : '')}
                    />
                    {fCompareAtPrice && parseInt(fCompareAtPrice.replace(/\D/g, '')) > parseInt(fPrice.replace(/\D/g, '')) && (
                      <small style={{ color: '#059669', fontSize: 11, marginTop: 4, display: 'block' }}>
                        Diskon {Math.round(((parseInt(fCompareAtPrice.replace(/\D/g, '')) - parseInt(fPrice.replace(/\D/g, ''))) / parseInt(fCompareAtPrice.replace(/\D/g, ''))) * 100)}%
                      </small>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <input type="text" className="form-input" value={fSku} onChange={e => setFSku(e.target.value)} placeholder="SKU-001" />
                  </div>
                </div>
              </div>
            )}

            {/* Badge & Features */}
            <div className="prod-form-card">
              <div className="prod-form-card-title">Badge & Features</div>
              <div className="prod-form-fields">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Badge</label>
                    <select className="form-input" value={fBadge} onChange={e => setFBadge(e.target.value)}>
                      <option value="">Tanpa</option>
                      <option value="BEST SELLER">BEST SELLER</option>
                      <option value="NEW">NEW</option>
                      <option value="SALE">SALE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Style</label>
                    <select className="form-input" value={fBadgeType} onChange={e => setFBadgeType(e.target.value as any)}>
                      <option value="white">White</option>
                      <option value="outline">Outline</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Features</label>
                  <input className="form-input" value={fFeatures} onChange={e => setFFeatures(e.target.value)} placeholder="ABS, Anti Gores, Plug & Play" />
                  <small style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, display: 'block' }}>Pisahkan dengan koma</small>
                </div>
              </div>
            </div>

            {fName && (() => {
              // ── Hitung effective price (sama logika dengan ProductCard.tsx) ──
              let effectivePrice = 0;
              let effectiveCompareAtPrice: number | undefined;

              if (fProductType === 'simple') {
                effectivePrice = parseInt((fPrice || '0').replace(/\D/g, '')) || 0;
                const cmp = parseInt((fCompareAtPrice || '0').replace(/\D/g, '')) || 0;
                if (cmp > effectivePrice) effectiveCompareAtPrice = cmp;
              } else {
                const active = fVariants.filter(v => v.isActive);
                const prices = active.map(v => v.price || 0).filter(p => p > 0);
                effectivePrice = prices.length > 0 ? Math.min(...prices) : 0;
                const compareAts = active.map(v => v.compareAtPrice || 0).filter(c => c > 0);
                const maxCmp = compareAts.length > 0 ? Math.max(...compareAts) : 0;
                if (maxCmp > effectivePrice) effectiveCompareAtPrice = maxCmp;
              }

              const discount = calcDiscount(effectiveCompareAtPrice, effectivePrice);
              const featuresArr = fFeatures
                ? fFeatures.split(',').map(f => f.trim()).filter(Boolean)
                : [];
              const stockCount = fProductType === 'simple'
                ? fStock
                : fVariants.filter(v => v.isActive).reduce((sum, v) => sum + (v.stock || 0), 0);

              return (
                <div className="prod-form-card">
                  <div className="prod-form-card-title">Preview</div>
                  <div style={{ padding: 16, background: '#F9FAFB', borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
                    <div className="product-card" data-category={fCategory} style={{ maxWidth: 280, width: '100%' }}>
                      <div className="product-card-image">
                        {fBadge && <span className={`product-badge badge-${fBadgeType || 'white'}`}>{fBadge}</span>}
                        {fImages[0] ? (
                          <img src={optimizeCloudinaryUrl(fImages[0], 800)} alt={fName} />
                        ) : (
                          <div className="img-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                              <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                            <span>{fName}</span>
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="product-image-discount">DISKON {discount}%</div>
                        )}
                      </div>

                      <div className="product-card-body">
                        <div className="product-card-category">{fCategory}</div>
                        <h3 className="product-card-name">{fName}</h3>
                        {fDesc && <p className="product-card-desc">{fDesc}</p>}

                        {featuresArr.length > 0 && (
                          <div className="product-card-features">
                            {featuresArr.map((f, i) => (
                              <span key={i} className="product-feature-tag">{f}</span>
                            ))}
                          </div>
                        )}

                        <div className="product-stock">
                          <span className={`stock-dot ${stockCount <= 10 ? 'low-stock' : 'in-stock'}`} />
                          <span className="stock-text">
                            {stockCount <= 10 ? `Sisa ${stockCount} unit` : 'Tersedia'}
                          </span>
                        </div>

                        <div className="product-price-section">
                          {effectiveCompareAtPrice && effectiveCompareAtPrice > effectivePrice && (
                            <div className="product-price-original">{formatPrice(effectiveCompareAtPrice)}</div>
                          )}
                          <div className="product-price-current">
                            {formatPrice(effectivePrice)}
                            {discount > 0 && <span className="product-price-discount">-{discount}%</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Produk</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Produk</button>
      </div>

      {products.length === 0 ? (
        <div className="prod-empty"><Package size={40} strokeWidth={1.2} /><p>Belum ada produk.</p></div>
      ) : (
        <>
          <div className="prod-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {pagedProducts.map(p => {
                    const thumb = p.images?.[0] || p.imageUrl;
                    const isVar = (p as any).productType === 'variable';
                    const pFrom = (p as any).priceFrom;
                    const pTo = (p as any).priceTo;
                    const price = (p as any).price ?? 0;
                    const comp = (p as any).compareAtPrice ?? (p as any).originalPrice ?? 0;
                    const stock = isVar ? ((p as any).totalStock ?? 0) : ((p as any).stock ?? 0);
                    const variantCount = isVar ? ((p as any).variants?.filter((v: any) => v.isActive).length ?? 0) : null;

                    return (
                      <tr key={p.slug}>
                        <td>
                          <div className="table-product-cell">
                            {thumb ? <img src={optimizeCloudinaryUrl(thumb, 100)} className="table-product-thumb" alt="" loading="lazy" /> : <div className="table-product-thumb-placeholder"><Package size={16} /></div>}
                            <div>
                              <div className="table-product-name">{p.name}</div>
                              {isVar && <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{variantCount} variasi aktif</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{getCategoryLabel(p.category)}</td>
                        <td style={{ fontSize: 12 }}>
                          {isVar ? (
                            pFrom != null ? (
                              <span style={{ fontWeight: 600 }}>
                                {pFrom === pTo ? formatPrice(pFrom) : `${formatPrice(pFrom)} – ${formatPrice(pTo ?? 0)}`}
                              </span>
                            ) : <span style={{ color: '#9CA3AF' }}>-</span>
                          ) : (
                            <>
                              {comp > price && <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through', marginBottom: 1 }}>{formatPrice(comp)}</div>}
                              <span style={{ fontWeight: 600 }}>{formatPrice(price)}</span>
                            </>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <span style={{ color: stock <= 5 ? '#EF4444' : '#374151', fontWeight: stock <= 5 ? 600 : 400 }}>{stock}</span>
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

          {/* Mobile accordion — simplified for variable products */}
          <div className="prod-mobile-accordion">
            {pagedProducts.map(p => {
              const isExpanded = expandedProducts.has(p.slug);
              const thumb = p.images?.[0] || p.imageUrl;
              const isVar = (p as any).productType === 'variable';
              const pFrom = (p as any).priceFrom;
              const pTo = (p as any).priceTo;
              const price = (p as any).price ?? 0;
              const comp = (p as any).compareAtPrice ?? (p as any).originalPrice ?? 0;
              const stock = isVar ? ((p as any).totalStock ?? 0) : ((p as any).stock ?? 0);

              const priceLabel = isVar && pFrom != null
                ? (pFrom === pTo ? formatPrice(pFrom) : `${formatPrice(pFrom)} – ${formatPrice(pTo ?? 0)}`)
                : formatPrice(price);

              return (
                <div key={p.slug} className={`prod-accordion-card ${isExpanded ? 'expanded' : ''}`}>
                  <button className="prod-accordion-header" onClick={() => toggleExpand(p.slug)}>
                    <div className="prod-accordion-left">
                      <div className="prod-accordion-thumb">
                        {thumb ? <img src={optimizeCloudinaryUrl(thumb, 100)} alt="" loading="lazy" /> : <Package size={16} color="#ccc" />}
                      </div>
                      <div className="prod-accordion-identity">
                        <span className="prod-accordion-name">{p.name}</span>
                        <span className="prod-accordion-category"><Layers size={10} />{getCategoryLabel(p.category)}</span>
                      </div>
                    </div>
                    <div className="prod-accordion-right">
                      <div className="prod-accordion-price-col">
                        {!isVar && comp > price && <span className="prod-price-old">{formatPrice(comp)}</span>}
                        <span className="prod-price-now">{priceLabel}</span>
                      </div>
                      <ChevronDown size={16} className={`prod-accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </button>

                  <div className="prod-accordion-body">
                    <div className="prod-accordion-body-inner">
                      <div className="prod-accordion-row">
                        <span className="prod-accordion-label">Status</span>
                        {p.isActive ? <span className="prod-status-badge prod-status-active">Aktif</span> : <span className="prod-status-badge prod-status-inactive">Nonaktif</span>}
                      </div>
                      <div className="prod-accordion-row">
                        <span className="prod-accordion-label"><Archive size={11} /> Stok</span>
                        <span className={`prod-accordion-value ${stock <= 5 ? 'prod-stock-low' : ''}`}>
                          {stock} {stock <= 5 && stock > 0 ? '(Stok rendah!)' : stock === 0 ? '(Habis)' : ''}
                        </span>
                      </div>
                      {p.badge && (
                        <div className="prod-accordion-row">
                          <span className="prod-accordion-label"><Tag size={11} /> Badge</span>
                          <span className="prod-badge-tag">{p.badge}</span>
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
