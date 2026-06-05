'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatPrice, formatDate } from '@/lib/utils';
import { Order } from '@/types';
import { Clipboard, Clock, CheckCircle, XCircle, Search, X, RotateCcw, Trash2, ChevronDown, Package } from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const [orders, setOrders] = useState<(Order & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'completed' | 'cancelled' | 'pending' | 'delete'; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
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
      if (actionTarget.action === 'delete') {
        const res = await fetch(`/api/admin/orders/${actionTarget.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menghapus pesanan');
      } else {
        const res = await fetch(`/api/admin/orders/${actionTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: actionTarget.action }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');
      }
      setActionTarget(null);
      loadOrders();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusConfig: Record<string, { cls: string; label: string; icon: React.ReactNode; bg: string }> = {
    pending: { cls: 'order-badge-pending', label: 'Pending', icon: <Clock size={12} />, bg: 'status-bg-pending' },
    completed: { cls: 'order-badge-completed', label: 'Selesai', icon: <CheckCircle size={12} />, bg: 'status-bg-completed' },
    cancelled: { cls: 'order-badge-cancelled', label: 'Dibatalkan', icon: <XCircle size={12} />, bg: 'status-bg-cancelled' },
  };

  const pagedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const tabsData: { key: StatusFilter; label: string; mobileLabel: string; icon: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'Semua', mobileLabel: 'Semua', icon: <Clipboard size={13} />, count: statusCounts.all },
    { key: 'pending', label: 'Pending', mobileLabel: 'Pending', icon: <Clock size={13} />, count: statusCounts.pending },
    { key: 'completed', label: 'Selesai', mobileLabel: 'Selesai', icon: <CheckCircle size={13} />, count: statusCounts.completed },
    { key: 'cancelled', label: 'Dibatalkan', mobileLabel: 'Batal', icon: <XCircle size={13} />, count: statusCounts.cancelled },
  ];

  // ── Helper Functions ──

  function orderStatusBadge(status: string) {
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: 'order-badge-pending', label: 'Pending' },
      completed: { cls: 'order-badge-completed', label: 'Selesai' },
      cancelled: { cls: 'order-badge-cancelled', label: 'Dibatalkan' },
    };
    const s = map[status] || { cls: '', label: status };
    return <span className={`table-badge ${s.cls}`}>{s.label}</span>;
  }

  function orderActions(order: Order & { id: string }) {
    const id = order.id || order.orderId;
    return (
      <div className="table-actions">
        {order.status === 'pending' && (
          <>
            <button
              className="orders-action-btn orders-action-complete"
              onClick={() => setActionTarget({ id, action: 'completed', name: order.orderId })}
              title="Selesaikan Pesanan"
            >
              ✓ Selesaikan
            </button>
            <button
              className="orders-action-btn orders-action-cancel"
              onClick={() => setActionTarget({ id, action: 'cancelled', name: order.orderId })}
              title="Batalkan Pesanan"
              style={{ padding: '5px 8px' }}
            >
              ✕
            </button>
          </>
        )}
        {order.status === 'completed' && (
          <button
            className="orders-action-btn orders-action-revert"
            onClick={() => setActionTarget({ id, action: 'pending', name: order.orderId })}
            title="Kembalikan ke Pending"
          >
            <RotateCcw size={12} /> Revert
          </button>
        )}
        {order.status === 'cancelled' && (
          <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 500, lineHeight: '28px' }}>Dibatalkan</span>
        )}
        <button
          className="table-btn danger"
          onClick={() => setActionTarget({ id, action: 'delete', name: order.orderId })}
          title="Hapus Pesanan"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Pesanan</h1>
      </div>

      {/* Stats Cards */}
      <div className="admin-stats-grid cols-4">
        {[
          { n: statusCounts.all, l: 'Total Pesanan', icon: <Clipboard size={18} />, color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
          { n: statusCounts.pending, l: 'Pending', icon: <Clock size={18} />, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
          { n: statusCounts.completed, l: 'Selesai', icon: <CheckCircle size={18} />, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
          { n: statusCounts.cancelled, l: 'Dibatalkan', icon: <XCircle size={18} />, color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
        ].map((s, i) => (
          <div
            className="admin-stat-card orders-stat-colored"
            key={i}
            style={{
              borderLeft: '3px solid ' + s.color,
              background: s.bg,
              borderColor: s.border,
            }}
          >
            <div
              className="admin-stat-icon"
              style={{
                color: s.color,
                borderColor: s.color + '30',
                background: '#fff',
                boxShadow: '0 1px 4px ' + s.color + '15',
              }}
            >
              {s.icon}
            </div>
            <div>
              <div className="orders-stat-number" style={{ color: s.color }}>{s.n}</div>
              <div className="admin-stat-label">{s.l}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search */}
      <div className="orders-toolbar">
        <div className="orders-tabs-desktop">
          {tabsData.map(tab => (
            <button
              key={tab.key}
              className={`orders-tab ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
            >
              {tab.label}
              <span className="orders-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="orders-tabs-mobile">
          {tabsData.map(tab => (
            <button
              key={tab.key}
              className={`orders-grid-tab ${statusFilter === tab.key ? 'active' : ''}`}
              onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
            >
              <span className="orders-grid-tab-icon">{tab.icon}</span>
              <span className="orders-grid-tab-label">{tab.mobileLabel}</span>
              <span className="orders-grid-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="orders-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Cari ID atau produk..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          />
          {search && (
            <button className="orders-search-clear" onClick={() => { setSearch(''); setCurrentPage(1); }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="orders-loading-state">
          <div className="orders-loading-spinner" />
          <span>Memuat data pesanan...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="orders-empty-state">
          <Package size={40} strokeWidth={1.2} />
          <p>{search ? `Tidak ada pesanan dengan "${search}"` : 'Belum ada pesanan.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="orders-desktop-table">
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
                  {pagedOrders.map(order => (
                    <tr key={order.id || order.orderId}>
                      <td><span className="order-id-cell">#{order.orderId}</span></td>
                      <td>
                        <div className="order-items-cell">
                          {order.items?.map((item, i) => (
                            <div key={i} className="order-item-line">
                              <span className="order-item-name">{item.name}</span>
                              <span className="order-item-qty">×{item.quantity} ({formatPrice(item.price)})</span>
                            </div>
                          )) || <span style={{ color: '#999' }}>-</span>}
                        </div>
                      </td>
                      <td>
                        <div>
                          {order.discountAmount > 0 && <div className="order-price-old">{formatPrice(order.totalPrice)}</div>}
                          <div className="order-price-final">{formatPrice(order.finalPrice)}</div>
                        </div>
                      </td>
                      <td>
                        {order.voucherCode ? <span className="order-voucher-badge">{order.voucherCode}</span> : <span className="order-na">-</span>}
                      </td>
                      <td>{orderStatusBadge(order.status)}</td>
                      <td className="order-date-cell">{formatDate(order.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{orderActions(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="orders-mobile-accordion">
            {pagedOrders.map(order => {
              const orderId = order.id || order.orderId;
              const isExpanded = expandedOrders.has(orderId);
              const sc = statusConfig[order.status] || statusConfig.pending;
              return (
                <div key={orderId} className={`order-accordion-card ${isExpanded ? 'expanded' : ''}`}>
                  <button className="order-accordion-header" onClick={() => toggleExpand(orderId)}>
                    <div className="order-accordion-header-left">
                      <span className="order-accordion-id">#{order.orderId}</span>
                      <span className={`order-accordion-status ${sc.bg}`}>{sc.icon}{sc.label}</span>
                    </div>
                    <div className="order-accordion-header-right">
                      <span className="order-accordion-price">{formatPrice(order.finalPrice)}</span>
                      <ChevronDown size={16} className={`order-accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </button>
                  <div className="order-accordion-body">
                    <div className="order-accordion-body-inner">
                      <div className="order-accordion-row">
                        <span className="order-accordion-label">Tanggal</span>
                        <span className="order-accordion-value">{formatDate(order.createdAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="order-accordion-section">
                        <span className="order-accordion-section-title">Produk</span>
                        <div className="order-accordion-items">
                          {order.items?.map((item, i) => (
                            <div key={i} className="order-accordion-item">
                              <span className="order-accordion-item-name">{item.name}</span>
                              <span className="order-accordion-item-meta">×{item.quantity} · {formatPrice(item.price)}</span>
                            </div>
                          )) || <span className="order-na">-</span>}
                        </div>
                      </div>
                      <div className="order-accordion-section">
                        <span className="order-accordion-section-title">Rincian Harga</span>
                        <div className="order-accordion-price-breakdown">
                          <div className="order-accordion-price-row"><span>Subtotal</span><span>{formatPrice(order.totalPrice)}</span></div>
                          {order.discountAmount > 0 && <div className="order-accordion-price-row discount"><span>Diskon</span><span>-{formatPrice(order.discountAmount)}</span></div>}
                          <div className="order-accordion-price-row total"><span>Total Bayar</span><span>{formatPrice(order.finalPrice)}</span></div>
                        </div>
                      </div>
                      <div className="order-accordion-row">
                        <span className="order-accordion-label">Voucher</span>
                        {order.voucherCode ? <span className="order-voucher-badge">{order.voucherCode}</span> : <span className="order-na">-</span>}
                      </div>
                      <div className="order-accordion-actions">
                        {order.status === 'pending' && (
                          <>
                            <button className="order-action-btn order-action-complete" onClick={() => setActionTarget({ id: orderId, action: 'completed', name: order.orderId })}>
                              <CheckCircle size={14} /> Selesaikan
                            </button>
                            <button className="order-action-btn order-action-cancel" onClick={() => setActionTarget({ id: orderId, action: 'cancelled', name: order.orderId })}>
                              <XCircle size={14} /> Batalkan
                            </button>
                          </>
                        )}
                        {order.status === 'completed' && (
                          <button className="order-action-btn order-action-revert" onClick={() => setActionTarget({ id: orderId, action: 'pending', name: order.orderId })}>
                            <RotateCcw size={14} /> Kembalikan
                          </button>
                        )}
                        {order.status === 'cancelled' && <span className="order-cancelled-label"><XCircle size={12} /> Pesanan dibatalkan</span>}
                        <button className="order-action-btn order-action-delete" onClick={() => setActionTarget({ id: orderId, action: 'delete', name: order.orderId })}>
                          <Trash2 size={14} /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {filteredOrders.length > ITEMS_PER_PAGE && (
        <div className="orders-pagination">
          <button className="orders-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Sebelumnya</button>
          <div className="orders-page-info">
            <span className="orders-page-current">{currentPage}</span>
            <span className="orders-page-sep">/</span>
            <span className="orders-page-total">{totalPages}</span>
          </div>
          <button className="orders-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Selanjutnya →</button>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) setActionTarget(null); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h2 className="modal-title">
                {actionTarget.action === 'completed' ? 'Selesaikan Pesanan' :
                 actionTarget.action === 'cancelled' ? 'Batalkan Pesanan' :
                 actionTarget.action === 'pending' ? 'Kembalikan ke Pending' : 'Hapus Pesanan'}
              </h2>
              <button type="button" className="modal-close" onClick={() => setActionTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {actionTarget.action === 'completed' ? (
                <p className="modal-text">
                  Selesaikan pesanan <strong>#{actionTarget.name}</strong>?
                  <br /><br />
                  <span className="modal-info-box modal-info-green">ℹ️ Stok produk akan otomatis dikurangi sesuai jumlah pesanan.</span>
                </p>
              ) : actionTarget.action === 'cancelled' ? (
                <p className="modal-text">
                  Batalkan pesanan <strong>#{actionTarget.name}</strong>?
                  <br /><br />
                  <span className="modal-info-box modal-info-red">⚠️ Pesanan yang dibatalkan tidak dapat dikembalikan.</span>
                </p>
              ) : actionTarget.action === 'pending' ? (
                <p className="modal-text">
                  Kembalikan pesanan <strong>#{actionTarget.name}</strong> ke status Pending?
                  <br /><br />
                  <span className="modal-info-box modal-info-blue">ℹ️ Stok akan dikembalikan dan catatan komisi (jika ada) akan dihapus.</span>
                </p>
              ) : (
                <p className="modal-text">
                  Hapus pesanan <strong>#{actionTarget.name}</strong>?
                  <br /><br />
                  <span className="modal-info-box modal-info-red">⚠️ Tindakan ini permanen dan akan menghapus semua data terkait pesanan ini.</span>
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setActionTarget(null)} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button
                className="btn btn-primary"
                style={{
                  fontSize: 11, padding: '8px 16px',
                  background: actionTarget.action === 'completed' ? '#059669' : actionTarget.action === 'pending' ? '#0369a1' : '#333',
                }}
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' :
                 actionTarget.action === 'completed' ? '✓ Selesaikan' :
                 actionTarget.action === 'pending' ? '↺ Kembalikan' :
                 actionTarget.action === 'delete' ? '🗑️ Hapus' : '✕ Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}