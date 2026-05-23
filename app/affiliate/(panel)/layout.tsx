// app/affiliate/(panel)/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid, ArrowLeft, X, Menu } from 'lucide-react';

const navLinks = [
  { href: '/affiliate/dashboard', label: 'Dashboard', icon: <Grid size={18} /> },
];

export default function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <div className="admin-layout">
      {/* ── Mobile Topbar ── */}
      <div className="admin-mobile-topbar">
        <button className="admin-mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>INZTA AFFILIATE</span>
      </div>

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link href="/affiliate/dashboard" onClick={() => setSidebarOpen(false)}>
            <span className="admin-sidebar-logo">INZTA</span>
            <span className="admin-sidebar-sub">Dashboard Affiliate</span>
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`admin-nav-item ${isActive(link.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="admin-nav-icon">{link.icon}</span>
              <span className="admin-nav-label">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-nav-item" style={{ color: '#888' }}>
            <span className="admin-nav-icon"><ArrowLeft size={18} /></span>
            <span className="admin-nav-label">Kembali ke Toko</span>
          </Link>
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/affiliate/login';
            }}
            className="admin-nav-item" 
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', marginTop: '4px', textAlign: 'left' }}
          >
            <span className="admin-nav-icon"><X size={18} /></span>
            <span className="admin-nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Overlay (mobile) ── */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ── */}
      <main className="admin-main">
        <div className="admin-main-inner">
          {children}
        </div>
      </main>

      {/* ── Styles ── */}
      <style jsx global>{`
        .admin-layout {
          display: flex;
          min-height: 100vh;
          background: #f5f5f5;
        }

        /* ── Sidebar ── */
        .admin-sidebar {
          width: 240px;
          min-height: 100vh;
          background: #fff;
          border-right: 1px solid #eee;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 100;
          transition: transform 0.3s ease;
        }

        .admin-sidebar-header {
          padding: 24px 20px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .admin-sidebar-header a {
          text-decoration: none;
          display: block;
        }

        .admin-sidebar-logo {
          font-size: 20px;
          font-weight: 800;
          color: #1a1a1a;
          letter-spacing: -0.5px;
          display: block;
        }

        .admin-sidebar-sub {
          font-size: 11px;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
          display: block;
        }

        .admin-sidebar-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-radius: 10px;
          text-decoration: none;
          color: #666;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.15s ease;
          position: relative;
        }

        .admin-nav-item:hover {
          background: #f8f8f8;
          color: #1a1a1a;
        }

        .admin-nav-item.active {
          background: #1a1a1a;
          color: #fff;
        }

        .admin-nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .admin-nav-label {
          flex: 1;
        }

        .admin-sidebar-footer {
          padding: 10px;
          border-top: 1px solid #f0f0f0;
        }

        /* ── Main Content ── */
        .admin-main {
          flex: 1;
          margin-left: 240px;
          min-height: 100vh;
        }

        .admin-main-inner {
          padding: 28px 32px 48px;
          max-width: 1100px;
        }

        /* ── Mobile Topbar ── */
        .admin-mobile-topbar {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: #fff;
          border-bottom: 1px solid #eee;
          z-index: 90;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
        }

        .admin-mobile-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid #eee;
          background: #fff;
          cursor: pointer;
          color: #1a1a1a;
        }

        .admin-sidebar-overlay {
          display: none;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .admin-mobile-topbar {
            display: flex;
          }

          .admin-sidebar {
            transform: translateX(-100%);
          }

          .admin-sidebar.open {
            transform: translateX(0);
          }

          .admin-sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 99;
          }

          .admin-main {
            margin-left: 0;
            padding-top: 56px;
          }

          .admin-main-inner {
            padding: 20px 16px 48px;
          }
        }
      `}</style>
    </div>
  );
}
