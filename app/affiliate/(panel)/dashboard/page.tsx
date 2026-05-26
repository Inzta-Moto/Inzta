'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatPrice, formatDate } from '@/lib/utils';
import { Commission } from '@/types';

export default function AffiliateDashboardPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [affiliateName, setAffiliateName] = useState('');
  const [voucherData, setVoucherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    async function loadAffiliateCommissions() {
      setLoading(true);
      try {
        const res = await fetch('/api/affiliate/commissions');
        const data = await res.json();
        if (res.ok) {
          setCommissions(data.commissions || []);
          setAffiliateName(data.affiliateName || '');
          setVoucherData(data.voucher || null);
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

  const isVoucherExpired = () => {
    if (!voucherData || !voucherData.expiresAt) return false;
    let ms = 0;
    if (typeof voucherData.expiresAt._seconds === 'number') ms = voucherData.expiresAt._seconds * 1000;
    else if (typeof voucherData.expiresAt.seconds === 'number') ms = voucherData.expiresAt.seconds * 1000;
    else if (typeof voucherData.expiresAt === 'string') ms = new Date(voucherData.expiresAt).getTime();
    return ms > 0 && ms < Date.now();
  };
  
  const expired = isVoucherExpired();
  const isVoucherInactive = voucherData && !voucherData.isActive;
  const showWarning = voucherData && (expired || isVoucherInactive);

  return (
    <>
      <div className="admin-page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        {affiliateName && <div style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>Halo, {affiliateName}! 👋</div>}
        <h1 className="admin-page-title">Dashboard Affiliate</h1>
      </div>

      {showWarning && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={24} color="#e65100" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: '#e65100', lineHeight: 1.5 }}>
            <strong>Peringatan:</strong> Kode voucher Anda ({voucherData.code}) saat ini sudah 
            {expired ? ' kadaluarsa' : ' dinonaktifkan'}. Anda tidak akan menerima komisi dari transaksi baru. 
            Silakan hubungi Admin Inzta untuk memperbarui voucher Anda.
          </div>
        </div>
      )}

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
            ) : commissions.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{formatDate(c.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {c.items && c.items.length > 0 ? (
                      c.items.map((item, i) => (
                        <div key={i} style={{ lineHeight: '1.2' }}>
                          <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: '2px' }}>{item.name}</div>
                          <div style={{ fontSize: '10px', color: '#888' }}>Jumlah: {item.quantity} pcs</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.productName}
                      </div>
                    )}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{formatPrice(c.productPrice)}</td>
                <td style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>{formatPrice(c.commissionAmount)}</td>
                <td>
                  {c.isPaid ? (
                    <span className="table-badge table-badge-active" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                      <CheckCircle size={12} /> Cair {formatDate(c.paidAt)}
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

      {commissions.length > ITEMS_PER_PAGE && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
          <button 
            className="btn btn-ghost" 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Sebelumnya
          </button>
          <span style={{ fontSize: 13, color: '#666' }}>
            Halaman {currentPage} dari {Math.ceil(commissions.length / ITEMS_PER_PAGE)}
          </span>
          <button 
            className="btn btn-ghost" 
            disabled={currentPage === Math.ceil(commissions.length / ITEMS_PER_PAGE)} 
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(commissions.length / ITEMS_PER_PAGE), p + 1))}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Selanjutnya
          </button>
        </div>
      )}
    </>
  );
}
