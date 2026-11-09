'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { auth, WA_NUMBER } from '@/lib/firebase';
import { whatsappUrl } from '@/lib/affiliate/dashboard';
import { AffiliateBrand } from '@/components/affiliate/AffiliateHeader';
import RouteSteps, { COMMISSION_STEPS, COMMISSION_STEPS_TITLE } from '@/components/affiliate/RouteSteps';
import '@/app/affiliate/affiliate-login.css';

type LoginError = 'credentials' | 'session' | null;

const ERROR_TEXT: Record<Exclude<LoginError, null>, string> = {
  credentials: 'Email atau password salah. Periksa lagi lalu coba masuk.',
  session: 'Gagal membuat sesi. Coba lagi.',
};

// Same message as the pre-F-023 "Gabung sekarang" link, so the admin gets the request they already know.
const JOIN_URL = whatsappUrl(WA_NUMBER, 'Halo, saya ingin mendaftar jadi affiliate Inzta');
const FORGOT_URL = whatsappUrl(
  WA_NUMBER,
  'Halo admin INZTA, saya affiliate dan lupa password untuk masuk ke dashboard affiliate. Mohon bantu reset password saya.',
);

const ERROR_ID = 'aff-login-error';

/**
 * Affiliate login (F-023 E1-E6). Phones: photo strip with the title, light form card below. From 1024 px: photo panel
 * with the commission route on the left, form card on a krem panel on the right. The data flow is the F-017/F-021 one,
 * unchanged: Firebase Auth, then /api/auth/session with role affiliate, then the localStorage keys, then the dashboard.
 */
export default function AffiliateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<LoginError>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // E4: focus moves to the message, so keyboard and screen reader users land on what went wrong. Every submit clears
  // the error first, so a repeated failure with the same message still moves focus again.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    let idToken: string;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      idToken = await userCredential.user.getIdToken();
    } catch {
      setError('credentials');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role: 'affiliate' }),
      });
      if (!response.ok) {
        setError('session');
        setLoading(false);
        return;
      }
      const data: { voucherCode?: string | null } = await response.json();
      // The server session is already set; blocked storage (private mode, full quota) must not stop the redirect.
      try {
        localStorage.setItem('is_affiliate_logged_in', 'true');
        if (data.voucherCode) {
          localStorage.setItem('inzta_affiliate', data.voucherCode);
        }
        // F-021: the affiliate's own code for "Salin link" ('' = no voucher), kept apart from inzta_affiliate,
        // which a ?aff= link visited later overwrites.
        localStorage.setItem('inzta_affiliate_own', data.voucherCode || '');
      } catch {}
      router.replace('/affiliate/dashboard');
    } catch {
      setError('session');
      setLoading(false);
    }
  };

  const credentialsWrong = error === 'credentials';

  return (
    <main className="iz-aff-login">
      <div className="iz-aff-login__frame">
        <div className="iz-aff-login__panel">
          <div className="iz-aff-login__photo" aria-hidden="true">
            {/* Mood photo only, so no alt text. It is the largest element on phones, hence priority. */}
            <Image src="/images/v2/foto/road-01.webp" alt="" fill priority sizes="(min-width: 1024px) 780px, 100vw" />
          </div>
          <div className="iz-aff-login__scrim" aria-hidden="true" />
          <div className="iz-aff-topo iz-aff-topo--fade iz-aff-login__topo" aria-hidden="true" />
          <div className="iz-aff-glow iz-aff-login__glow" aria-hidden="true" />

          <AffiliateBrand size="lg" />

          {/* The page title. From 1024 px the photo panel shows the pitch instead; the title stays for screen readers. */}
          <div className="iz-aff-login__intro">
            <h1 className="iz-aff-login__title">Masuk ke dashboard affiliate</h1>
            <p className="iz-aff-login__lead">Lihat link, kode voucher, dan komisi Anda.</p>
          </div>

          <div className="iz-aff-login__pitch">
            <p className="iz-aff-login__claim">Bagikan link, komisi tercatat untuk Anda.</p>
            <RouteSteps steps={COMMISSION_STEPS} title={COMMISSION_STEPS_TITLE} tone="dark" orientation="auto" headingLevel={2} />
          </div>
        </div>

        <div className="iz-aff-login__side">
          <div className="iz-aff-topo iz-aff-topo--ink iz-aff-login__ink" aria-hidden="true" />
          <div className="iz-aff-login__col">
            <section className="iz-aff-card iz-aff-login__card" aria-labelledby="aff-login-heading">
              <div className="iz-aff-login__head">
                <h2 id="aff-login-heading" className="iz-aff-login__heading">
                  Masuk
                </h2>
                <p className="iz-aff-login__hint">Pakai email dan password dari admin INZTA.</p>
              </div>

              <form className="iz-aff-login__form" onSubmit={handleSubmit} aria-busy={loading}>
                <div className="iz-aff-login__field">
                  <label className="iz-aff-login__label" htmlFor="aff-login-email">
                    Email
                  </label>
                  <input
                    id="aff-login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="iz-aff-login__input"
                    placeholder="email@contoh.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    readOnly={loading}
                    required
                    aria-invalid={credentialsWrong || undefined}
                    aria-describedby={credentialsWrong ? ERROR_ID : undefined}
                  />
                </div>

                <div className="iz-aff-login__field">
                  <label className="iz-aff-login__label" htmlFor="aff-login-password">
                    Password
                  </label>
                  <div className="iz-aff-login__control">
                    <input
                      id="aff-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="iz-aff-login__input iz-aff-login__input--pwd"
                      placeholder="Password Anda"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      readOnly={loading}
                      required
                      aria-invalid={credentialsWrong || undefined}
                      aria-describedby={credentialsWrong ? ERROR_ID : undefined}
                    />
                    <button
                      type="button"
                      className="iz-aff-login__eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      aria-pressed={showPassword}
                      aria-controls="aff-login-password"
                    >
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div id={ERROR_ID} ref={errorRef} className="iz-aff-login__error" role="alert" tabIndex={-1}>
                    <AlertTriangle aria-hidden="true" />
                    <span>{ERROR_TEXT[error]}</span>
                  </div>
                )}

                <button type="submit" className="iz-aff-btn iz-aff-btn--primary iz-aff-btn--lg iz-aff-btn--block" disabled={loading}>
                  {loading ? (
                    <>
                      <RefreshCw className="iz-aff-spin" aria-hidden="true" />
                      Memproses…
                    </>
                  ) : (
                    'Masuk'
                  )}
                </button>
              </form>

              {/* D-11: next to the form, where a failed login leaves the eye. */}
              <p className="iz-aff-login__forgot">
                Lupa password?{' '}
                <a href={FORGOT_URL} target="_blank" rel="noopener noreferrer">
                  Chat admin INZTA<span className="iz-aff-sr-only"> untuk reset password (WhatsApp)</span>
                </a>
              </p>
            </section>

            <div className="iz-aff-login__links">
              <p className="iz-aff-login__join">
                Belum jadi affiliate?{' '}
                <a href={JOIN_URL} target="_blank" rel="noopener noreferrer">
                  Chat admin INZTA<span className="iz-aff-sr-only"> untuk daftar affiliate (WhatsApp)</span>
                </a>
              </p>
              <Link href="/" className="iz-aff-login__back">
                <ArrowLeft aria-hidden="true" />
                Kembali ke toko
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
