'use client';

import { useState, useEffect } from 'react';
import { Zap, ZapOff, Loader2, CalendarDays, Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  const [isActive, setIsActive] = useState(false);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [customDays, setCustomDays] = useState<number>(3);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      setIsActive(data.isActive || false);
      setEndsAt(data.endsAt || null);
    } catch (e) {
      console.error(e);
    }
  }

  async function activate(days: number) {
    setLoading(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: days }),
      });
      await loadSettings();
    } catch (e) {
      alert('Gagal mengaktifkan');
    } finally {
      setLoading(false);
    }
  }

  async function deactivate() {
    setLoading(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationDays: 0 }),
      });
      await loadSettings();
    } catch (e) {
      alert('Gagal menonaktifkan');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Pengaturan</h1>
      </div>

      <div className="admin-table-wrap" style={{ padding: '24px', overflow: 'visible' }}>
        
        {/* Header Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ width: '40px', height: '40px', background: '#FEF3C7', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FDE68A', flexShrink: 0 }}>
            <Zap size={20} color="#D97706" />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Flash Sale & Countdown</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>Atur penawaran waktu terbatas di halaman utama website.</p>
          </div>
        </div>

        {/* Status Info */}
        {isActive && endsAt ? (
          <div style={{ fontSize: '13px', color: '#059669', background: '#ECFDF5', padding: '14px 16px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} />
            <div>
              Flash Sale sedang <strong>Aktif</strong> hingga: <strong>{new Date(endsAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#6B7280', background: 'var(--bg-subtle)', padding: '14px 16px', borderRadius: '6px', marginBottom: '20px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ZapOff size={16} />
            Flash Sale sedang tidak aktif. Aktifkan untuk menampilkan countdown di homepage.
          </div>
        )}

        {/* Quick Actions */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label">Aktivasi Cepat</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => activate(1)} disabled={loading} className="btn btn-primary" style={{ fontSize: '11px', padding: '8px 16px', background: '#F59E0B' }}>
              1 Hari
            </button>
            <button onClick={() => activate(3)} disabled={loading} className="btn btn-primary" style={{ fontSize: '11px', padding: '8px 16px', background: '#F59E0B' }}>
              3 Hari
            </button>
            <button onClick={() => activate(7)} disabled={loading} className="btn btn-primary" style={{ fontSize: '11px', padding: '8px 16px', background: '#F59E0B' }}>
              7 Hari
            </button>
          </div>
        </div>

        {/* Custom Duration */}
        <div className="form-group" style={{ marginBottom: '24px', background: 'var(--bg-subtle)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <label className="form-label">
            <CalendarDays size={12} style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }} />
            Durasi Custom (Hari)
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input 
              type="number" 
              min={1} 
              max={365} 
              value={customDays} 
              onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
              className="form-input"
              style={{ maxWidth: '120px' }}
            />
            <button 
              onClick={() => activate(customDays)} 
              disabled={loading} 
              className="btn btn-primary" 
              style={{ fontSize: '11px', padding: '10px 20px', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Memproses...' : 'Aktifkan'}
            </button>
          </div>
        </div>

        {/* Deactivate Button */}
        {isActive && (
          <button 
            onClick={deactivate} 
            disabled={loading} 
            className="btn btn-ghost" 
            style={{ fontSize: '11px', padding: '8px 16px', color: '#EF4444', borderColor: '#FCA5A5' }}
          >
            <ZapOff size={12} /> Matikan Flash Sale Sekarang
          </button>
        )}

      </div>
    </>
  );
}