'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Affiliate } from '@/types';
import { Copy, Check, Users, Phone, Mail } from 'lucide-react';

function generateAffCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AFF-';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function AffiliatePage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [modal, setModal] = useState<Partial<Affiliate> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; voucherCode: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

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

  const openAdd = () => { 
    setModal({ name: '', phone: '', email: '', uid: '', voucherCode: generateAffCode() }); 
    setFormError(''); 
  };
  const openEdit = (a: Affiliate) => { setModal({ ...a }); setFormError(''); };
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (a: Affiliate) => setDeleteTarget({ id: a.id, name: a.name, voucherCode: a.voucherCode });
  const closeDelete = () => setDeleteTarget(null);

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(''), 1500); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch('/api/admin/affiliates/' + deleteTarget.id, { method: 'DELETE' });
      try { await fetch('/api/admin/vouchers/' + deleteTarget.voucherCode, { method: 'DELETE' }); } catch (e) { /* ignore */ }
      closeDelete(); loadAffiliates();
    } catch (e: any) { alert(e.message); }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const fd = new FormData(e.currentTarget);
    const editId = fd.get('editId') as string;
    const id = editId || Date.now().toString();
    const voucherCode = (fd.get('voucherCode') as string).toUpperCase().trim();
    const name = (fd.get('name') as string).trim();
    const phone = (fd.get('phone') as string).trim();
    const email = (fd.get('email') as string).trim();
    const password = (fd.get('password') as string);

    if (!name || !phone || !voucherCode || !email) { 
      setFormError('Semua field wajib diisi.'); 
      setSaving(false); 
      return; 
    }

    try {
      const data = { 
        id, 
        name, 
        phone, 
        email, 
        uid: modal?.uid || '', 
        password: password || undefined,
        voucherCode, 
        createdAt: modal?.createdAt || new Date().toISOString()
      };

      const res = await fetch('/api/admin/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal menyimpan afiliasi');
      }
      
      const voucherData = {
        code: voucherCode,
        type: 'percentage' as const,
        value: 0,
        minPurchase: 0,
        maxDiscount: 0,
        affiliateId: id,
        affiliateName: name,
        isActive: true,
        usageCount: 0,
        maxUsage: null,
        expiresAt: null,
        createdAt: modal?.createdAt || new Date().toISOString(),
      };

      await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voucherData),
      });

      closeModal(); loadAffiliates();
    } catch (err: any) { 
      setFormError(err.message); 
    }
    setSaving(false);
  };

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Afiliasi</h1>
        <button className="btn btn-primary" onClick={openAdd} style={{ fontSize: 11, padding: '8px 16px' }}>+ Tambah Afiliasi</button>
      </div>

      <div style={{ marginBottom: 20, padding: '14px 18px', background: '#f8f9fa', borderRadius: 10, border: '1px solid #e9ecef', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
        <strong style={{ color: '#1a1a1a' }}>ℹ️ Cara Kerja Afiliasi:</strong><br />
        1. Buat akun afiliasi (email & password) → voucher otomatis dibuat<br />
        2. Atur nilai diskon voucher afiliasi di halaman <strong>Voucher</strong><br />
        3. Afiliasi login di <code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>/affiliate</code> pakai email & password<br />
        4. Saat customer pakai voucher, komisi <strong>5%</strong> otomatis tercatat
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Afiliasi</th><th>Email</th><th>No. HP</th><th>Voucher Code</th><th>Bergabung</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {affiliates.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">Belum ada afiliasi.</td></tr>
            ) : affiliates.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} color="#888" />
                    </div>
                    <strong style={{ fontSize: 13 }}>{a.name}</strong>
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Mail size={12} color="#888" /> {a.email}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Phone size={12} color="#888" /> {a.phone}
                  </div>
                </td>
                <td>
                  <button onClick={() => copyCode(a.voucherCode)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                    <span style={{ fontFamily: 'monospace', letterSpacing: 1, fontSize: 12, background: '#f0f0f0', padding: '3px 8px', borderRadius: 4 }}>{a.voucherCode}</span>
                    {copiedCode === a.voucherCode ? <Check size={12} color="green" /> : <Copy size={12} color="#aaa" />}
                  </button>
                </td>
                <td style={{ fontSize: 12 }}>{a.createdAt ? (typeof a.createdAt === 'object' ? new Date(a.createdAt.seconds * 1000).toLocaleDateString('id-ID') : new Date(a.createdAt).toLocaleDateString('id-ID')) : '-'}</td>
                <td>
                  <div className="table-actions">
                    <button className="table-btn" onClick={() => openEdit(a)}>✏️</button>
                    <button className="table-btn danger" onClick={() => openDelete(a)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

              <div className="form-group">
                <label className="form-label">Email Login *</label>
                <input name="email" type="email" className="form-input" required defaultValue={modal.email || ''} placeholder="afiliasi@email.com" />
              </div>

              {(!modal.createdAt || modal.email) && (
                <div className="form-group">
                  <label className="form-label">Password Login {modal.createdAt ? '(Kosongkan jika tidak ganti)' : '*'}</label>
                  <input name="password" type="password" className="form-input" required={!modal.createdAt} minLength={6} placeholder="Minimal 6 karakter" />
                  <small style={{ color: '#999', fontSize: 11, marginTop: 4, display: 'block' }}>Password ini dipakai afiliasi untuk login di /affiliate</small>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">No. HP (WhatsApp) *</label>
                <input name="phone" className="form-input" required defaultValue={modal.phone || ''} placeholder="08xxxxxxxxxx" />
              </div>

              <div className="form-group">
                <label className="form-label">Kode Voucher Afiliasi *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input name="voucherCode" className="form-input" required value={modal.voucherCode || ''} onChange={e => setModal(prev => prev ? { ...prev, voucherCode: e.target.value.toUpperCase() } : { voucherCode: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }} />
                  <button type="button" onClick={() => setModal(prev => prev ? { ...prev, voucherCode: generateAffCode() } : { voucherCode: generateAffCode() })} style={{ padding: '0 12px', border: '1px solid #ddd', borderRadius: 8, background: '#f5f5f5', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>Acak</button>
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
            <div className="modal-header"><h2 className="modal-title">Hapus Afiliasi</h2><button type="button" className="modal-close" onClick={closeDelete}>&times;</button></div>
            <div className="modal-body">
              <p className="modal-text">Yakin hapus afiliasi <strong>{deleteTarget.name}</strong>?</p>
              <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Voucher terkait ({deleteTarget.voucherCode}) juga akan dihapus.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDelete} style={{ fontSize: 11, padding: '8px 16px' }}>Batal</button>
              <button className="btn btn-primary" style={{ fontSize: 11, padding: '8px 16px', background: '#333' }} onClick={handleDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
