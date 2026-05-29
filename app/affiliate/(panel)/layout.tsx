// app/affiliate/(panel)/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid, ArrowLeft, X, Menu, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const navLinks = [
  { href: '/affiliate/dashboard', label: 'Dashboard', icon: <Grid size={18} /> },
];

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="admin-body">
      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-brand" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
          <Link href="/affiliate/dashboard" onClick={() => setSidebarOpen(false)} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>INZTA</span>
            <span className="admin-sidebar-tag">AFFILIATE</span>
          </Link>
          <button 
            className="md:hidden" 
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          ))}
          
          <div className="sidebar-divider"></div>
          
          <Link href="/" className="sidebar-link" onClick={() => setSidebarOpen(false)}>
            <ArrowLeft size={18} />
            <span>Kembali ke Toko</span>
          </Link>
          
          <button 
            onClick={async () => {
              await signOut(auth);
              await fetch('/api/auth/logout', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'affiliate' })
              });
              localStorage.removeItem('inzta_affiliate');
              localStorage.removeItem('is_affiliate_logged_in');
              window.location.href = '/affiliate/login';
            }}
            className="sidebar-link logout" 
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* ── Overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
      )}

      {/* ── Main Content ── */}
      <main className="admin-main">
        <div className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* ── Mobile Toggle ── */}
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="topbar-title">Dashboard Affiliate</div>
          </div>
          <div className="topbar-user">
            <span className="topbar-user-dot"></span> Online
          </div>
        </div>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}

