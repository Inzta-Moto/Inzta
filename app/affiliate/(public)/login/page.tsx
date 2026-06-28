'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import '@/app/admin/admin.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
import { WA_NUMBER } from '@/lib/firebase';
import Link from 'next/link';

export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false); // ✅ State untuk toggle eye
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(''); setLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, accessCode);
      const idToken = await userCredential.user.getIdToken();

      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role: 'affiliate' }),
      });

      if (response.ok) {
        const data = await response.json();
        // Mark as affiliate in local storage
        localStorage.setItem('is_affiliate_logged_in', 'true');
        
        if (data.voucherCode) {
            localStorage.setItem('inzta_affiliate', data.voucherCode);
        }
        
        router.replace('/affiliate/dashboard');
      } else {
        setError('Gagal membuat sesi.');
        setLoading(false);
      }
    } catch (err: any) {
      setError('Login gagal. Email atau password salah.');
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-body">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-brand">INZTA</div>
          <p className="login-subtitle">Dashboard Affiliate</p>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="form-input" 
                placeholder="affiliate@inzta.id" 
                autoComplete="email" 
                required 
              />
            </div>
            
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Password</label> {/* ✅ Ganti label */}
              <input 
                type="text" // ✅ BIARIN TEXT AGAR CHROME TIDAK DETEKSI PASSWORD
                value={accessCode} 
                onChange={e => setAccessCode(e.target.value)} 
                className="form-input" 
                placeholder="Masukkan password" // ✅ Ganti placeholder
                autoComplete="off" 
                style={{ 
                  paddingRight: '40px',
                  // ✅ TRIK CSS: Jika showCode false (mata tertutup), ubah teks jadi titik. Jika true, tampilkan teks biasa.
                  WebkitTextSecurity: !showCode ? 'disc' : 'none', 
                } as React.CSSProperties} // ✅ Tambahan agar TypeScript tidak error
                required 
              />
              
              <button 
                type="button" 
                onClick={() => setShowCode(!showCode)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '34px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-placeholder)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label="Lihat password"
              >
                {showCode ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
            
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              <span>{loading ? 'Memproses...' : 'Masuk'}</span>
            </button>
          </form>
          
          <p className="login-hint">
            Belum jadi affiliate? <a href={`https://wa.me/${WA_NUMBER}?text=Halo, saya ingin mendaftar jadi affiliate Inzta`} target="_blank" rel="noopener noreferrer" style={{color: 'var(--accent)', fontWeight: 600}}>Gabung sekarang</a>
          </p>
        </div>
      </div>
    </div>
  );
}