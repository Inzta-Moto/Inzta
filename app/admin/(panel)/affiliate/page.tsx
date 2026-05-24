'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Affiliate } from '@/types';
import { formatDate } from '@/lib/utils';
import { Copy, Check, Users, Phone, Mail, Edit2, Trash2 } from 'lucide-react';

function generateAffCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'AFF-';
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
  const [currentPage, setCurrentPage] = useState(1);
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

  const openAdd = () => { 
    setModal({ name: '', phone: '', email: '', uid: '' }); 
    setFormError(''); 
  };
  const openEdit = (a: Affiliate) => { setModal({ ...a }); setFormError(''); };
  const closeModal = () => { setModal(null); setFormError(''); };
  const openDelete = (a: Affiliate) => setDeleteTarget({ id: a.id, name: a.name });
  const closeDelete = () => setDeleteTarget(null);

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(''), 1500); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Find voucher associated with this affiliate and delete it
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

    if (!name || !phone || !email) { 
      setFormError('Semua field wajib diisi.'); 
      setSaving(false); 
      return; 
    }

    try {
      const data: any = { 
        id, 
        name, 
        phone, 
        email, 
        uid: modal?.uid || '', 
        password: password || undefined,
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
      if (!res.ok) {
        throw new Error(resData.error || 'Gagal menyimpan afiliasi');
      }
      
      if (isNew) {
        const voucherData = {
          code: data.voucherCode,
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
          createdAt: new Date().toISOString(),
        };

        await fetch('/api/admin/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(voucherData),
        });
      }

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
            <tr><th>Afiliasi</th><th>Email</th><th>No. HP</th><th>Bergabung</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {affiliates.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">Belum ada afiliasi.</td></tr>
            ) : affiliates.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map(a => (
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
                <td style={{ fontSize: 12 }}>{formatDate(a.createdAt)}</td>
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

      {affiliates.length > ITEMS_PER_PAGE && (
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
            Halaman {currentPage} dari {Math.ceil(affiliates.length / ITEMS_PER_PAGE)}
          </span>
          <button 
            className="btn btn-ghost" 
            disabled={currentPage === Math.ceil(affiliates.length / ITEMS_PER_PAGE)} 
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(affiliates.length / ITEMS_PER_PAGE), p + 1))}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            Selanjutnya
          </button>
        </div>
      )}

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
    </>
  );
}
