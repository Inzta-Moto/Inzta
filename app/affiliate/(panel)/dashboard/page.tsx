'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Commission } from '@/types';

export default function AffiliateDashboardPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAffiliateCommissions() {
      setLoading(true);
      try {
        const res = await fetch('/api/affiliate/commissions');
        const data = await res.json();
        if (res.ok) {
          setCommissions(data.commissions || []);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    loadAffiliateCommissions();
  }, []);

  const totalPending = commissions.filter(c => !c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = commissions.filter(c => c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalAll = commissions.reduce((s, c) => s + c.commissionAmount, 0);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Memuat dashboard...</div>;

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard Affiliate</h1>
      </div>

      {/* Summary Cards */}
      <div className="stats-cards" style={{ marginBottom: 24 }}>
        {[
          { n: formatPrice(totalAll), l: 'Total Komisi', c: '#1a1a1a' },
          { n: formatPrice(totalPending), l: 'Belum Cair', c: '#e65100' },
          { n: formatPrice(totalPaid), l: 'Sudah Cair', c: '#2e7d32' },
          { n: commissions.filter(c => !c.isPaid).length.toString(), l: 'Transaksi Pending', c: '#1565c0' },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div>
              <span className="stat-card-number" style={{ color: s.c }}>{s.n}</span>
              <span className="stat-card-label">{s.l}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Produk</th>
              <th>Harga</th>
              <th>Komisi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {commissions.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">Belum ada data komisi.</td></tr>
            ) : commissions.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productName}</td>
                <td style={{ fontSize: 12 }}>{formatPrice(c.productPrice)}</td>
                <td style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>{formatPrice(c.commissionAmount)}</td>
                <td>
                  {c.isPaid ? (
                    <span className="table-badge table-badge-active" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                      <CheckCircle size={12} /> Cair {c.paidAt ? new Date(c.paidAt.seconds * 1000).toLocaleDateString('id-ID') : ''}
                    </span>
                  ) : (
                    <span className="table-badge" style={{ background: '#fff3e0', color: '#e65100' }}><Clock size={12} /> Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
