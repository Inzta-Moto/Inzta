'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import '@/app/admin/admin.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Eye, EyeOff } from 'lucide-react'; // ✅ Import ikon

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isHidden, setIsHidden] = useState<boolean>(true); // ✅ State untuk sembunyikan teks (default: tersembunyi)

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
      else if (err.code === 'auth/wrong-password') msg = 'Password salah.';
      else if (err.code === 'auth/invalid-credential') msg = 'Email atau password salah.';
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
                autoComplete="email" 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text"
                  value={accessCode} 
                  onChange={e => setAccessCode(e.target.value)} 
                  className="form-input" 
                  placeholder="Masukkan password" 
                  autoComplete="off"
                  required 
                  style={{ 
                    paddingRight: '44px',
                    // ✅ TRIK CSS: Gunakan as React.CSSProperties agar TypeScript tidak error
                    WebkitTextSecurity: isHidden ? 'disc' : 'none', 
                  } as React.CSSProperties} 
                />
                {/* ✅ Tombol Eye Icon */}
                <button
                  type="button"
                  onClick={() => setIsHidden(!isHidden)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9CA3AF',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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