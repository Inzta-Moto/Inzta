'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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
    // Placeholder untuk logika login
    setTimeout(() => {
        console.log('Login attempt', email, accessCode);
        setLoading(false);
        // Nanti redirect ke dashboard affiliator
        // router.replace('/affiliate/dashboard');
    }, 1000);
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
