'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { formatPrice, calcDiscount, buildWaLink } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  showDetails: boolean;
}

export default function ProductCard({ product: p, showDetails }: ProductCardProps) {
  const discount = calcDiscount(p.originalPrice, p.price);
  const images = p.images?.length ? p.images : (p.imageUrl ? [p.imageUrl] : []);
  const mainImage = images[0] || null;
  const [orderLoading, setOrderLoading] = useState(false);
  const [buyerUID, setBuyerUID] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const isAffiliate = localStorage.getItem('is_affiliate_logged_in') === 'true';
      setBuyerUID(user && isAffiliate ? user.uid : null);
    });
    return () => unsub();
  }, []);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    target.style.display = 'none';
    if (target.nextElementSibling) {
      (target.nextElementSibling as HTMLElement).style.display = 'flex';
    }
  };

  const handleOrder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (orderLoading) return;
    setOrderLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: p.slug, name: p.name, price: p.price, quantity: 1 }],
          totalPrice: p.price,
          discountAmount: 0,
          voucherCode: null,
          affiliateId: null,
          finalPrice: p.price,
          buyerUID: buyerUID,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat pesanan');

      const waUrl = buildWaLink(p, data.orderId);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      console.error('[Order Error]', e);
      alert('Gagal membuat pesanan: ' + e.message);
    } finally {
      setOrderLoading(false);
    }
  };

  return (
    <div className="product-card" data-category={p.category}>
      <Link href={`/produk/${p.slug}`} className="product-card-link">
        <div className="product-card-image">
          {p.badge && <span className={`product-badge badge-${p.badgeType || 'white'}`}>{p.badge}</span>}
          {mainImage ? (
              <>
              <img src={mainImage} alt={p.name} loading="lazy" onError={handleImgError} />
              <div className="img-placeholder" style={{ display: 'none' }}><PlaceholderIcon /><span>{p.name}</span></div>
            </>
          ) : (
            <div className="img-placeholder" style={{ display: 'flex' }}><PlaceholderIcon /><span>{p.name}</span></div>
          )}
          {discount > 0 && (
            <div className="product-image-discount">
              DISKON {discount}%
            </div>
          )}
        </div>
      
      
      <div className="product-card-body">
        <div className="product-card-category">{p.category}</div>
        <h3 className="product-card-name">{p.name}</h3>
        <p className="product-card-desc">{p.description}</p>

        {showDetails && p.features && p.features.length > 0 && (
          <div className="product-card-features">
            {p.features.map((f, i) => <span key={i} className="product-feature-tag">{f}</span>)}
          </div>
        )}

        {showDetails && (
          <div className="product-stock">
            <span className={`stock-dot ${p.stock <= 10 ? 'low-stock' : 'in-stock'}`} />
            <span className="stock-text">{p.stock <= 10 ? `Sisa ${p.stock} unit` : 'Tersedia'}</span>
          </div>
        )}

        <div className="product-price-section">
          {p.originalPrice && p.originalPrice > p.price && (
            <div className="product-price-original">{formatPrice(p.originalPrice)}</div>
          )}
          <div className="product-price-current">
            {formatPrice(p.price)}
            {discount > 0 && <span className="product-price-discount">-{discount}%</span>}
          </div>
        </div>

        <button onClick={handleOrder} disabled={orderLoading} className="btn btn-wa" style={{ opacity: orderLoading ? 0.7 : 1, cursor: orderLoading ? 'wait' : 'pointer', border: 'none' }}>
          {orderLoading ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Memproses...
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Pesan via WhatsApp
            </>
          )}
        </button>
      </div>
      </Link>
    </div>
    
  );
}

function PlaceholderIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
