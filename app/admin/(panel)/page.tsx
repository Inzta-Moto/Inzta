'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { Package, Plus, ExternalLink, Clipboard, Users, Banknote, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) return <div>Loading...</div>;

  const statItems = [
    { n: formatPrice(stats.totalRevenue), l: 'Total Penjualan', icon: <Banknote size={24} /> },
    { n: stats.totalOrders, l: 'Total Pesanan', icon: <Clipboard size={24} /> },
    { n: stats.pendingOrders, l: 'Pesanan Pending', icon: <Clock size={24} /> },
    { n: stats.totalAffiliates, l: 'Afiliasi', icon: <Users size={24} /> },
    { n: stats.total, l: 'Total Produk', icon: <Package size={24} /> },
    { n: stats.lowStock, l: 'Stok Rendah', icon: <Package size={24} /> },
  ];

  return (
    <>
      <h1 className="admin-page-title" style={{ marginBottom: 24 }}>Dashboard</h1>
      
      <div className="stats-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {statItems.map((s, i) => (
          <div className="stat-card" key={i} style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 20 }}>
            <div className="stat-card-icon" style={{ width: 50, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee', borderRadius: '50%', color: '#666' }}>
              {s.icon}
            </div>
            <div>
              <div className="stat-card-number" style={{ fontSize: 24, fontWeight: 700 }}>{s.n}</div>
              <div className="stat-card-label" style={{ fontSize: 14, color: '#888' }}>{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Recent Orders Panel */}
        <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
          <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Pesanan Terbaru</h3></div>
          <div className="dash-list">
            {stats.recentOrders.length === 0 ? <p className="dash-empty">Tidak ada pesanan terbaru.</p> : stats.recentOrders.map((o: any) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>#{o.orderId || o.id}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{o.customerName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatPrice(o.finalPrice)}</div>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: o.status === 'pending' ? '#fff3e0' : '#e8f5e9', color: o.status === 'pending' ? '#ef6c00' : '#2e7d32' }}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Low Stock Panel */}
          <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
            <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Stok Rendah</h3></div>
            <div className="dash-list">
              {stats.lowList.length === 0 ? <p className="dash-empty">Tidak ada produk stok rendah.</p> : stats.lowList.map((p: any) => (
                <div key={p.slug} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span className="dash-list-name">{p.name}</span>
                  <span style={{ color: p.stock <= 5 ? 'red' : 'inherit' }}>{p.stock} unit</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Aksi Cepat Panel */}
          <div className="dash-panel" style={{ background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #eee' }}>
            <div className="dash-panel-header"><h3 className="dash-panel-title" style={{ marginBottom: 16 }}>Aksi Cepat</h3></div>
            <div className="dash-actions" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/admin/produk" className="dash-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: '#f5f5f5', borderRadius: 6, textDecoration: 'none', color: '#111' }}>
                <Plus size={14} /> Tambah Produk
              </Link>
              <a href="/produk" target="_blank" className="dash-action-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px', background: '#f5f5f5', borderRadius: 6, textDecoration: 'none', color: '#111' }}>
                <ExternalLink size={14} /> Lihat Toko
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
