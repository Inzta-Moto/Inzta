'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
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
        body: JSON.stringify({ idToken, role: 'admin' }),
      });

      if (response.ok) {
        router.replace('/admin');
      } else {
        setError('Gagal membuat sesi admin.');
        setLoading(false);
      }
    } catch (err: any) {
      let msg = 'Login gagal.';
      if (err.code === 'auth/user-not-found') msg = 'Email tidak ditemukan.';
      else if (err.code === 'auth/wrong-password') msg = 'Kode akses salah.';
      else if (err.code === 'auth/invalid-credential') msg = 'Email atau kode akses salah.';
      setError(msg);
      setLoading(false);
    }
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
            
            <div className="form-group">
              <label className="form-label">Kode Akses</label>
              <input 
                type="text" 
                value={accessCode} 
                onChange={e => setAccessCode(e.target.value)} 
                className="form-input" 
                placeholder="Masukkan kode rahasia" 
                autoComplete="off" 
                required 
              />
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