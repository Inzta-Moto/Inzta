'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react'; // ← Import ikon mata

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(false); // ← State untuk toggle mata
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
        router.replace('/admin');
      } else {
        setError('Gagal membuat sesi admin.');
      }
    } catch (err: any) {
      let msg = 'Login gagal.';
      if (err.code === 'auth/user-not-found') msg = 'Email tidak ditemukan.';
      else if (err.code === 'auth/wrong-password') msg = 'Kode akses salah.';
      else if (err.code === 'auth/invalid-credential') msg = 'Email atau kode akses salah.';
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="admin-login-body">
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-brand">INZTA</div>
          <p className="login-subtitle">Admin Panel</p>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="form-input" 
                placeholder="admin@inzta.id" 
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
              
              {/* Tombol Ikon Mata */}
              <button 
                type="button" 
                onClick={() => setShowCode(!showCode)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '34px', // Posisi sejajar dengan input
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
          
          <p className="login-hint">Akses terbatas. Hanya admin yang bisa masuk.</p>
        </div>
      </div>
    </div>
  );
}
