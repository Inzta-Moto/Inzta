'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react';
import { WA_NUMBER } from '@/lib/firebase';
import Link from 'next/link';

export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false);
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
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        // Fetch affiliate info to get voucher code
        const affRes = await fetch('/api/affiliate/commissions'); // Reusing this to find the affiliate
        const affData = await affRes.json();
        if (affRes.ok && affData.commissions && affData.commissions.length > 0) {
            localStorage.setItem('inzta_affiliate', affData.commissions[0].voucherCode);
        } else {
            // Fallback: try fetching from a dedicated endpoint if needed, but for now this works to get the voucher code
             const res = await fetch('/api/admin/affiliates'); // Need a way to get affiliate profile
             const data = await res.json();
             const user = data.affiliates.find((a: any) => a.email === email);
             if (user) localStorage.setItem('inzta_affiliate', user.voucherCode);
        }
        router.replace('/affiliate/dashboard');
      } else {
        setError('Gagal membuat sesi.');
      }
    } catch (err: any) {
      setError('Login gagal. Email atau kode akses salah.');
    }
    setLoading(false);
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
                autoComplete="off" 
                required 
              />
            </div>
            
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Kode Akses</label>
              <input 
                type={showCode ? 'text' : 'password'} 
                value={accessCode} 
                onChange={e => setAccessCode(e.target.value)} 
                className="form-input" 
                placeholder="Masukkan kode rahasia" 
                autoComplete="off" 
                style={{ paddingRight: '40px' }}
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
                aria-label="Lihat kode"
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
