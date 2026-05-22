'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, collection, getDocs, updateDoc, addDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatPrice, calcDiscount } from '@/lib/utils';
import { Truck, ShieldCheck, RefreshCw, Headphones, LucideIcon, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Tag, TicketCheck, TicketX } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { Product, Voucher, Commission } from '@/types';

export default function DetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState<number>(0);

  const [lightbox, setLightbox] = useState<boolean>(false);
  const [lightboxImg, setLightboxImg] = useState<number>(0);
  const [zoomed, setZoomed] = useState<boolean>(false);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // ── Voucher State ──
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherData, setVoucherData] = useState<Voucher | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);

  // ── Order State ──
  const [orderLoading, setOrderLoading] = useState(false);

  const imagesLenRef = useRef(0);

  useEffect(() => { if (slug) loadProduct(); }, [slug]);

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${slug}`);
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Produk tidak ditemukan');
        setLoading(false);
        return;
      }

      const pData = data.product as Product;
      setProduct(pData);
      imagesLenRef.current = pData.images?.length || (pData.imageUrl ? 1 : 0);

      // Load related products
      const relRes = await fetch('/api/products');
      const relData = await relRes.json();
      if (relRes.ok && relData.products) {
        let items: Product[] = relData.products;
        setRelated(items.filter((p: Product) => p.isActive && p.slug !== slug).slice(0, 4));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Auto-Apply Affiliate Voucher ──
  useEffect(() => {
    if (product && !voucherData && !voucherError && !voucherInput) {
      const voucherCode = localStorage.getItem('inzta_affiliate');
      if (voucherCode) {
        const resolveAndApply = async () => {
          try {
            setVoucherLoading(true);
            const res = await fetch(`/api/vouchers/validate?code=${voucherCode}`);
            const data = await res.json();
            
            if (!res.ok) {
               setVoucherLoading(false);
               return;
            }
            const v = data.voucher;
            
            if (v.minPurchase && product.price < v.minPurchase) {
              setVoucherLoading(false);
              return; 
            }

            let disc = 0;
            if (v.type === 'percentage') {
              disc = (product.price * v.value) / 100;
              if (v.maxDiscount && disc > v.maxDiscount) disc = v.maxDiscount;
            } else {
              disc = v.value;
            }
            if (disc > product.price) disc = product.price;

            setVoucherInput(v.code);
            setVoucherData(v);
            setDiscountAmount(Math.round(disc));
          } catch (e) {
            console.error('Failed to auto-apply affiliate voucher', e);
          } finally {
            setVoucherLoading(false);
          }
        };
        resolveAndApply();
      }
    }
  }, [product?.slug]);

  // ── Voucher Logic ──
  const applyVoucher = async () => {
    if (!voucherInput.trim() || !product) return;
    setVoucherLoading(true);
    setVoucherError('');
    setVoucherData(null);
    setDiscountAmount(0);

    try {
      const code = voucherInput.trim().toUpperCase();
      const res = await fetch(`/api/vouchers/validate?code=${code}`);
      const data = await res.json();

      if (!res.ok) {
        setVoucherError(data.error || 'Voucher tidak ditemukan.');
        setVoucherLoading(false);
        return;
      }

      const v = data.voucher;

      if (v.minPurchase && product.price < v.minPurchase) { setVoucherError(`Minimal pembelian ${formatPrice(v.minPurchase)}.`); setVoucherLoading(false); return; }

      let disc = 0;
      if (v.type === 'percentage') {
        disc = (product.price * v.value) / 100;
        if (v.maxDiscount && disc > v.maxDiscount) disc = v.maxDiscount;
      } else {
        disc = v.value;
      }
      if (disc > product.price) disc = product.price;

      setVoucherData(v);
      setDiscountAmount(Math.round(disc));
    } catch (e: any) {
      setVoucherError('Gagal memvalidasi voucher.');
    }
    setVoucherLoading(false);
  };

  const removeVoucher = () => {
    setVoucherInput('');
    setVoucherData(null);
    setVoucherError('');
    setDiscountAmount(0);
  };

  // ── Build WA Link with Voucher ──
  const buildWaLink = (orderId?: string) => {
    if (!product) return '#';
    const p = product;
    const fp = p.price - discountAmount;

    let msg = `🛒 *PESANAN PRODUK*\n`;
    if (orderId) msg += `📋 Order ID: #${orderId}\n`;
    msg += `━━━━━━━━━━━━━━━\n\n`;
    msg += `📦 *${p.name}*\n`;
    if (p.features?.length) msg += `${p.features.join(' • ')}\n`;
    msg += `\n💰 Harga: ${formatPrice(p.price)}\n`;
    if (voucherData) {
      msg += `🎫 Voucher: ${voucherData.code}\n`;
      msg += `🔻 Diskon: -${formatPrice(discountAmount)}\n`;
    }
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Total Bayar: ${formatPrice(fp)}*\n`;
    msg += `━━━━━━━━━━━━━━━\n\n`;
    msg += `Data Pemesan:\n• Nama: \n• No. HP: \n• Alamat: \n\nTerima kasih! 🙏`;

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  // ── Create Order & Open WhatsApp ──
  const handleOrderClick = async () => {
    if (!product || orderLoading) return;
    setOrderLoading(true);

    try {
      const fp = product.price - discountAmount;

      // 1. Create order via API
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: product.slug, name: product.name, price: product.price, quantity: 1 }],
          totalPrice: product.price,
          discountAmount: discountAmount,
          voucherCode: voucherData?.code || null,
          affiliateId: voucherData?.affiliateId || null,
          finalPrice: fp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan');

      const orderId = data.orderId;

      // 2. Track commission if voucher is from affiliate
      if (voucherData && voucherData.affiliateId) {
        try {
          await fetch('/api/admin/commissions/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              affiliateId: voucherData.affiliateId,
              affiliateName: voucherData.affiliateName || '',
              voucherCode: voucherData.code,
              productName: product.name,
              productSlug: product.slug,
              productPrice: product.price,
              discountAmount: discountAmount,
              finalPrice: fp,
            })
          });
        } catch (e) {
          console.error('[Commission Error]', e);
        }
      }

      // 3. Open WhatsApp with Order ID
      const waUrl = buildWaLink(orderId);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      console.error('[Order Error]', e);
      alert('Gagal membuat pesanan: ' + e.message);
    } finally {
      setOrderLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = lightbox ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox]);

  useEffect(() => {
    setZoomed(false);
    setPanPos({ x: 0, y: 0 });
  }, [lightboxImg]);

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

  const toggleZoom = () => {
    if (zoomed) { setZoomed(false); setPanPos({ x: 0, y: 0 }); }
    else { setZoomed(true); setPanPos({ x: 0, y: 0 }); }
  };

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox, lightboxPrev, lightboxNext]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!zoomed) return;
    e.preventDefault();
    setDragStart({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!zoomed || !dragStart) return;
    setPanPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => { setDragStart(null); };

  if (loading) return (
    <>
      <Header active="produk" />
      <section className="detail-section"><div className="container"><div className="detail-skeleton"><div className="detail-skeleton-image" /><div className="detail-skeleton-info" /></div></div></section>
      <Footer />
    </>
  );

  if (error || !product) return (
    <>
      <Header active="produk" />
      <section className="detail-section">
        <div className="container">
          <div className="empty-state">
            <p>{error || "Produk tidak ditemukan"}</p>
            <Link href="/produk" style={{ marginTop: '1rem', display: 'inline-block', color: '#0070f3' }}>Kembali ke halaman produk</Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );

  const p = product;
  const images = p.images?.length ? p.images : (p.imageUrl ? [p.imageUrl] : []);
  imagesLenRef.current = images.length;

  const discount = calcDiscount(p.originalPrice, p.price);
  const savings = p.originalPrice ? p.originalPrice - p.price : 0;
  const stockCls = p.stock <= 10 ? 'low-stock' : 'in-stock';
  const stockLabel = p.stock <= 10 ? `Sisa ${p.stock} unit` : 'Tersedia';

  const finalPrice = p.price - discountAmount;

  const trustItems: { icon: LucideIcon; title: string; desc: string }[] = [
    { icon: Truck, title: 'Pengiriman Cepat', desc: 'Paket dikirim 1-2 hari kerja' },
    { icon: ShieldCheck, title: 'Garansi Resmi', desc: 'Jaminan produk original 100%' },
    { icon: RefreshCw, title: 'Easy Return', desc: '7 hari pengembalian tanpa ribet' },
    { icon: Headphones, title: 'Support 24/7', desc: 'Tim kami selalu siap membantu' },
  ];

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = 'none';
    if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'flex';
  };

  const placeholderSvg = (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );

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
            {/* Image */}
            <div className="detail-image-section">
              <div className="detail-image-wrapper detail-image-clickable" onClick={() => images.length > 0 && openLightbox(activeImg)}>
                {images.length > 0 ? (
                  <>
                    <img src={images[activeImg]} alt={p.name} onError={handleImgError} />
                    <div className="detail-image-placeholder" style={{ display: 'none' }}>{placeholderSvg}<span>{p.name}</span></div>
                    <div className="detail-image-zoom-hint"><ZoomIn size={18} /><span>Klik untuk zoom</span></div>
                  </>
                ) : (
                  <div className="detail-image-placeholder" style={{ display: 'flex' }}>{placeholderSvg}<span>{p.name}</span></div>
                )}
              </div>
              {images.length > 1 && (
                <div className="detail-gallery">
                  {images.map((img, i) => (
                    <button key={i} className={`detail-gallery-thumb ${i === activeImg ? 'active' : ''}`} onClick={() => setActiveImg(i)}>
                      <img src={img} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="detail-info">
              <div className="detail-category">{p.category}</div>
              <h1 className="detail-name">{p.name}</h1>

              <div className="detail-price-box">
                <div className="detail-price-label">Harga</div>
                {p.originalPrice && p.originalPrice > p.price && (
                  <div className="detail-price-original">{formatPrice(p.originalPrice)}</div>
                )}
                <div className="detail-price-row">
                  <span className="detail-price-current">{formatPrice(p.price)}</span>
                  {discount > 0 && <span className="detail-price-discount">-{discount}%</span>}
                </div>
                {savings > 0 && (
                  <div className="detail-price-save">Hemat <span>{formatPrice(savings)}</span> dari harga normal</div>
                )}

                {/* ── Voucher Applied Price ── */}
                {voucherData && discountAmount > 0 && (
                  <div style={{
                    marginTop: 12, padding: '10px 14px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)',
                    border: '1px solid #a5d6a7'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2e7d32', marginBottom: 4 }}>
                      <TicketCheck size={14} />
                      <strong>Voucher {voucherData.code} aktif!</strong>
                      <button onClick={removeVoucher} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#2e7d32', padding: 2 }}><TicketX size={14} /></button>
                    </div>
                    <div style={{ fontSize: 13, color: '#555' }}>
                      Diskon: <span style={{ color: '#d32f2f', fontWeight: 600 }}>-{formatPrice(discountAmount)}</span>
                      {voucherData.type === 'percentage' && voucherData.maxDiscount ? ` (maks ${formatPrice(voucherData.maxDiscount)})` : ''}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: '#1b5e20' }}>
                      {formatPrice(finalPrice)}
                    </div>
                  </div>
                )}
              </div>

              {p.features && p.features.length > 0 && (
                <div className="detail-features">
                  <div className="detail-features-label">Spesifikasi</div>
                  <div className="detail-features-list">
                    {p.features.map((f, i) => (<span key={i} className="detail-feature-tag">{f}</span>))}
                  </div>
                </div>
              )}

              <div className="detail-stock">
                <span className={`detail-stock-dot ${stockCls}`} />
                <span className="detail-stock-text"><strong>{stockLabel}</strong></span>
              </div>

              {/* ── Voucher Input ── */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: voucherError ? 8 : 0 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Tag size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                      type="text"
                      placeholder="Masukkan kode voucher"
                      value={voucherInput}
                      onChange={(e) => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && applyVoucher()}
                      style={{
                        width: '100%', padding: '10px 12px 10px 36px', border: '1px solid #ddd',
                        borderRadius: 8, fontSize: 13, outline: 'none',
                        borderColor: voucherError ? '#ef4444' : '#ddd',
                        textTransform: 'uppercase', letterSpacing: 1
                      }}
                      disabled={!!voucherData}
                    />
                  </div>
                  {voucherData ? (
                    <button
                      onClick={removeVoucher}
                      style={{ padding: '10px 16px', border: '1px solid #ddd', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      Hapus
                    </button>
                  ) : (
                    <button
                      onClick={applyVoucher}
                      disabled={voucherLoading || !voucherInput.trim()}
                      style={{
                        padding: '10px 16px', border: 'none', borderRadius: 8,
                        background: voucherLoading || !voucherInput.trim() ? '#ccc' : '#1a1a1a',
                        color: '#fff', cursor: voucherLoading || !voucherInput.trim() ? 'not-allowed' : 'pointer',
                        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap'
                      }}
                    >
                      {voucherLoading ? '...' : 'Pakai'}
                    </button>
                  )}
                </div>
                {voucherError && (
                  <div style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <X size={12} /> {voucherError}
                  </div>
                )}
              </div>

              {/* ── CTA Button ── */}
              <div className="detail-cta">
                <button
                  className="btn-detail-wa"
                  onClick={handleOrderClick}
                  disabled={orderLoading}
                  style={{ opacity: orderLoading ? 0.7 : 1, cursor: orderLoading ? 'wait' : 'pointer' }}
                >
                  {orderLoading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      Pesan via WhatsApp
                    </>
                  )}
                </button>
              </div>

              {/* ── Share Section ── */}
              <div className="detail-share">
                <button className="detail-share-btn detail-share-copy" onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  const toast = document.getElementById('share-toast');
                  if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  <span>Salin Link</span>
                </button>
                <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`*${p.name}*\n${p.description ? p.description.split('\n')[0] : ''}\n\nHarga: ${formatPrice(p.price)}\n\n${window.location.href}`)}`} target="_blank" rel="noopener noreferrer" className="detail-share-btn detail-share-wa">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  <span>Bagikan</span>
                </a>
              </div>
              <div id="share-toast" className="toast">✓ Link berhasil disalin!</div>
            </div>
          </div>

          {/* Trust */}
          <div className="detail-full-trust">
            {trustItems.map((item, i) => (
              <div className="detail-trust-item" key={i}>
                <div className="detail-trust-icon"><item.icon size={14} /></div>
                <div className="detail-trust-text"><strong>{item.title}</strong>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Deskripsi */}
          <div className="detail-full-desc">
            <p className="detail-desc">{p.description}</p>
          </div>
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
              {related.map(r => (<ProductCard key={r.slug} product={r} showDetails={false} />))}
            </div>
          </div>
        </section>
      )}

      {lightbox && images.length > 0 && (
        <div className="lb-overlay" onClick={closeLightbox}>
          <div className="lb-container" onClick={e => e.stopPropagation()}>
            <div className="lb-topbar">
              <span className="lb-counter">{lightboxImg + 1} / {images.length}</span>
              <div className="lb-topbar-right">
                <button className="lb-btn" onClick={toggleZoom} title={zoomed ? 'Zoom Out' : 'Zoom In'}>
                  {zoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
                </button>
                <button className="lb-btn" onClick={closeLightbox} title="Tutup"><X size={20} /></button>
              </div>
            </div>
            <div className={`lb-image-area ${zoomed ? 'zoomed' : ''}`} onClick={!zoomed ? toggleZoom : undefined} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
              <img src={images[lightboxImg]} alt="" style={zoomed ? { transform: `scale(2.5) translate(${panPos.x / 2.5}px, ${panPos.y / 2.5}px)`, cursor: dragStart ? 'grabbing' : 'grab' } : { transform: 'scale(1)', cursor: 'zoom-in' }} draggable={false} />
            </div>
            {images.length > 1 && (<><button className="lb-nav lb-nav-prev" onClick={lightboxPrev}><ChevronLeft size={24} /></button><button className="lb-nav lb-nav-next" onClick={lightboxNext}><ChevronRight size={24} /></button></>)}
            {images.length > 1 && (
              <div className="lb-thumbs">{images.map((img, i) => (<button key={i} className={`lb-thumb ${i === lightboxImg ? 'active' : ''}`} onClick={() => setLightboxImg(i)}><img src={img} alt="" /></button>))}</div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}