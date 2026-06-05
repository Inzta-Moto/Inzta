'use client';

import { useState, useEffect, FormEvent } from 'react';
import { formatPrice, formatDate } from '@/lib/utils';
import { Voucher, Affiliate } from '@/types';
import { Copy, Check, Ticket, Edit2, Trash2, ChevronDown, Percent, Banknote, Users, Calendar, Hash } from 'lucide-react';

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'INZ-';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [modal, setModal] = useState<Partial<Voucher> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ code: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVouchers, setExpandedVouchers] = useState<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { loadVouchers(); loadAffiliates(); }, []);

  async function loadVouchers() {
    try {
      const res = await fetch('/api/admin/vouchers');
      const data = await res.json();
      if (res.ok && data.vouchers) {
        setVouchers(data.vouchers as Voucher[]);
      }
    } catch (e) { console.error(e); }
  }

  async function loadAffiliates() {
    try {
      const res = await fetch('/api/admin/affiliates');
      const data = await res.json();
      if (res.ok && data.affiliates) {
        setAffiliates(data.affiliates as Affiliate[]);
      }
    } catch (e) { console.error(e); }
  }

  const openAdd = () => {
    setModal({ code: generateCode(), type: 'percentage', value: 10, minPurchase: 0, maxDiscount: 0, isActive: true, usageCount: 0, maxUsage: null, affiliateId: null, affiliateName: null, expiresAt: null });
    setFormError('');
  };

  const openEdit = (v: Voucher) => { setModal({ ...v }); setFormError(''); };
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (code: string) => setDeleteTarget({ code });
  const closeDelete = () => setDeleteTarget(null);

  const toggleExpand = (code: string) => {
    setExpandedVouchers(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch('/api/admin/vouchers/' + deleteTarget.code, { method: 'DELETE' });
      closeDelete(); loadVouchers();
    } catch (e: any) { alert(e.message); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 1500);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const editCode = fd.get('editCode') as string;
    const code = (fd.get('code') as string).toUpperCase().trim();
    if (!code) { setFormError('Kode voucher wajib diisi.'); setSaving(false); return; }

    const expiresVal = fd.get('expiresAt') as string;
    const affiliateId = fd.get('affiliateId') as string;
    const aff = affiliates.find(a => a.id === affiliateId);
    const maxUsageVal = fd.get('maxUsage') as string;

    const data: Voucher = {
      code,
      type: fd.get('type') as 'percentage' | 'fixed',
      value: parseInt((fd.get('value') as string).replace(/\D/g, '')) || 0,
      minPurchase: parseInt((fd.get('minPurchase') as string).replace(/\D/g, '')) || 0,
      maxDiscount: parseInt((fd.get('maxDiscount') as string).replace(/\D/g, '')) || 0,
      affiliateId: affiliateId || null,
      affiliateName: aff?.name || null,
      isActive: fd.get('isActive') === 'true',
      usageCount: modal?.usageCount || 0,
      maxUsage: maxUsageVal ? parseInt(maxUsageVal) : null,
      expiresAt: expiresVal ? new Date(expiresVal) : null,
      createdAt: modal?.createdAt || new Date().toISOString() as any,
    };

    try {
      await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (editCode && editCode !== code) await fetch('/api/admin/vouchers/' + editCode, { method: 'DELETE' });
      closeModal(); loadVouchers();
    } catch (err: any) { setFormError('Gagal menyimpan: ' + err.message); }
    setSaving(false);
  };

  const isExpired = (v: Voucher) => {
    if (!v.expiresAt) return false;
    let ms = 0;
    if (typeof v.expiresAt.seconds === 'number') ms = v.expiresAt.seconds * 1000;
    else if (typeof v.expiresAt === 'string') ms = new Date(v.expiresAt).getTime();
    else if (v.expiresAt instanceof Date) ms = v.expiresAt.getTime();
    return ms > 0 && ms < Date.now();
  };

  const getStatusInfo = (v: Voucher) => {
    if (!v.isActive) return { label: 'Nonaktif', cls: 'voc-status-inactive', bg: 'voc-bg-inactive' };
    if (isExpired(v)) return { label: 'Kadaluarsa', cls: 'voc-status-expired', bg: 'voc-bg-expired' };
    return { label: 'Aktif', cls: 'voc-status-active', bg: 'voc-bg-active' };
  };

  const getExpiresDate = (v: Voucher): string | null => {
    if (!v.expiresAt) return null;
    let d: Date;
    if (typeof v.expiresAt.seconds === 'number') d = new Date(v.expiresAt.seconds * 1000);
    else if (typeof v.expiresAt === 'string') d = new Date(v.expiresAt);
    else if (v.expiresAt instanceof Date) d = v.expiresAt;
    else return null;
    if (isNaN(d.getTime())) return null;
    return formatDate(d.toISOString(), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const pagedVouchers = vouchers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(vouchers.length / ITEMS_PER_PAGE);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Voucher</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Buat Voucher</button>
      </div>

      {vouchers.length === 0 ? (
        <div className="voc-empty">
          <Ticket size={40} strokeWidth={1.2} />
          <p>Belum ada voucher.</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="voc-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Tipe</th>
                    <th>Nilai</th>
                    <th>Min. Beli</th>
                    <th>Maks. Diskon</th>
                    <th>Dipakai</th>
                    <th>Afiliasi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedVouchers.map(v => {
                    const st = getStatusInfo(v);
                    return (
                      <tr key={v.code}>
                        <td>
                          <button onClick={() => copyCode(v.code)} className="voc-code-btn">
                            <Ticket size={14} />
                            <strong className="voc-code-text">{v.code}</strong>
                            {copiedCode === v.code ? <Check size={12} color="green" /> : <Copy size={12} color="#aaa" />}
                          </button>
                        </td>
                        <td className="voc-table-type">{v.type === 'percentage' ? 'Persen' : 'Nominal'}</td>
                        <td className="voc-table-value">{v.type === 'percentage' ? `${v.value}%` : formatPrice(v.value)}</td>
                        <td className="voc-table-sub">{v.minPurchase ? formatPrice(v.minPurchase) : '-'}</td>
                        <td className="voc-table-sub">{v.type === 'percentage' && v.maxDiscount ? formatPrice(v.maxDiscount) : '-'}</td>
                        <td className="voc-table-sub">{v.usageCount}{v.maxUsage ? ` / ${v.maxUsage}` : ''}</td>
                        <td className="voc-table-sub">{v.affiliateName || '-'}</td>
                        <td><span className={`table-badge ${st.cls}`}>{st.label}</span></td>
                        <td>
                          <div className="table-actions">
                            <button className="table-btn" onClick={() => openEdit(v)}><Edit2 size={16} /></button>
                            <button className="table-btn danger" onClick={() => openDelete(v.code)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="voc-mobile-accordion">
            {pagedVouchers.map(v => {
              const isExpanded = expandedVouchers.has(v.code);
              const st = getStatusInfo(v);
              const expiresDate = getExpiresDate(v);
              const valueDisplay = v.type === 'percentage' ? `${v.value}%` : formatPrice(v.value);

              return (
                <div key={v.code} className={`voc-accordion-card ${isExpanded ? 'expanded' : ''}`}>
                  <button className="voc-accordion-header" onClick={() => toggleExpand(v.code)}>
                    <div className="voc-accordion-left">
                      <div className="voc-accordion-icon-wrap">
                        <Ticket size={14} />
                      </div>
                      <div className="voc-accordion-identity">
                        <span className="voc-accordion-code">{v.code}</span>
                        <span className="voc-accordion-value-label">
                          {v.type === 'percentage' ? <Percent size={10} /> : <Banknote size={10} />}
                          {valueDisplay}
                        </span>
                      </div>
                    </div>
                    <div className="voc-accordion-right">
                      <span className={`voc-status-sm ${st.bg}`}>{st.label}</span>
                      <ChevronDown size={16} className={`voc-accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </button>

                  <div className="voc-accordion-body">
                    <div className="voc-accordion-body-inner">
                      {/* Copy code */}
                      <button className="voc-copy-row" onClick={() => copyCode(v.code)}>
                        <span className="voc-copy-label">Kode Voucher</span>
                        <span className="voc-copy-action">
                          <span className="voc-copy-code">{v.code}</span>
                          {copiedCode === v.code ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                        </span>
                      </button>

                      {/* Type */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">
                          <Hash size={11} /> Tipe
                        </span>
                        <span className="voc-accordion-value">{v.type === 'percentage' ? 'Persen (%)' : 'Nominal (Rp)'}</span>
                      </div>

                      {/* Value */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">
                          {v.type === 'percentage' ? <Percent size={11} /> : <Banknote size={11} />} Nilai
                        </span>
                        <span className="voc-accordion-value voc-value-highlight">{valueDisplay}</span>
                      </div>

                      {/* Min Purchase */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">Min. Beli</span>
                        <span className="voc-accordion-value">{v.minPurchase ? formatPrice(v.minPurchase) : '-'}</span>
                      </div>

                      {/* Max Discount */}
                      {v.type === 'percentage' && (
                        <div className="voc-accordion-row">
                          <span className="voc-accordion-label">Maks. Diskon</span>
                          <span className="voc-accordion-value">{v.maxDiscount ? formatPrice(v.maxDiscount) : '-'}</span>
                        </div>
                      )}

                      {/* Usage */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">Dipakai</span>
                        <span className="voc-accordion-value">
                          {v.usageCount}{v.maxUsage ? ` / ${v.maxUsage}` : ' (unlimited)'}
                        </span>
                      </div>

                      {/* Expires */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">
                          <Calendar size={11} /> Kadaluarsa
                        </span>
                        <span className="voc-accordion-value">{expiresDate || 'Tidak ada'}</span>
                      </div>

                      {/* Affiliate */}
                      <div className="voc-accordion-row">
                        <span className="voc-accordion-label">
                          <Users size={11} /> Afiliasi
                        </span>
                        <span className="voc-accordion-value">{v.affiliateName || '-'}</span>
                      </div>

                      {/* Actions */}
                      <div className="voc-accordion-actions">
                        <button className="voc-action-btn voc-action-edit" onClick={() => openEdit(v)}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button className="voc-action-btn voc-action-delete" onClick={() => openDelete(v.code)}>
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
      {vouchers.length > ITEMS_PER_PAGE && (
        <div className="voc-pagination">
          <button className="voc-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Sebelumnya</button>
          <div className="voc-page-info">
            <span className="voc-page-current">{currentPage}</span>
            <span className="voc-page-sep">/</span>
            <span className="voc-page-total">{totalPages}</span>
          </div>
          <button className="voc-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Selanjutnya →</button>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modal !== null && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">{modal.createdAt ? 'Edit Voucher' : 'Buat Voucher'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <input type="hidden" name="editCode" defaultValue={modal.code || ''} />
              {formError && <div className="form-error" style={{ marginBottom: 16 }}>{formError}</div>}

              <div className="form-group">
                <label className="form-label">Kode Voucher *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input name="code" className="form-input" required value={modal.code || ''} onChange={e => setModal(prev => prev ? { ...prev, code: e.target.value.toUpperCase() } : { code: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }} />
                  <button type="button" onClick={() => setModal(prev => prev ? { ...prev, code: generateCode() } : { code: generateCode() })} style={{ padding: '0 12px', border: '1px solid #ddd', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>Acak</button>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipe Diskon *</label>
                  <select name="type" className="form-input" value={modal.type || 'percentage'} onChange={e => setModal(prev => prev ? { ...prev, type: e.target.value as 'percentage' | 'fixed' } : { type: e.target.value as 'percentage' | 'fixed' })}>
                    <option value="percentage">Persen (%)</option>
                    <option value="fixed">Nominal (Rp)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nilai Diskon *</label>
                  {modal.type === 'percentage' ? (
                    <input type="number" name="value" className="form-input" min={0} max={100} step={1} defaultValue={modal.value || ''} required />
                  ) : (
                    <input
                      type="text"
                      name="value"
                      className="form-input"
                      value={modal.value ? modal.value.toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setModal(prev => prev ? { ...prev, value: val ? parseInt(val) : 0 } : { value: val ? parseInt(val) : 0 });
                      }}
                      required
                    />
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Minimum Pembelian</label>
                  <input
                    type="text"
                    name="minPurchase"
                    className="form-input"
                    value={modal.minPurchase ? modal.minPurchase.toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setModal(prev => prev ? { ...prev, minPurchase: val ? parseInt(val) : 0 } : { minPurchase: val ? parseInt(val) : 0 });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: modal.type !== 'percentage' ? '#bbb' : 'inherit' }}>
                    Maks. Diskon {modal.type !== 'percentage' && <span style={{ fontWeight: 400 }}>(Hanya Persen)</span>}
                  </label>
                  <input
                    type="text"
                    name="maxDiscount"
                    className="form-input"
                    value={modal.maxDiscount ? modal.maxDiscount.toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setModal(prev => prev ? { ...prev, maxDiscount: val ? parseInt(val) : 0 } : { maxDiscount: val ? parseInt(val) : 0 });
                    }}
                    disabled={modal.type !== 'percentage'}
                    style={{ opacity: modal.type !== 'percentage' ? 0.5 : 1 }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Maks. Penggunaan</label>
                  <input type="number" name="maxUsage" className="form-input" min={0} defaultValue={modal.maxUsage || ''} placeholder="Kosongkan = unlimited" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Kadaluarsa</label>
                  <input
                    type="date"
                    name="expiresAt"
                    className="form-input"
                    defaultValue={(() => {
                      if (!modal.expiresAt) return '';
                      let d: Date;
                      if (typeof modal.expiresAt.seconds === 'number') d = new Date(modal.expiresAt.seconds * 1000);
                      else d = new Date(modal.expiresAt);
                      if (isNaN(d.getTime())) return '';
                      return d.toISOString().split('T')[0];
                    })()}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select name="isActive" className="form-input" defaultValue={String(modal.isActive ?? true)}>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Terhubung ke Afiliasi</label>
                  <select name="affiliateId" className="form-input" defaultValue={modal.affiliateId || ''}>
                    <option value="">-- Tidak terhubung --</option>
                    {affiliates
                      .filter(a => a.id === modal.affiliateId || !vouchers.some(v => v.affiliateId === a.id))
                      .map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 11, padding: '8px 16px' }}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Delete */}
      {deleteTarget && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeDelete(); }}>
          <div className="modal modal-sm">
            <div className="modal-header"><h2 className="modal-title">Hapus Voucher</h2><button type="button" className="modal-close" onClick={closeDelete}>&times;</button></div>
            <div className="modal-body"><p className="modal-text">Yakin hapus voucher <strong>{deleteTarget.code}</strong>?</p></div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#333' }} onClick={handleDelete}><Trash2 size={12} /> Hapus</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* =============================================
           EMPTY STATE
           ============================================= */
        .voc-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 24px;
          color: #ccc;
          border: 1px dashed #e5e7eb;
          border-radius: 8px;
          background: #fff;
        }

        .voc-empty p { font-size: 13px; color: #999; text-align: center; }

        /* =============================================
           SHARED STATUS BADGES
           ============================================= */
        :global(.voc-status-active) {
          background: #ECFDF5 !important;
          color: #059669 !important;
          border: 1px solid #A7F3D0 !important;
        }

        :global(.voc-status-inactive) {
          background: var(--bg-subtle, #f3f4f6) !important;
          color: var(--text-placeholder, #9CA3AF) !important;
          border: 1px solid var(--border-light, #e5e7eb) !important;
        }

        :global(.voc-status-expired) {
          background: #fff3e0 !important;
          color: #e65100 !important;
          border: 1px solid #ffe0b2 !important;
        }

        .voc-bg-active { background: #ECFDF5; color: #059669; }
        .voc-bg-inactive { background: #f3f4f6; color: #9CA3AF; }
        .voc-bg-expired { background: #fff3e0; color: #e65100; }

        /* =============================================
           DESKTOP TABLE (hidden on mobile)
           ============================================= */
        .voc-desktop-table { display: none; }
        @media (min-width: 768px) { .voc-desktop-table { display: block; } }

        .voc-code-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          font: inherit;
          color: inherit;
          padding: 0;
        }

        .voc-code-text {
          font-family: 'SF Mono', 'Fira Code', monospace;
          letter-spacing: 1px;
          font-size: 12px;
        }

        .voc-table-type {
          text-transform: capitalize;
          font-size: 12px;
        }

        .voc-table-value {
          font-size: 12px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .voc-table-sub {
          font-size: 12px;
          color: var(--text-secondary, #374151);
        }

        /* =============================================
           MOBILE ACCORDION
           ============================================= */
        .voc-mobile-accordion {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 768px) { .voc-mobile-accordion { display: none; } }

        .voc-accordion-card {
          background: #fff;
          border: 0.5px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .voc-accordion-card.expanded {
          border-color: #FDE68A;
          box-shadow: 0 2px 12px rgba(245, 158, 11, 0.08);
        }

        /* Header */
        .voc-accordion-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 14px 16px;
          background: none;
          border: none;
          cursor: pointer;
          gap: 12px;
          text-align: left;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s;
        }

        .voc-accordion-header:active { background: #f9fafb; }

        .voc-accordion-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .voc-accordion-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: #FFFBEB;
          color: #D97706;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .voc-accordion-identity {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .voc-accordion-code {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .voc-accordion-value-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #D97706;
          font-weight: 600;
        }

        .voc-accordion-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .voc-status-sm {
          display: inline-block;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .voc-accordion-chevron {
          color: #ccc;
          transition: transform 0.25s ease;
          flex-shrink: 0;
        }

        .voc-accordion-chevron.rotated {
          transform: rotate(180deg);
          color: #F59E0B;
        }

        /* Body */
        .voc-accordion-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.35s ease;
        }

        .voc-accordion-card.expanded .voc-accordion-body {
          max-height: 700px;
        }

        .voc-accordion-body-inner {
          padding: 0 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Copy Row */
        .voc-copy-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          background: #FFFBEB;
          border: 0.5px solid #FDE68A;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          -webkit-tap-highlight-color: transparent;
          transition: background 0.15s;
        }

        .voc-copy-row:active { background: #FEF3C7; }

        .voc-copy-label {
          font-size: 11px;
          font-weight: 600;
          color: #92400E;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .voc-copy-action {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #6B7280;
        }

        .voc-copy-code {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px;
          font-weight: 600;
          color: #1a1a1a;
          letter-spacing: 0.5px;
        }

        /* Rows */
        .voc-accordion-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .voc-accordion-label {
          font-size: 11px;
          font-weight: 600;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .voc-accordion-value {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          text-align: right;
        }

        .voc-value-highlight {
          font-weight: 700;
          color: #D97706;
        }

        /* Actions */
        .voc-accordion-actions {
          display: flex;
          gap: 8px;
          padding-top: 4px;
          border-top: 0.5px solid #f3f4f6;
        }

        .voc-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 9px 14px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid;
          font-family: inherit;
          flex: 1;
          min-width: 0;
        }

        .voc-action-edit {
          background: #FFFBEB;
          color: #D97706;
          border-color: #FDE68A;
        }
        .voc-action-edit:active { background: #D97706; color: #fff; border-color: #D97706; }

        .voc-action-delete {
          background: #fff;
          color: #9CA3AF;
          border-color: #e5e7eb;
        }
        .voc-action-delete:active { background: #FEF2F2; color: #EF4444; border-color: #FECACA; }

        /* =============================================
           PAGINATION
           ============================================= */
        .voc-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          padding: 12px 0;
        }

        .voc-page-btn {
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          color: #6B7280;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }

        .voc-page-btn:hover:not(:disabled) { border-color: #F59E0B; color: #D97706; background: #FFFBEB; }
        .voc-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .voc-page-info { display: flex; align-items: center; gap: 4px; font-size: 13px; }
        .voc-page-current { font-weight: 700; color: #1a1a1a; }
        .voc-page-sep { color: #d1d5db; }
        .voc-page-total { color: #9CA3AF; }
      `}</style>
    </>
  );
}