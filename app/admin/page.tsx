'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Product } from '@/types';

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ total: number; active: number; lowStock: number; lowList: Product[] }>({ total: 0, active: 0, lowStock: 0, lowList: [] });

  useEffect(() => { loadDash(); }, []);

  async function loadDash() {
    try {
      const pSnap = await getDocs(collection(db, 'products'));
      const products = pSnap.docs.map(d => d.data() as Product);
      const lowStock = products.filter(p => p.stock <= 10);
      setStats({ total: products.length, active: products.filter(p => p.isActive).length, lowStock: lowStock.length, lowList: lowStock });
    } catch (e) { console.error(e); }
  }

  return (
    <>
      <h1 className="admin-page-title">Dashboard</h1>
      <div className="stats-cards">
        {[ { n: stats.total, l: 'Total Produk' }, { n: stats.lowStock, l: 'Stok Rendah' }, { n: stats.active, l: 'Produk Aktif' } ].map((s, i) => (
          <div className="stat-card" key={i}><div className="stat-card-icon" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1A1A1A', borderRadius: '50%', color: '#555', fontSize: '16px' }}>📦</div><div><span className="stat-card-number">{s.n}</span><span className="stat-card-label">{s.l}</span></div></div>
        ))}
      </div>
      <div className="dash-grid">
        <div className="dash-panel"><div className="dash-panel-header"><h3 className="dash-panel-title">Stok Rendah</h3></div><div className="dash-list">{stats.lowList.length === 0 ? <p className="dash-empty">Tidak ada produk stok rendah.</p> : stats.lowList.map(p => <div className="dash-list-item" key={p.slug}><span className="dash-list-name">{p.name}</span><span className={`dash-list-stock${p.stock <= 5 ? ' danger' : ''}`}>{p.stock} unit</span></div>)}</div></div>
        <div className="dash-panel"><div className="dash-panel-header"><h3 className="dash-panel-title">Aksi Cepat</h3></div><div className="dash-actions"><Link href="/admin/produk" className="dash-action-btn">➕ Tambah Produk</Link><a href="/produk" target="_blank" className="dash-action-btn">🔗 Lihat Toko</a></div></div>
      </div>
    </>
  );
}