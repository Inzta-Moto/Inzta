'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // ← TAMBAHKAN INI
import { WA_NUMBER } from '@/lib/firebase';

interface HeaderProps {
  active: 'home' | 'produk' | 'blog';
}

export default function Header({ active }: HeaderProps) {
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <header className={`header${scrolled ? ' scrolled' : ''}`}>
        <div className="container">
          <div className="header-inner">
            
            {/* ← UBAH BAGIAN INI */}
            <Link href="/" className="header-logo">
              <Image 
                src="/logo-inzta.png" // Ganti sesuai nama file logo Anda di folder public
                alt="INZTA Logo" 
                width={24} 
                height={24} 
                className="header-logo-img" 
              />
              INZTA
            </Link>
            
            <nav className="header-nav">
              <Link href="/" className={active === 'home' ? 'active' : ''}>Home</Link>
              <Link href="/produk" className={active === 'produk' ? 'active' : ''}>Produk</Link>
              <Link href="/blog" className={active === 'blog' ? 'active' : ''}>Blog</Link>
              <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer">Kontak</a>
            </nav>

            <div className="header-right">
              <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
                <div className={`hamburger-box${mobileOpen ? ' open' : ''}`}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div className={`mobile-backdrop${mobileOpen ? ' open' : ''}`} onClick={() => setMobileOpen(false)} />

      {/* Slide-in Panel */}
      <div className={`mobile-panel${mobileOpen ? ' open' : ''}`}>
        <div className="mobile-panel-inner">
          <nav className="mobile-panel-nav">
            <Link href="/" className={`mobile-nav-item ${active === 'home' ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
              Home
              <span className="nav-indicator"></span>
            </Link>
            <Link href="/produk" className={`mobile-nav-item ${active === 'produk' ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
              Produk
              <span className="nav-indicator"></span>
            </Link>
            <Link href="/blog" className={`mobile-nav-item ${active === 'blog' ? ' active' : ''}`} onClick={() => setMobileOpen(false)}>
              Artikel / Blog
              <span className="nav-indicator"></span>
            </Link>
            <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" className="mobile-nav-item" onClick={() => setMobileOpen(false)}>
              Kontak
              <span className="nav-indicator"></span>
            </a>
          </nav>
          
          <div className="mobile-panel-footer">
            <div className="mobile-social-row">
              <a href="https://instagram.com/inzta.id" target="_blank" rel="noopener noreferrer" aria-label="Instagram">IG</a>
              <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WA</a>
              <a href="https://tiktok.com/@inzta.id" target="_blank" rel="noopener noreferrer" aria-label="TikTok">FB</a>
            </div>
            <p className="mobile-copyright">&copy; {new Date().getFullYear()} INZTA</p>
          </div>
        </div>
      </div>
    </>
  );
}