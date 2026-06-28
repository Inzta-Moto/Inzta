'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatPrice, calcDiscount, buildWaLink, optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';
import { matchVariant, isSelectionComplete, generateLabel } from '@/lib/product-utils';
import { Truck, ShieldCheck, RefreshCw, Headphones, LucideIcon, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Tag, TicketCheck, TicketX } from 'lucide-react';
import Header from '@/components/Header';
import VariantSelector from '@/components/VariantSelector';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const Footer = dynamic(() => import('@/components/Footer'));
const ProductCard = dynamic(() => import('@/components/ProductCard'));
import type { Product, SimpleProduct, VariableProduct, ProductVariant, Voucher } from '@/types';

export default function DetailClient({ slug, initialProduct, initialRelated }: {
  slug: string;
  initialProduct?: any;
  initialRelated?: any[];
}) {
  const [product, setProduct] = useState<Product | null>(initialProduct || null);
  const [related, setRelated] = useState<Product[]>(initialRelated || []);
  const [loading, setLoading] = useState<boolean>(!initialProduct);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState<number>(0);

  // ── Variant state ──────────────────────────────────────────────────────────
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  // Catatan: tidak ada auto-select default variant lagi. User harus memilih
  // variasi secara manual sebelum checkout. Gallery awal tetap menampilkan
  // gambar utama produk sampai user memilih variant.

  const selectedVariant = useMemo((): ProductVariant | null => {
    if (!product || product.productType !== 'variable') return null;
    return matchVariant(product.variants, selectedAttributes, product.attributes);
  }, [product, selectedAttributes]);

  // Gallery: gabungkan gambar utama + gambar SEMUA variant (unique).
  // Urutan: gambar utama dulu, lalu gambar variant. Dedupe untuk mencegah
  // gambar yang sama tampil dua kali jika main image = variant image.
  // Gallery tidak pernah "hilang" saat variant dipilih \u2014 semua thumbs tetap
  // tampil, hanya activeImg yang loncat ke gambar variant tsb.
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const mainImages = product.images?.length
      ? product.images
      : (product.imageUrl ? [product.imageUrl] : []);
    const variantImages: string[] =
      product.productType === 'variable'
        ? product.variants.flatMap(v => v.images || [])
        : [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of [...mainImages, ...variantImages]) {
      if (url && !seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
    return result;
  }, [product]);

  // Saat variant dipilih, otomatis loncat ke gambar pertama variant tersebut.
  // Saat variant di-reset (tidak ada variant dipilih), kembali ke gambar utama.
  useEffect(() => {
    if (selectedVariant?.images?.length) {
      const idx = galleryImages.indexOf(selectedVariant.images[0]);
      setActiveImg(idx >= 0 ? idx : 0);
    } else {
      setActiveImg(0);
    }
  }, [selectedVariant, galleryImages]);

  // Resolved price/stock for simple or matched variable
  const resolvedPrice = useMemo(() => {
    if (!product) return 0;
    if (product.productType === 'simple') return (product as SimpleProduct).price;
    return selectedVariant?.price ?? (product as VariableProduct).priceFrom ?? 0;
  }, [product, selectedVariant]);

  const resolvedCompareAtPrice = useMemo(() => {
    if (!product) return null;
    if (product.productType === 'simple') return (product as SimpleProduct).compareAtPrice ?? (product as any).originalPrice ?? null;
    // Variable product
    if (selectedVariant) return selectedVariant.compareAtPrice ?? null;
    // No variant selected: derive max compareAtPrice from all active variants
    const variants = (product as VariableProduct).variants;
    if (!variants || variants.length === 0) return null;
    const maxCompareAt = Math.max(...variants.filter(v => v.isActive).map(v => v.compareAtPrice || 0));
    return maxCompareAt > 0 ? maxCompareAt : null;
  }, [product, selectedVariant]);

  const resolvedStock = useMemo(() => {
    if (!product) return 0;
    if (product.productType === 'simple') return (product as SimpleProduct).stock;
    return selectedVariant?.stock ?? 0;
  }, [product, selectedVariant]);

  const selectionComplete = useMemo(() => {
    if (!product || product.productType !== 'variable') return true;
    return isSelectionComplete(product.attributes, selectedAttributes);
  }, [product, selectedAttributes]);

  // ── Lightbox ───────────────────────────────────────────────────────────────
  const [lightbox, setLightbox] = useState<boolean>(false);
  const [lightboxImg, setLightboxImg] = useState<number>(0);
  const [zoomed, setZoomed] = useState<boolean>(false);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // ── Voucher ────────────────────────────────────────────────────────────────
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherData, setVoucherData] = useState<Voucher | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // ── Quantity ───────────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1);

  // ── Order ──────────────────────────────────────────────────────────────────
  const [orderLoading, setOrderLoading] = useState(false);
  const [buyerUID, setBuyerUID] = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };

  const imagesLenRef = useRef(0);
  useEffect(() => { imagesLenRef.current = galleryImages.length; }, [galleryImages]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isAffiliate = localStorage.getItem('is_affiliate_logged_in') === 'true';
      setBuyerUID(user && isAffiliate ? user.uid : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (slug && !initialProduct) loadProduct();
  }, [slug, initialProduct]);

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${slug}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Produk tidak ditemukan'); return; }
      setProduct(data.product as Product);

      const relRes = await fetch('/api/products');
      const relData = await relRes.json();
      if (relRes.ok && relData.products) {
        setRelated((relData.products as Product[]).filter((p) => p.isActive && p.slug !== slug).slice(0, 4));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Auto-apply affiliate voucher & recalculate on price/quantity change ────
  useEffect(() => {
    if (!product) return;

    const recalcDiscount = (v: Voucher, base: number) => {
      let disc = v.type === 'percentage' ? (base * v.value) / 100 : v.value;
      if (v.type === 'percentage' && v.maxDiscount && disc > v.maxDiscount) disc = v.maxDiscount;
      return Math.round(Math.min(disc, base));
    };

    if (!voucherData && !voucherError && !voucherInput) {
      const affiliateId = localStorage.getItem('inzta_affiliate');
      if (!affiliateId) return;

      (async () => {
        try {
          setVoucherLoading(true);
          const res = await fetch(`/api/vouchers/resolve?affiliateId=${affiliateId}`);
          const data = await res.json();
          if (res.status !== 200) { showToast(data.error || 'Gagal menerapkan voucher'); return; }

          const v = data.voucher as Voucher;
          const subtotal = resolvedPrice * quantity;
          if (v.minPurchase && subtotal < v.minPurchase) {
            showToast(`Minimal pembelian ${formatPrice(v.minPurchase)} tidak terpenuhi.`); return;
          }
          setVoucherInput(v.code);
          setVoucherData(v);
          setDiscountAmount(recalcDiscount(v, subtotal));
        } catch { showToast('Koneksi bermasalah.'); }
        finally { setVoucherLoading(false); }
      })();
    } else if (voucherData) {
      const subtotal = resolvedPrice * quantity;
      if (voucherData.minPurchase && subtotal < voucherData.minPurchase) {
        removeVoucher();
        const msg = `Voucher dilepas. Minimal pembelian ${formatPrice(voucherData.minPurchase)}.`;
        setVoucherError(msg); showToast(msg);
        return;
      }
      setDiscountAmount(recalcDiscount(voucherData, subtotal));
    }
  }, [product?.slug, resolvedPrice, quantity]);

  // ── Voucher ────────────────────────────────────────────────────────────────
  const applyVoucher = async () => {
    if (!voucherInput.trim() || !product) return;
    setVoucherLoading(true); setVoucherError(''); setVoucherData(null); setDiscountAmount(0);

    try {
      const code = voucherInput.trim().toUpperCase();
      const res = await fetch(`/api/vouchers/validate?code=${code}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.toLowerCase().includes('batas')) showToast(data.error);
        setVoucherError(data.error || 'Voucher tidak ditemukan.');
        return;
      }

      const v = data.voucher as Voucher;
      const subtotal = resolvedPrice * quantity;
      if (v.minPurchase && subtotal < v.minPurchase) {
        const msg = `Minimal pembelian ${formatPrice(v.minPurchase)} tidak terpenuhi.`;
        setVoucherError(msg); showToast(msg); return;
      }

      let disc = v.type === 'percentage' ? (subtotal * v.value) / 100 : v.value;
      if (v.type === 'percentage' && v.maxDiscount && disc > v.maxDiscount) disc = v.maxDiscount;
      setVoucherData(v);
      setDiscountAmount(Math.round(Math.min(disc, subtotal)));
    } catch { setVoucherError('Gagal memvalidasi voucher.'); }
    finally { setVoucherLoading(false); }
  };

  const removeVoucher = () => { setVoucherInput(''); setVoucherData(null); setVoucherError(''); setDiscountAmount(0); };

  // ── Order ──────────────────────────────────────────────────────────────────
  const handleOrderClick = async () => {
    if (!product || orderLoading) return;
    if (!selectionComplete) { showToast('Pilih semua variasi terlebih dahulu'); return; }
    setOrderLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            productSlug: product.slug,
            variationId: selectedVariant?.variationId ?? null,
            quantity,
          }],
          voucherCode: voucherData?.code ?? null,
          affiliateId: voucherData?.affiliateId ?? null,
          buyerUID,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Gagal membuat pesanan');

      window.location.href = buildWaLink(data.orderId, data.items, {
        totalPrice: data.totalPrice,
        discountAmount: data.discountAmount,
        voucherCode: data.voucherCode,
        finalPrice: data.finalPrice,
      });
    } catch (e: any) {
      console.error('[Order Error]', e);
      alert('Gagal membuat pesanan: ' + e.message);
    } finally {
      setOrderLoading(false);
    }
  };

  // ── Lightbox ───────────────────────────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  useEffect(() => { setZoomed(false); setPanPos({ x: 0, y: 0 }); }, [lightboxImg]);

  const openLightbox = (index: number) => { setLightboxImg(index); setLightbox(true); };
  const closeLightbox = () => { setLightbox(false); setZoomed(false); setPanPos({ x: 0, y: 0 }); };

  const lightboxPrev = useCallback(() => {
    if (imagesLenRef.current <= 1) return;
    setLightboxImg(prev => (prev === 0 ? imagesLenRef.current - 1 : prev - 1));
  }, []);

  const lightboxNext = useCallback(() => {
    if (imagesLenRef.current <= 1) return;
    setLightboxImg(prev => (prev === imagesLenRef.current - 1 ? 0 : prev + 1));
  }, []);

  const toggleZoom = () => { if (zoomed) { setZoomed(false); setPanPos({ x: 0, y: 0 }); } else setZoomed(true); };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, lightboxPrev, lightboxNext]);

  const handleMouseDown = (e: React.MouseEvent) => { if (!zoomed) return; e.preventDefault(); setDragStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y }); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!zoomed || !dragStart) return; setPanPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); };
  const handleMouseUp = () => setDragStart(null);

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!product) return;
    const imageUrlRaw = galleryImages[activeImg] || product.imageUrl;
    try {
      if (imageUrlRaw && navigator.canShare?.({ files: [new File([new Blob()], 'image.jpg', { type: 'image/jpeg' })] })) {
        let absolute = imageUrlRaw;
        if (!imageUrlRaw.startsWith('http')) absolute = window.location.origin + (imageUrlRaw.startsWith('/') ? '' : '/') + imageUrlRaw;
        const blob = await (await fetch(`/api/proxy-image/preview.jpg?url=${encodeURIComponent(absolute)}`)).blob();
        await navigator.share({ files: [new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' })], title: product.name });
      } else throw new Error('not supported');
    } catch (e: any) { if (e.name !== 'AbortError') console.error('Share error:', e); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <><Header active="produk" /><section className="detail-section"><div className="container"><div className="detail-skeleton"><div className="detail-skeleton-image" /><div className="detail-skeleton-info" /></div></div></section><Footer /></>
  );

  if (error || !product) return (
    <><Header active="produk" /><section className="detail-section"><div className="container"><div className="empty-state"><p>{error || 'Produk tidak ditemukan'}</p><Link href="/produk" style={{ marginTop: '1rem', display: 'inline-block', color: '#0070f3' }}>Kembali ke halaman produk</Link></div></div></section><Footer /></>
  );

  const p = product;
  const isVariable = p.productType === 'variable';
  const vp = isVariable ? (p as VariableProduct) : null;
  const sp = !isVariable ? (p as SimpleProduct) : null;

  const subtotal = resolvedPrice * quantity;
  const finalPrice = subtotal - discountAmount;

  const discount = calcDiscount(resolvedCompareAtPrice ?? undefined, resolvedPrice);
  const savings = resolvedCompareAtPrice ? resolvedCompareAtPrice - resolvedPrice : 0;

  // Stock/availability
  const stockForDisplay = isVariable
    ? (selectionComplete ? resolvedStock : (vp!.totalStock ?? 0))
    : resolvedStock;
  const stockLabel = !selectionComplete ? null : stockForDisplay <= 10 ? `Sisa ${stockForDisplay} unit` : 'Tersedia';
  const stockCls = stockForDisplay <= 10 ? 'low-stock' : 'in-stock';

  const canOrder = selectionComplete && (isVariable ? resolvedStock > 0 : resolvedStock > 0);
  const maxQuantity = selectionComplete ? resolvedStock : 0;

  const trustItems: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: Truck, title: 'Pengiriman Cepat', desc: 'Paket dikirim 1-2 hari kerja' },
    { icon: ShieldCheck, title: 'Garansi Resmi', desc: 'Jaminan produk original 100%' },
    { icon: RefreshCw, title: 'Easy Return', desc: '7 hari pengembalian tanpa ribet' },
    { icon: Headphones, title: 'Support 24/7', desc: 'Tim kami selalu siap membantu' },
  ];

  const placeholderSvg = (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = 'none';
    if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'flex';
  };

  return (
    <>
      <Header active="produk" />

      <section className="detail-page-header">
        <div className="container">
          <div className="breadcrumb-wrapper">
            <nav className="breadcrumb">
              <Link href="/">Home</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/produk">Produk</Link>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{p.name}</span>
            </nav>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="container">
          <div className="detail-grid">
            {/* ── Image ──────────────────────────────────────────────────── */}
            <div className="detail-image-section">
              <div className="detail-image-wrapper detail-image-clickable" onClick={() => galleryImages.length > 0 && openLightbox(activeImg)}>
                {galleryImages.length > 0 ? (
                  <>
                    <img 
                      src={optimizeCloudinaryUrl(galleryImages[activeImg], 1200)}
                      srcSet={generateCloudinarySrcSet(galleryImages[activeImg], [600, 1000, 1400])}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      alt={p.name} 
                      onError={handleImgError} 
                    />
                    <div className="detail-image-placeholder" style={{ display: 'none' }}>{placeholderSvg}<span>{p.name}</span></div>
                    <div className="detail-image-zoom-hint"><ZoomIn size={18} /><span>Klik untuk zoom</span></div>
                  </>
                ) : (
                  <div className="detail-image-placeholder" style={{ display: 'flex' }}>{placeholderSvg}<span>{p.name}</span></div>
                )}
              </div>
              {galleryImages.length > 1 && (
                <div className="detail-gallery">
                  {galleryImages.map((img, i) => (
                    <button key={i} className={`detail-gallery-thumb ${i === activeImg ? 'active' : ''}`} onClick={() => setActiveImg(i)}>
                      <img src={optimizeCloudinaryUrl(img, 200)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Info ───────────────────────────────────────────────────── */}
            <div className="detail-info">
              <div className="detail-category">{p.category}</div>
              <h1 className="detail-name">{p.name}</h1>

              {/* Price box */}
              <div className="detail-price-box">
                <div className="detail-price-label">Harga</div>
                {resolvedCompareAtPrice && resolvedCompareAtPrice > resolvedPrice && (
                  <div className="detail-price-original">{formatPrice(resolvedCompareAtPrice)}</div>
                )}
                <div className="detail-price-row">
                  <span className="detail-price-current">
                    {quantity > 1 ? formatPrice(subtotal) : formatPrice(resolvedPrice)}
                  </span>
                  {discount > 0 && <span className="detail-price-discount">-{discount}%</span>}
                </div>
                {quantity > 1 && selectionComplete && (
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {formatPrice(resolvedPrice)} / item
                  </div>
                )}
                {savings > 0 && selectionComplete && (
                  <div className="detail-price-save">Hemat <span>{formatPrice(savings)}</span> dari harga normal</div>
                )}

                {voucherData && discountAmount > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)', border: '1px solid #a5d6a7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2e7d32', marginBottom: 4 }}>
                      <TicketCheck size={14} />
                      <strong>Voucher {voucherData.code} aktif!</strong>
                      <button onClick={removeVoucher} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', padding: 2 }}><TicketX size={14} /></button>
                    </div>
                    {buyerUID && voucherData.affiliateId && buyerUID === voucherData.affiliateId && (
                      <div style={{ fontSize: 11, color: '#2e7d32', marginBottom: 4, fontStyle: 'italic', fontWeight: 500 }}>
                        ℹ️ Voucher pribadi: Anda mendapatkan diskon, komisi tidak berlaku.
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#555' }}>
                      Diskon: <span style={{ color: '#d32f2f', fontWeight: 600 }}>-{formatPrice(discountAmount)}</span>
                      {voucherData.type === 'percentage' && voucherData.maxDiscount ? ` (maks ${formatPrice(voucherData.maxDiscount)})` : ''}
                    </div>
                  </div>
                )}
              </div>

              {p.features && p.features.length > 0 && (
                <div className="detail-features">
                  <div className="detail-features-label">Spesifikasi</div>
                  <div className="detail-features-list">
                    {p.features.map((f, i) => <span key={i} className="detail-feature-tag">{f}</span>)}
                  </div>
                </div>
              )}

              {/* ── Variant Selector ──────────────────────────────────── */}
              {isVariable && (
                <div style={{ marginBottom: 20 }}>
                  <div className="detail-features-label" style={{ marginBottom: 12 }}>Pilih Variasi</div>
                  <VariantSelector
                    attributes={vp!.attributes}
                    variants={vp!.variants.filter(v => v.isActive)}
                    selected={selectedAttributes}
                    onSelect={(attrName, value) => {
                      setSelectedAttributes(prev => ({ ...prev, [attrName]: value }));
                      setQuantity(1);
                    }}
                  />
                  {!selectionComplete && (
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>
                      Pilih semua variasi untuk melanjutkan
                    </p>
                  )}
                  {selectionComplete && selectedVariant && (
                    <div style={{ marginTop: 10, fontSize: 12, color: '#374151', background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', border: '1px solid #E5E7EB' }}>
                      {selectedVariant.sku && <span style={{ color: '#6B7280' }}>SKU: {selectedVariant.sku} &nbsp;·&nbsp; </span>}
                      {generateLabel(selectedVariant.attributes)}
                    </div>
                  )}
                </div>
              )}

              {/* ── Stock ─────────────────────────────────────────────── */}
              {(!isVariable || selectionComplete) && (
                <div className="detail-stock">
                  <span className={`detail-stock-dot ${stockCls}`} />
                  <span className="detail-stock-text">
                    <strong>{stockForDisplay === 0 ? 'Habis' : (stockLabel ?? 'Tersedia')}</strong>
                  </span>
                </div>
              )}

              {/* ── Quantity ──────────────────────────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <div className="detail-features-label">Jumlah</div>
                <div style={{ display: 'flex', alignItems: 'center', width: 'fit-content', border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-white)' }}>
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || !canOrder}
                    style={{ padding: '8px 14px', background: 'var(--bg-subtle)', border: 'none', cursor: (quantity <= 1 || !canOrder) ? 'not-allowed' : 'pointer', opacity: (quantity <= 1 || !canOrder) ? 0.5 : 1, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', borderRight: '1px solid var(--border-light)' }}
                  >-</button>
                  <div style={{ padding: '8px 24px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', minWidth: 40, textAlign: 'center' }}>{quantity}</div>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                    disabled={!canOrder || quantity >= maxQuantity}
                    style={{ padding: '8px 14px', background: 'var(--bg-subtle)', border: 'none', cursor: (!canOrder || quantity >= maxQuantity) ? 'not-allowed' : 'pointer', opacity: (!canOrder || quantity >= maxQuantity) ? 0.5 : 1, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', borderLeft: '1px solid var(--border-light)' }}
                  >+</button>
                </div>
              </div>

              {/* ── Voucher ───────────────────────────────────────────── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: voucherError ? 8 : 0 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Tag size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                      type="text" placeholder="Masukkan kode voucher" value={voucherInput}
                      onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                      onKeyDown={e => e.key === 'Enter' && applyVoucher()}
                      style={{ width: '100%', padding: '10px 12px 10px 36px', border: `1px solid ${voucherError ? '#ef4444' : '#ddd'}`, borderRadius: 8, fontSize: 13, outline: 'none', textTransform: 'uppercase', letterSpacing: 1 }}
                      disabled={!!voucherData}
                    />
                  </div>
                  {voucherData ? (
                    <button onClick={removeVoucher} style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>Hapus</button>
                  ) : (
                    <button onClick={applyVoucher} disabled={voucherLoading || !voucherInput.trim()} style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: (voucherLoading || !voucherInput.trim()) ? '#ccc' : '#1a1a1a', color: '#fff', cursor: (voucherLoading || !voucherInput.trim()) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {voucherLoading ? '...' : 'Pakai'}
                    </button>
                  )}
                </div>
                {voucherError && <div style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} /> {voucherError}</div>}
              </div>

              {/* ── Price summary ─────────────────────────────────────── */}
              {selectionComplete && (quantity > 1 || discountAmount > 0) && (
                <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 8, background: '#f8f9fa', border: '1px solid #e9ecef' }}>
                  {quantity > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 4 }}>
                      <span>Harga Satuan</span><span>{formatPrice(resolvedPrice)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333', fontWeight: 500, marginBottom: discountAmount > 0 ? 4 : 0 }}>
                    <span>Subtotal ({quantity} item)</span><span>{formatPrice(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#d32f2f', marginBottom: 8 }}>
                        <span>Diskon Voucher</span><span>-{formatPrice(discountAmount)}</span>
                      </div>
                      <div style={{ height: 1, background: '#e0e0e0', marginBottom: 8 }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                        <span>Total Bayar</span><span>{formatPrice(finalPrice)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── CTA ──────────────────────────────────────────────── */}
              <div className="detail-cta" style={{ marginTop: 20 }}>
                <button
                  className="btn-detail-wa"
                  onClick={handleOrderClick}
                  disabled={orderLoading || !canOrder || !selectionComplete}
                  style={{ opacity: (orderLoading || !canOrder || !selectionComplete) ? 0.6 : 1, cursor: (orderLoading || !canOrder || !selectionComplete) ? 'not-allowed' : 'pointer' }}
                >
                  {orderLoading ? (
                    <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1.5s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>Memproses...</>
                  ) : !selectionComplete ? (
                    'Pilih variasi terlebih dahulu'
                  ) : resolvedStock === 0 ? (
                    'Stok Habis'
                  ) : (
                    <><svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>Pesan via WhatsApp</>
                  )}
                </button>
              </div>

              {/* ── Share ────────────────────────────────────────────── */}
              <div className="detail-share">
                <button className="detail-share-btn detail-share-copy" onClick={() => {
                  if (!product) return;
                  const baseUrl = window.location.origin + window.location.pathname;
                  const affiliateId = localStorage.getItem('inzta_affiliate');
                  const shareUrl = affiliateId ? `${baseUrl}?aff=${affiliateId}` : baseUrl;
                  const priceStr = formatPrice(resolvedPrice);
                  const text = `*${product.name}*\n${product.description ? product.description.split('\n')[0] : ''}\n\nHarga: ${priceStr}\n\n${shareUrl}`;
                  navigator.clipboard.writeText(text);
                  const toast = document.getElementById('share-toast');
                  if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  <span>Salin Link</span>
                </button>
                <button className="detail-share-btn detail-share-wa" onClick={handleShare}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  <span>Bagikan Gambar</span>
                </button>
              </div>
              <div id="share-toast" className="toast">✓ Link berhasil disalin!</div>
            </div>
          </div>

          <div className={`toast ${toastMessage ? 'show' : ''}`} style={{ background: '#ef4444', borderColor: '#b91c1c' }}>
            {toastMessage}
          </div>

          <div className="detail-full-trust">
            {trustItems.map((item, i) => (
              <div className="detail-trust-item" key={i}>
                <div className="detail-trust-icon"><item.icon size={14} /></div>
                <div className="detail-trust-text"><strong>{item.title}</strong>{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="detail-full-desc"><p className="detail-desc">{p.description}</p></div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section related-section">
          <div className="container">
            <div className="section-header">
              <p className="section-eyebrow">Rekomendasi</p>
              <h2 className="section-title">Produk Lainnya</h2>
            </div>
            <div className="product-grid">
              {related.map(r => <ProductCard key={r.slug} product={r} showDetails={false} />)}
            </div>
          </div>
        </section>
      )}

      {lightbox && galleryImages.length > 0 && (
        <div className="lb-overlay" onClick={closeLightbox}>
          <div className="lb-container" onClick={e => e.stopPropagation()}>
            <div className="lb-topbar">
              <span className="lb-counter">{lightboxImg + 1} / {galleryImages.length}</span>
              <div className="lb-topbar-right">
                <button className="lb-btn" onClick={toggleZoom} title={zoomed ? 'Zoom Out' : 'Zoom In'}>{zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}</button>
                <button className="lb-btn" onClick={closeLightbox} title="Tutup"><X size={20} /></button>
              </div>
            </div>
            <div className={`lb-image-area ${zoomed ? 'zoomed' : ''}`} onClick={!zoomed ? toggleZoom : undefined} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              <img 
                src={optimizeCloudinaryUrl(galleryImages[lightboxImg], 1920)} 
                srcSet={generateCloudinarySrcSet(galleryImages[lightboxImg], [800, 1200, 1920, 2500])}
                sizes="100vw"
                alt="" 
                style={zoomed ? { transform: `scale(2.5) translate(${panPos.x / 2.5}px, ${panPos.y / 2.5}px)`, cursor: dragStart ? 'grabbing' : 'grab' } : { transform: 'scale(1)', cursor: 'zoom-in' }} 
                draggable={false} 
              />
            </div>
            {galleryImages.length > 1 && (
              <><button className="lb-nav lb-nav-prev" onClick={lightboxPrev}><ChevronLeft size={24} /></button><button className="lb-nav lb-nav-next" onClick={lightboxNext}><ChevronRight size={24} /></button></>
            )}
            {galleryImages.length > 1 && (
              <div className="lb-thumbs">
                {galleryImages.map((img, i) => <button key={i} className={`lb-thumb ${i === lightboxImg ? 'active' : ''}`} onClick={() => setLightboxImg(i)}><img src={optimizeCloudinaryUrl(img, 200)} alt="" loading="lazy" /></button>)}
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
