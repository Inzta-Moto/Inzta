// app/admin/(panel)/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Grid, Box, FileText, Ticket, Users, DollarSign, Clipboard, ArrowLeft, X, Menu, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: <Grid size={18} /> },
  { href: '/admin/produk', label: 'Produk', icon: <Box size={18} /> },
  { href: '/admin/orders', label: 'Pesanan', icon: <Clipboard size={18} />, key: 'pendingOrders' },
  { href: '/admin/artikel', label: 'Artikel', icon: <FileText size={18} /> },
  { href: '/admin/voucher', label: 'Voucher', icon: <Ticket size={18} /> },
  { href: '/admin/affiliate', label: 'Afiliasi', icon: <Users size={18} /> },
  { href: '/admin/commission', label: 'Komisi', icon: <DollarSign size={18} />, key: 'pendingCommissions' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ pendingOrders: 0, pendingCommissions: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/admin/sidebar-stats');
        if (res.ok) {
          const data = await res.json();
          setStats({
            pendingOrders: data.pendingOrders || 0,
            pendingCommissions: data.pendingCommissions || 0
          });
        }
      } catch (error) {
        console.error('Failed to load stats', error);
      }
    }
    loadStats();
  }, [pathname]); // Refresh stats when route changes

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="admin-body">
      {/* ── Mobile Toggle ── */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-brand">
          <Link href="/admin" onClick={() => setSidebarOpen(false)} style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>INZTA</span>
            <span className="admin-sidebar-tag">ADMIN</span>
          </Link>
        </div>

        <nav className="admin-sidebar-nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive(link.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {link.icon}
                <span>{link.label}</span>
              </div>
              {link.key && stats[link.key as keyof typeof stats] > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}>
                  {stats[link.key as keyof typeof stats]}
                </span>
              )}
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
                body: JSON.stringify({ role: 'admin' })
              });
              window.location.href = '/admin/login';
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
          <div className="topbar-title">Admin Panel</div>
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
