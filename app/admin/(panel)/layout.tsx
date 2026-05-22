// app/admin/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── Icons ──
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function ArticleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Navigation Links ──
const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: <GridIcon /> },
  { href: '/admin/produk', label: 'Produk', icon: <BoxIcon /> },
  { href: '/admin/orders', label: 'Pesanan', icon: <ClipboardIcon /> },
  { href: '/admin/artikel', label: 'Artikel', icon: <ArticleIcon /> },
  { href: '/admin/voucher', label: 'Voucher', icon: <TicketIcon /> },
  { href: '/admin/affiliate', label: 'Afiliasi', icon: <UsersIcon /> },
  { href: '/admin/commission', label: 'Komisi', icon: <DollarIcon /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ products: 0, articles: 0, vouchers: 0, affiliates: 0, pendingCommissions: 0, pendingOrders: 0 });

  useEffect(() => {
    loadSidebarStats();
  }, []);

  async function loadSidebarStats() {
    try {
      const res = await fetch('/api/admin/sidebar-stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load sidebar stats');
      setStats({
        products: data.products || 0,
        articles: data.articles || 0,
        vouchers: data.vouchers || 0,
        affiliates: data.affiliates || 0,
        pendingCommissions: data.pendingCommissions || 0,
        pendingOrders: data.pendingOrders || 0,
      });
    } catch (e) { console.error('[Sidebar Stats]', e); }
  }

  // Badge counts per menu
  const getBadge = (href: string) => {
    if (href === '/admin/commission' && stats.pendingCommissions > 0) return stats.pendingCommissions;
    if (href === '/admin/orders' && stats.pendingOrders > 0) return stats.pendingOrders;
    return 0;
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="admin-layout">
      {/* ── Mobile Topbar ── */}
      <div className="admin-mobile-topbar">
        <button className="admin-mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <XIcon /> : <MenuIcon />}
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>INZTA ADMIN</span>
      </div>

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link href="/admin" onClick={() => setSidebarOpen(false)}>
            <span className="admin-sidebar-logo">INZTA</span>
            <span className="admin-sidebar-sub">Admin Panel</span>
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          {navLinks.map((link) => {
            const badge = getBadge(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-nav-item ${isActive(link.href) ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="admin-nav-icon">{link.icon}</span>
                <span className="admin-nav-label">{link.label}</span>
                {badge > 0 && (
                  <span className="admin-nav-badge">{badge > 99 ? '99+' : badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-nav-item" style={{ color: '#888' }}>
            <span className="admin-nav-icon"><ArrowLeftIcon /></span>
            <span className="admin-nav-label">Kembali ke Toko</span>
          </Link>
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/admin/login';
            }}
            className="admin-nav-item" 
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', marginTop: '4px', textAlign: 'left' }}
          >
            <span className="admin-nav-icon"><XIcon /></span>
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

        .admin-nav-badge {
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 10px;
          line-height: 1.6;
          min-width: 20px;
          text-align: center;
        }

        .admin-nav-item.active .admin-nav-badge {
          background: rgba(255,255,255,0.25);
          color: #fff;
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
