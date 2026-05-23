'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatPrice } from '@/lib/utils';
import { Order } from '@/types';
import { Clipboard, Clock, CheckCircle, XCircle, Search, X } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'completed' | 'cancelled'; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      if (res.ok && data.orders) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error('[Orders] Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    let result = orders;
    
    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    // Filter by search (order ID)
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      result = result.filter(o => 
        o.orderId?.toUpperCase().includes(q) || 
        o.items?.some(item => item.name.toUpperCase().includes(q))
      );
    }
    
    return result;
  }, [orders, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length, pending: 0, completed: 0, cancelled: 0 };
    orders.forEach(o => {
      if (o.status === 'pending') counts.pending++;
      else if (o.status === 'completed') counts.completed++;
      else if (o.status === 'cancelled') counts.cancelled++;
    });
    return counts;
  }, [orders]);

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/orders/${actionTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: actionTarget.action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');

      setActionTarget(null);
      loadOrders();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (val: any) => {
    if (!val) return '-';
    let d: Date;
    if (typeof val === 'string') d = new Date(val);
    else if (typeof val === 'object' && val.seconds) d = new Date(val.seconds * 1000);
    else if (typeof val === 'object' && val._seconds) d = new Date(val._seconds * 1000);
    else return '-';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'order-badge-pending', label: 'Pending' },
      completed: { cls: 'order-badge-completed', label: 'Selesai' },
      cancelled: { cls: 'order-badge-cancelled', label: 'Dibatalkan' },
    };
    const s = map[status] || { cls: '', label: status };
    return <span className={`table-badge ${s.cls}`}>{s.label}</span>;
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Pesanan</h1>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { n: statusCounts.all, l: 'Total Pesanan', icon: <Clipboard size={18} /> },
          { n: statusCounts.pending, l: 'Pending', icon: <Clock size={18} /> },
          { n: statusCounts.completed, l: 'Selesai', icon: <CheckCircle size={18} /> },
          { n: statusCounts.cancelled, l: 'Dibatalkan', icon: <XCircle size={18} /> },
        ].map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card-icon" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #1A1A1A', borderRadius: '50%', color: '#555' }}>{s.icon}</div>
            <div>
              <span className="stat-card-number">{s.n}</span>
              <span className="stat-card-label">{s.l}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="orders-toolbar">
        <div className="orders-tabs">
          {(['all', 'pending', 'completed', 'cancelled'] as StatusFilter[]).map(tab => (
            <button
              key={tab}
              className={`orders-tab ${statusFilter === tab ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab === 'all' ? 'Semua' : tab === 'pending' ? 'Pending' : tab === 'completed' ? 'Selesai' : 'Dibatalkan'}
              <span className="orders-tab-count">{statusCounts[tab]}</span>
            </button>
          ))}
        </div>
        <div className="orders-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Cari Order ID atau nama produk..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="admin-table-wrap">
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontSize: 13 }}>Memuat data pesanan...</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Produk</th>
                <th>Total</th>
                <th>Voucher</th>
                <th>Status</th>
                <th>Tanggal</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    {search ? `Tidak ada pesanan dengan "${search}"` : 'Belum ada pesanan.'}
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id || order.orderId}>
                    <td>
                      <span className="order-id-cell">#{order.orderId}</span>
                    </td>
                    <td>
                      <div className="order-items-cell">
                        {order.items?.map((item, i) => (
                          <div key={i} className="order-item-line">
                            <span className="order-item-name">{item.name}</span>
                            <span className="order-item-qty">×{item.quantity}</span>
                          </div>
                        )) || <span style={{ color: '#999' }}>-</span>}
                      </div>
                    </td>
                    <td>
                      <div>
                        {order.discountAmount > 0 && (
                          <div style={{ fontSize: 11, color: '#999', textDecoration: 'line-through' }}>
                            {formatPrice(order.totalPrice)}
                          </div>
                        )}
                        <div style={{ fontWeight: 600, color: '#1a1a1a' }}>
                          {formatPrice(order.finalPrice)}
                        </div>
                      </div>
                    </td>
                    <td>
                      {order.voucherCode ? (
                        <span className="order-voucher-badge">{order.voucherCode}</span>
                      ) : (
                        <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>
                    <td>{statusBadge(order.status)}</td>
                    <td style={{ fontSize: 12, color: '#666' }}>{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        {order.status === 'pending' && (
                          <>
                            <button
                              className="orders-action-btn orders-action-complete"
                              onClick={() => setActionTarget({
                                id: order.id || order.orderId,
                                action: 'completed',
                                name: order.orderId,
                              })}
                              title="Selesaikan Pesanan"
                            >
                              ✓ Selesaikan
                            </button>
                            <button
                              className="orders-action-btn orders-action-cancel"
                              onClick={() => setActionTarget({
                                id: order.id || order.orderId,
                                action: 'cancelled',
                                name: order.orderId,
                              })}
                              title="Batalkan Pesanan"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                        {order.status === 'completed' && (
                          <span style={{ fontSize: 11, color: '#059669', fontWeight: 500 }}>Selesai</span>
                        )}
                        {order.status === 'cancelled' && (
                          <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 500 }}>Dibatalkan</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) setActionTarget(null); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">
                {actionTarget.action === 'completed' ? 'Selesaikan Pesanan' : 'Batalkan Pesanan'}
              </h2>
              <button type="button" className="modal-close" onClick={() => setActionTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {actionTarget.action === 'completed' ? (
                <p className="modal-text">
                  Anda yakin ingin menyelesaikan pesanan <strong>#{actionTarget.name}</strong>?
                  <br /><br />
                  <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', padding: '8px 12px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                    ℹ️ Stok produk akan otomatis dikurangi sesuai jumlah pesanan.
                  </span>
                </p>
              ) : (
                <p className="modal-text">
                  Anda yakin ingin membatalkan pesanan <strong>#{actionTarget.name}</strong>?
                  <br /><br />
                  <span style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', padding: '8px 12px', borderRadius: 6, border: '1px solid #fecaca' }}>
                    ⚠️ Pesanan yang dibatalkan tidak dapat dikembalikan.
                  </span>
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setActionTarget(null)} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button
                className="btn btn-primary"
                style={{
                  fontSize: 11,
                  padding: '8px 16px',
                  background: actionTarget.action === 'completed' ? '#059669' : '#333',
                }}
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : (actionTarget.action === 'completed' ? '✓ Selesaikan' : <><X size={12} /> Batalkan</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoped Styles */}
      <style jsx>{`
        .orders-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .orders-tabs {
          display: flex;
          gap: 4px;
          background: #f5f5f5;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #eee;
        }

        .orders-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          color: #888;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .orders-tab:hover {
          color: #1a1a1a;
          background: #fff;
        }

        .orders-tab.active {
          color: #1a1a1a;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          font-weight: 600;
        }

        .orders-tab-count {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 10px;
          background: #eee;
          color: #888;
          line-height: 1.6;
        }

        .orders-tab.active .orders-tab-count {
          background: #1a1a1a;
          color: #fff;
        }

        .orders-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: #fff;
          border: 1px solid #eee;
          border-radius: 8px;
          min-width: 260px;
          transition: border-color 0.2s;
        }

        .orders-search:focus-within {
          border-color: #F59E0B;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .orders-search svg {
          color: #999;
          flex-shrink: 0;
        }

        .orders-search input {
          border: none;
          outline: none;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: #1a1a1a;
          width: 100%;
          background: transparent;
        }

        .orders-search input::placeholder {
          color: #bbb;
        }

        .order-id-cell {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px;
          font-weight: 600;
          color: #1a1a1a;
          background: #f5f5f5;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .order-items-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .order-item-line {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .order-item-name {
          font-size: 13px;
          font-weight: 500;
          color: #1a1a1a;
        }

        .order-item-qty {
          font-size: 11px;
          color: #999;
          font-weight: 500;
        }

        .order-voucher-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 4px;
          background: #FEF3C7;
          color: #92400E;
          border: 1px solid #FDE68A;
        }

        :global(.order-badge-pending) {
          background: #FEF3C7 !important;
          color: #92400E !important;
          border: 1px solid #FDE68A !important;
        }

        :global(.order-badge-completed) {
          background: #ECFDF5 !important;
          color: #059669 !important;
          border: 1px solid #A7F3D0 !important;
        }

        :global(.order-badge-cancelled) {
          background: #FEF2F2 !important;
          color: #DC2626 !important;
          border: 1px solid #FECACA !important;
        }

        .orders-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid;
          white-space: nowrap;
        }

        .orders-action-complete {
          background: #ECFDF5;
          color: #059669;
          border-color: #A7F3D0;
        }

        .orders-action-complete:hover {
          background: #059669;
          color: #fff;
          border-color: #059669;
        }

        .orders-action-cancel {
          background: #FEF2F2;
          color: #EF4444;
          border-color: #FECACA;
          padding: 5px 8px;
        }

        .orders-action-cancel:hover {
          background: #EF4444;
          color: #fff;
          border-color: #EF4444;
        }

        @media (max-width: 768px) {
          .orders-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .orders-tabs {
            overflow-x: auto;
          }

          .orders-search {
            min-width: 0;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
