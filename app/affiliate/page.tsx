'use client';

import { useState, useEffect, FormEvent } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firebaseConfig } from '@/lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut } from 'firebase/auth';
import { Affiliate } from '@/types';
import { Copy, Check, Users, Phone, Mail } from 'lucide-react';
import { formatDate } from '@/lib/utils';

// Secondary app untuk buat user tanpa ngeluarin admin dari session
const apps = getApps();
const secondaryApp = apps.length > 1 ? apps[1] : initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

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
      const snap = await getDocs(collection(db, 'affiliates'));
      setAffiliates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Affiliate)).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
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
      await deleteDoc(doc(db, 'affiliates', deleteTarget.id));
      try { await deleteDoc(doc(db, 'vouchers', deleteTarget.voucherCode)); } catch (e) { /* ignore */ }
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
      let uid = modal?.uid || '';

      // Kalau bukan edit, atau email berubah → buat auth user baru
      if (!editId || (modal?.email && modal.email !== email)) {
        try {
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          uid = userCred.user.uid;
          await secondarySignOut(secondaryAuth); // Logout dari secondary biar ga ganggu
        } catch (authErr: any) {
          let msg = 'Gagal buat akun: ';
          if (authErr.code === 'auth/email-already-in-use') msg += 'Email sudah dipakai akun lain.';
          else if (authErr.code === 'auth/weak-password') msg += 'Password minimal 6 karakter.';
          else msg += authErr.message;
          setFormError(msg);
          setSaving(false);
          return;
        }
      }

      const data: Affiliate = { id, name, phone, email, uid, voucherCode, createdAt: modal?.createdAt || serverTimestamp() as any };

      await setDoc(doc(db, 'affiliates', id), data, { merge: true });
      
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
        createdAt: modal?.createdAt || serverTimestamp() as any,
      };
      await setDoc(doc(db, 'vouchers', voucherCode), voucherData, { merge: true });
      closeModal(); loadAffiliates();
    } catch (err: any) { setFormError('Gagal menyimpan: ' + err.message); }
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
                <td style={{ fontSize: 12 }}>{formatDate(a.createdAt)}</td>
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

              {!modal.createdAt && (
                <div className="form-group">
                  <label className="form-label">Password Login *</label>
                  <input name="password" type="password" className="form-input" required minLength={6} placeholder="Minimal 6 karakter" />
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