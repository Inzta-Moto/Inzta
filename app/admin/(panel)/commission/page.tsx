'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, DollarSign, Trash2, CheckCircle, Clock } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Commission } from '@/types';

export default function CommissionPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCommissions(); }, []);

  async function loadCommissions() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/commissions');
      const data = await res.json();
      if (res.ok && data.commissions) {
        setCommissions(data.commissions as Commission[]);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const filtered = filter === 'all' ? commissions : filter === 'pending' ? commissions.filter(c => !c.isPaid) : commissions.filter(c => c.isPaid);

  const totalPending = commissions.filter(c => !c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = commissions.filter(c => c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalAll = commissions.reduce((s, c) => s + c.commissionAmount, 0);

  const markPaid = async (id: string) => {
    try {
      await fetch('/api/admin/commissions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaid: true }),
      });
      loadCommissions();
    } catch (e: any) { alert(e.message); }
  };

  const markUnpaid = async (id: string) => {
    try {
      await fetch('/api/admin/commissions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaid: false }),
      });
      loadCommissions();
    } catch (e: any) { alert(e.message); }
  };

  const markAllPendingPaid = async () => {
    const pending = commissions.filter(c => !c.isPaid);
    if (pending.length === 0) return;
    if (!confirm(`Cairkan ${pending.length} komisi pending (${formatPrice(totalPending)})?`)) return;
    try {
      const batch = pending.map(c => fetch('/api/admin/commissions/' + c.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaid: true }),
      }));
      await Promise.all(batch);
      loadCommissions();
    } catch (e: any) { alert(e.message); }
  };

  const deleteCommission = async (id: string) => {
    if (!confirm('Hapus komisi ini?')) return;
    try {
      await fetch('/api/admin/commissions/' + id, { method: 'DELETE' });
      loadCommissions();
    } catch (e: any) { alert(e.message); }
  };

  // Group by affiliate for summary
  const affiliateSummary: { name: string; pending: number; paid: number; count: number }[] = [];
  const affMap = new Map<string, { name: string; pending: number; paid: number; count: number }>();
  commissions.forEach(c => {
    const key = c.affiliateName || 'Unknown';
    if (!affMap.has(key)) affMap.set(key, { name: key, pending: 0, paid: 0, count: 0 });
    const entry = affMap.get(key)!;
    entry.count++;
    if (c.isPaid) entry.paid += c.commissionAmount;
    else entry.pending += c.commissionAmount;
  });
  affMap.forEach(v => affiliateSummary.push(v));

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Memuat data komisi...</div>;

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Komisi Afiliasi</h1>
        <button className="btn btn-primary" onClick={markAllPendingPaid} disabled={commissions.filter(c => !c.isPaid).length === 0} style={{ fontSize: 11, padding: '8px 16px', background: '#2e7d32' }}>
          <CheckCircle size={12} /> Cairkan Semua Pending ({formatPrice(totalPending)})
        </button>
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

      {/* Affiliate Summary */}
      {affiliateSummary.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#555' }}>Ringkasan per Afiliasi</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {affiliateSummary.map((a, i) => (
              <div key={i} style={{ padding: 14, border: '1px solid #e9ecef', borderRadius: 10, background: '#fff' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{a.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                  <span>Transaksi: <strong>{a.count}</strong></span>
                  <span>Belum: <strong style={{ color: '#e65100' }}>{formatPrice(a.pending)}</strong></span>
                  <span>Cair: <strong style={{ color: '#2e7d32' }}>{formatPrice(a.paid)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all' as const, label: `Semua (${commissions.length})` },
          { key: 'pending' as const, label: `Belum Cair (${commissions.filter(c => !c.isPaid).length})` },
          { key: 'paid' as const, label: `Sudah Cair (${commissions.filter(c => c.isPaid).length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '8px 16px', border: `1px solid ${filter === t.key ? '#1a1a1a' : '#ddd'}`, borderRadius: 8,
            background: filter === t.key ? '#1a1a1a' : '#fff', color: filter === t.key ? '#fff' : '#555',
            cursor: 'pointer', fontSize: 12, fontWeight: 500
          }}>{t.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Afiliasi</th>
              <th>Voucher</th>
              <th>Produk</th>
              <th>Harga</th>
              <th>Diskon</th>
              <th>Total</th>
              <th>Komisi (5%)</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="table-empty">Tidak ada data komisi.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td style={{ fontSize: 12, fontWeight: 500 }}>{c.affiliateName || '-'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>{c.voucherCode}</td>
                <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.productName}</td>
                <td style={{ fontSize: 12 }}>{formatPrice(c.productPrice)}</td>
                <td style={{ fontSize: 12, color: '#d32f2f' }}>-{formatPrice(c.discountAmount)}</td>
                <td style={{ fontSize: 12, fontWeight: 600 }}>{formatPrice(c.finalPrice)}</td>
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
                <td>
                  <div className="table-actions">
                    {c.isPaid ? (
                      <button className="table-btn" onClick={() => markUnpaid(c.id)} title="Batalkan cair"><RotateCcw size={16} /></button>
                    ) : (
                      <button className="table-btn" onClick={() => markPaid(c.id)} title="Cairkan komisi" style={{ color: '#2e7d32' }}><DollarSign size={16} /></button>
                    )}
                    <button className="table-btn danger" onClick={() => deleteCommission(c.id)} title="Hapus"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
