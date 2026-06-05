'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Affiliate } from '@/types';
import { formatDate } from '@/lib/utils';
import { Copy, Check, Users, Phone, Mail, Edit2, Trash2, Eye, EyeOff, Percent, ChevronDown } from 'lucide-react';

function generateAffCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'INZ-';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function AffiliatePage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [modal, setModal] = useState<Partial<Affiliate> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedAffs, setExpandedAffs] = useState<Set<string>>(new Set());
  const ITEMS_PER_PAGE = 10;

  useEffect(() => { loadAffiliates(); }, []);

  async function loadAffiliates() {
    try {
      const res = await fetch('/api/admin/affiliates');
      const data = await res.json();
      if (res.ok && data.affiliates) {
        setAffiliates(data.affiliates as Affiliate[]);
      }
    } catch (e) { console.error(e); }
  }

  const openAdd = () => { setModal({ name: '', phone: '', email: '', uid: '' }); setFormError(''); };
  const openEdit = (a: Affiliate) => { setModal({ ...a }); setFormError(''); };
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (a: Affiliate) => setDeleteTarget({ id: a.id, name: a.name });
  const closeDelete = () => setDeleteTarget(null);

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(''), 1500); };

  const toggleExpand = (id: string) => {
    setExpandedAffs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch('/api/admin/vouchers');
      const data = await res.json();
      const affiliateVoucher = data.vouchers?.find((v: any) => v.affiliateId === deleteTarget.id);
      await fetch('/api/admin/affiliates/' + deleteTarget.id, { method: 'DELETE' });
      if (affiliateVoucher) {
        try { await fetch('/api/admin/vouchers/' + affiliateVoucher.code, { method: 'DELETE' }); } catch (e) { /* ignore */ }
      }
      closeDelete(); loadAffiliates();
    } catch (e: any) { alert(e.message); }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const editId = fd.get('editId') as string;
    const id = editId || Date.now().toString();
    const isNew = !editId;
    const name = (fd.get('name') as string).trim();
    const phone = (fd.get('phone') as string).trim();
    const email = (fd.get('email') as string).trim();
    const password = (fd.get('password') as string);
    const commissionRate = parseFloat(fd.get('commissionRate') as string);

    if (!name || !phone || !email) {
      setFormError('Nama, Email, dan No. HP wajib diisi.');
      setSaving(false); return;
    }

    if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      setFormError('Komisi harus berupa angka antara 0 - 100.');
      setSaving(false); return;
    }

    try {
      const data: any = {
        id, name, phone, email,
        uid: modal?.uid || '',
        password: password || undefined,
        commissionRate: commissionRate,
        createdAt: modal?.createdAt || new Date().toISOString()
      };

      if (isNew) {
        data.voucherCode = generateAffCode();
      } else if (modal?.voucherCode) {
        data.voucherCode = modal.voucherCode;
      }

      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Gagal menyimpan afiliasi');

      if (isNew) {
        const voucherData = {
          code: data.voucherCode, type: 'percentage' as const, value: 0,
          minPurchase: 0, maxDiscount: 0, affiliateId: id, affiliateName: name,
          isActive: true, usageCount: 0, maxUsage: null, expiresAt: null,
          createdAt: new Date().toISOString(),
        };
        await fetch('/api/admin/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(voucherData),
        });
      }

      closeModal(); loadAffiliates();
    } catch (err: any) { setFormError(err.message); }
    setSaving(false);
  };

  const pagedAffiliates = affiliates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(affiliates.length / ITEMS_PER_PAGE);

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Afiliasi</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Afiliasi</button>
      </div>

      <div className="aff-info-box">
        <strong>ℹ️ Cara Kerja Afiliasi:</strong><br />
        1. Buat akun afiliasi (email, password & komisi) → voucher otomatis dibuat<br />
        2. Atur nilai diskon voucher afiliasi di halaman <strong>Voucher</strong><br />
        3. Afiliasi login di <code>/affiliate</code> pakai email & password<br />
        4. Saat customer pakai voucher, komisi otomatis tercatat sesuai persentase
      </div>

      {affiliates.length === 0 ? (
        <div className="aff-empty">
          <Users size={40} strokeWidth={1.2} />
          <p>Belum ada afiliasi.</p>
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="aff-desktop-table">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Afiliasi</th>
                    <th>Email</th>
                    <th>No. HP</th>
                    <th>Komisi</th>
                    <th>Bergabung</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAffiliates.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div className="aff-table-user">
                          <div className="aff-avatar"><Users size={16} /></div>
                          <strong style={{ fontSize: 13 }}>{a.name}</strong>
                        </div>
                      </td>
                      <td className="aff-table-contact"><Mail size={12} /> {a.email}</td>
                      <td className="aff-table-contact"><Phone size={12} /> {a.phone}</td>
                      <td>
                        <span className="aff-commission-badge">
                          {(a as any).commissionRate !== undefined && (a as any).commissionRate !== null
                            ? `${(a as any).commissionRate}%`
                            : '-'
                          }
                        </span>
                      </td>
                      <td className="aff-table-date">{formatDate(a.createdAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button className="table-btn" onClick={() => openEdit(a)}><Edit2 size={16} /></button>
                          <button className="table-btn danger" onClick={() => openDelete(a)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: Accordion */}
          <div className="aff-mobile-accordion">
            {pagedAffiliates.map(a => {
              const isExpanded = expandedAffs.has(a.id);
              const commission = (a as any).commissionRate !== undefined && (a as any).commissionRate !== null
                ? `${(a as any).commissionRate}%`
                : null;

              return (
                <div key={a.id} className={`aff-accordion-card ${isExpanded ? 'expanded' : ''}`}>
                  <button className="aff-accordion-header" onClick={() => toggleExpand(a.id)}>
                    <div className="aff-accordion-left">
                      <div className="aff-avatar">
                        <Users size={15} />
                      </div>
                      <div className="aff-accordion-identity">
                        <span className="aff-accordion-name">{a.name}</span>
                        <span className="aff-accordion-sub">{a.email}</span>
                      </div>
                    </div>
                    <div className="aff-accordion-right">
                      {commission && <span className="aff-commission-badge-sm">{commission}</span>}
                      <ChevronDown size={16} className={`aff-accordion-chevron ${isExpanded ? 'rotated' : ''}`} />
                    </div>
                  </button>

                  <div className="aff-accordion-body">
                    <div className="aff-accordion-body-inner">
                      {/* Commission */}
                      <div className="aff-accordion-row">
                        <span className="aff-accordion-label">Komisi</span>
                        {commission ? (
                          <span className="aff-commission-badge">{commission}</span>
                        ) : (
                          <span className="aff-na">-</span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="aff-accordion-row">
                        <span className="aff-accordion-label">No. HP</span>
                        <span className="aff-accordion-value">{a.phone}</span>
                      </div>

                      {/* Joined */}
                      <div className="aff-accordion-row">
                        <span className="aff-accordion-label">Bergabung</span>
                        <span className="aff-accordion-value">{formatDate(a.createdAt)}</span>
                      </div>

                      {/* Actions */}
                      <div className="aff-accordion-actions">
                        <button className="aff-action-btn aff-action-edit" onClick={() => openEdit(a)}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button className="aff-action-btn aff-action-delete" onClick={() => openDelete(a)}>
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
      {affiliates.length > ITEMS_PER_PAGE && (
        <div className="aff-pagination">
          <button className="aff-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>← Sebelumnya</button>
          <div className="aff-page-info">
            <span className="aff-page-current">{currentPage}</span>
            <span className="aff-page-sep">/</span>
            <span className="aff-page-total">{totalPages}</span>
          </div>
          <button className="aff-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Selanjutnya →</button>
        </div>
      )}

      {/* Modal Add/Edit */}
      {modal !== null && (
        <div className="modal-overlay" style={{ display: 'flex' }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">{modal.createdAt ? 'Edit Afiliasi' : 'Tambah Afiliasi'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              <input type="hidden" name="editId" defaultValue={modal.id || ''} />
              {formError && <div className="form-error" style={{ marginBottom: 16 }}>{formError}</div>}

              <div className="form-group">
                <label className="form-label">Nama Afiliasi *</label>
                <input name="name" className="form-input" required defaultValue={modal.name || ''} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email Login *</label>
                  <input name="email" type="email" className="form-input" required defaultValue={modal.email || ''} placeholder="afiliasi@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Komisi (%) *</label>
                  <input
                    name="commissionRate"
                    type="number"
                    className="form-input"
                    required
                    min={0} max={100} step={0.1}
                    placeholder="Contoh: 10"
                    defaultValue={(modal as any)?.commissionRate ?? ''}
                  />
                </div>
              </div>

              {(!modal.createdAt || modal.email) && (
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Password Login {modal.createdAt ? '(Kosongkan jika tidak ganti)' : '*'}</label>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    required={!modal.createdAt}
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="aff-pw-toggle"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <small style={{ color: '#999', fontSize: 11, marginTop: 4, display: 'block' }}>Password ini dipakai afiliasi untuk login di /affiliate</small>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">No. HP (WhatsApp) *</label>
                <input name="phone" className="form-input" required defaultValue={modal.phone || ''} placeholder="08xxxxxxxxxx" />
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
            <div className="modal-header"><h2 className="modal-title">Hapus Afiliasi</h2><button type="button" className="modal-close" onClick={closeDelete}>&times;</button></div>
            <div className="modal-body">
              <p className="modal-text">Yakin hapus afiliasi <strong>{deleteTarget.name}</strong>?</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Voucher terkait juga akan dihapus.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#333' }} onClick={handleDelete}><Trash2 size={12} /> Hapus</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* =============================================
           INFO BOX
           ============================================= */
        .aff-info-box {
          margin-bottom: 20px;
          padding: 14px 18px;
          background: #f8f9fa;
          border-radius: 10px;
          border: 0.5px solid #e9ecef;
          font-size: 13px;
          color: #555;
          line-height: 1.6;
        }

        .aff-info-box strong { color: #1a1a1a; }

        .aff-info-box code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }

        /* =============================================
           EMPTY STATE
           ============================================= */
        .aff-empty {
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

        .aff-empty p { font-size: 13px; color: #999; text-align: center; }

        /* =============================================
           SHARED ELEMENTS
           ============================================= */
        .aff-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #888;
        }

        .aff-commission-badge {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #a7f3d0;
        }

        .aff-commission-badge-sm {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          color: #059669;
          background: #ecfdf5;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid #a7f3d0;
          white-space: nowrap;
        }

        .aff-na { color: #ccc; }

        /* =============================================
           DESKTOP TABLE (hidden on mobile)
           ============================================= */
        .aff-desktop-table { display: none; }
        @media (min-width: 768px) { .aff-desktop-table { display: block; } }

        .aff-table-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .aff-table-contact {
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-secondary);
        }

        .aff-table-date {
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        /* =============================================
           MOBILE ACCORDION
           ============================================= */
        .aff-mobile-accordion {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 768px) { .aff-mobile-accordion { display: none; } }

        .aff-accordion-card {
          background: #fff;
          border: 0.5px solid #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .aff-accordion-card.expanded {
          border-color: #C7D2FE;
          box-shadow: 0 2px 12px rgba(99, 102, 241, 0.08);
        }

        /* Header */
        .aff-accordion-header {
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

        .aff-accordion-header:active { background: #f9fafb; }

        .aff-accordion-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .aff-accordion-identity {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .aff-accordion-name {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .aff-accordion-sub {
          font-size: 11px;
          color: #9CA3AF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .aff-accordion-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .aff-accordion-chevron {
          color: #ccc;
          transition: transform 0.25s ease;
          flex-shrink: 0;
        }

        .aff-accordion-chevron.rotated {
          transform: rotate(180deg);
          color: #6366F1;
        }

        /* Body */
        .aff-accordion-body {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.35s ease;
        }

        .aff-accordion-card.expanded .aff-accordion-body {
          max-height: 400px;
        }

        .aff-accordion-body-inner {
          padding: 0 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aff-accordion-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .aff-accordion-label {
          font-size: 11px;
          font-weight: 600;
          color: #9CA3AF;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }

        .aff-accordion-value {
          font-size: 12px;
          font-weight: 500;
          color: #374151;
          text-align: right;
        }

        /* Actions */
        .aff-accordion-actions {
          display: flex;
          gap: 8px;
          padding-top: 4px;
          border-top: 0.5px solid #f3f4f6;
        }

        .aff-action-btn {
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

        .aff-action-edit {
          background: #EEF2FF;
          color: #4F46E5;
          border-color: #C7D2FE;
        }
        .aff-action-edit:active { background: #4F46E5; color: #fff; border-color: #4F46E5; }

        .aff-action-delete {
          background: #fff;
          color: #9CA3AF;
          border-color: #e5e7eb;
        }
        .aff-action-delete:active { background: #FEF2F2; color: #EF4444; border-color: #FECACA; }

        /* =============================================
           PAGINATION
           ============================================= */
        .aff-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 24px;
          padding: 12px 0;
        }

        .aff-page-btn {
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

        .aff-page-btn:hover:not(:disabled) { border-color: #6366F1; color: #4F46E5; background: #EEF2FF; }
        .aff-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        .aff-page-info { display: flex; align-items: center; gap: 4px; font-size: 13px; }
        .aff-page-current { font-weight: 700; color: #1a1a1a; }
        .aff-page-sep { color: #d1d5db; }
        .aff-page-total { color: #9CA3AF; }

        /* =============================================
           PASSWORD TOGGLE
           ============================================= */
        .aff-pw-toggle {
          position: absolute;
          right: 12px;
          top: 34px;
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .aff-pw-toggle:hover { color: #555; }
      `}</style>
    </>
  );
}