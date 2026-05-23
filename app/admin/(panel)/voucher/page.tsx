'use client';

import { useState, useEffect, FormEvent } from 'react';
import { formatPrice } from '@/lib/utils';
import { Voucher, Affiliate } from '@/types';
import { Copy, Check, Ticket, Edit2, Trash2 } from 'lucide-react';

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
      value: parseFloat(fd.get('value') as string) || 0,
      minPurchase: parseFloat(fd.get('minPurchase') as string) || 0,
      maxDiscount: parseFloat(fd.get('maxDiscount') as string) || 0,
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

  const isExpired = (v: Voucher) => v.expiresAt && v.expiresAt.seconds * 1000 < Date.now();

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Voucher</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Buat Voucher</button>
      </div>

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
            {vouchers.length === 0 ? (
              <tr><td colSpan={9} className="table-empty">Belum ada voucher.</td></tr>
            ) : vouchers.map(v => (
              <tr key={v.code}>
                <td>
                  <button onClick={() => copyCode(v.code)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <Ticket size={14} style={{ color: '#888' }} />
                    <strong style={{ fontFamily: 'monospace', letterSpacing: 1, fontSize: 12 }}>{v.code}</strong>
                    {copiedCode === v.code ? <Check size={12} color="green" /> : <Copy size={12} color="#aaa" />}
                  </button>
                </td>
                <td style={{ textTransform: 'capitalize', fontSize: 12 }}>{v.type === 'percentage' ? 'Persen' : 'Nominal'}</td>
                <td style={{ fontSize: 12 }}>{v.type === 'percentage' ? `${v.value}%` : formatPrice(v.value)}</td>
                <td style={{ fontSize: 12 }}>{v.minPurchase ? formatPrice(v.minPurchase) : '-'}</td>
                <td style={{ fontSize: 12 }}>{v.type === 'percentage' && v.maxDiscount ? formatPrice(v.maxDiscount) : '-'}</td>
                <td style={{ fontSize: 12 }}>{v.usageCount}{v.maxUsage ? ` / ${v.maxUsage}` : ''}</td>
                <td style={{ fontSize: 12 }}>{v.affiliateName || '-'}</td>
                <td>
                  {!v.isActive ? <span className="table-badge table-badge-inactive">Nonaktif</span> :
                   isExpired(v) ? <span className="table-badge" style={{ background: '#fff3e0', color: '#e65100' }}>Kadaluarsa</span> :
                   <span className="table-badge table-badge-active">Aktif</span>}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="table-btn" onClick={() => openEdit(v)}><Edit2 size={16} /></button>
                    <button className="table-btn danger" onClick={() => openDelete(v.code)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                  <input type="number" name="value" className="form-input" min={0} step={modal.type === 'percentage' ? 1 : 1000} defaultValue={modal.value || ''} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Minimum Pembelian</label>
                  <input type="number" name="minPurchase" className="form-input" min={0} step={1000} defaultValue={modal.minPurchase || 0} />
                </div>
                <div className="form-group">
                  <label className="form-label">Maks. Diskon {modal.type !== 'percentage' && <span style={{ color: '#999', fontWeight: 400 }}>(persen saja)</span>}</label>
                  <input type="number" name="maxDiscount" className="form-input" min={0} step={1000} defaultValue={modal.maxDiscount || 0} disabled={modal.type !== 'percentage'} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Maks. Penggunaan</label>
                  <input type="number" name="maxUsage" className="form-input" min={0} defaultValue={modal.maxUsage || ''} placeholder="Kosongkan = unlimited" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal Kadaluarsa</label>
                  <input type="date" name="expiresAt" className="form-input" defaultValue={modal.expiresAt ? new Date(modal.expiresAt.seconds * 1000).toISOString().split('T')[0] : ''} />
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
                    {affiliates.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.voucherCode})</option>
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
    </>
  );
}
