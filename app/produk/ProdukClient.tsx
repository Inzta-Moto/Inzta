'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { Product } from '@/types';
import { ArrowLeft, Search, SlidersHorizontal, X } from 'lucide-react';

export default function ProdukClient({ initialProducts }: { initialProducts: Product[] }) {
  const [allProducts] = useState<Product[]>(initialProducts);
  const [filtered, setFiltered] = useState<Product[]>(initialProducts);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => { applyFilter(); }, [activeFilter, activeTab, allProducts, searchQuery]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function applyFilter() {
    let result = allProducts;

    if (activeFilter !== 'all') {
      result = result.filter(p => p.category === activeFilter);
    }

    if (activeTab === 'best-seller') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('best'));
    } else if (activeTab === 'new') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('new'));
    } else if (activeTab === 'diskon') {
      result = result.filter(p => p.originalPrice && p.originalPrice > p.price);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.features && p.features.some(f => f.toLowerCase().includes(q)))
      );
    }

    setFiltered(result);
  }

  const tabs = [
    { key: 'all', label: 'Semua' },
    { key: 'best-seller', label: 'Best Seller' },
    { key: 'new', label: 'New' },
    { key: 'diskon', label: 'Diskon' },
  ];

  const categories = [
    { key: 'all', label: 'Semua Produk' },
    { key: 'hardcase', label: 'Hardcase' },
    { key: 'softcase', label: 'Softcase' },
    { key: 'tank', label: 'Tank Bag' },
  ];

  function handleSelectCategory(key: string) {
    setActiveFilter(key);
    setFilterOpen(false);
  }

  return (
    <>
      <Header active="produk" />

      <section className="page-header page-header-with-bg produk-hero">
        <div className="page-header-bg">
          <img src="https://down-id.img.susercontent.com/file/id-11134207-7r98x-lsd01sx4skwped" alt="Motorcycle" />
        </div>
        <div className="hero-overlay"></div>
        <div className="container">
          <div className="page-header-content">
            <h1 className="page-title">Semua Produk</h1>
            <p className="page-desc">Koleksi tas motor premium INZTA untuk setiap kebutuhan riding Anda.</p>
          </div>
        </div>
      </section>

      <div className="produk-mobile-top">
        <div className="produk-mobile-header">
          <Link href="/" className="produk-back-btn" aria-label="Kembali">
            <ArrowLeft size={20} />
          </Link>
          <div className="produk-mobile-search">
            <Search size={16} className="produk-search-icon" />
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="produk-filter-wrap" ref={filterRef}>
            <button
              className={`produk-filter-btn ${filterOpen ? 'active' : ''}`}
              onClick={() => setFilterOpen(!filterOpen)}
              aria-label="Kategori"
            >
              <SlidersHorizontal size={18} />
            </button>
            <div className={`produk-filter-panel ${filterOpen ? 'open' : ''}`}>
              <div className="produk-filter-panel-header">
                <span>Kategori</span>
                <button onClick={() => setFilterOpen(false)} aria-label="Tutup">
                  <X size={16} />
                </button>
              </div>
              <ul className="produk-filter-list">
                {categories.map(c => (
                  <li key={c.key}>
                    <button
                      className={activeFilter === c.key ? 'active' : ''}
                      onClick={() => handleSelectCategory(c.key)}
                    >
                      {c.label}
                      {activeFilter === c.key && <span className="produk-filter-check">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="produk-mobile-cats">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`produk-cat-pill ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <section className="section products-section">
        <div className="container">
          <div className="produk-desktop-search">
            <Search size={16} className="produk-search-icon" />
            <input
              type="text"
              placeholder="Cari tas, fitur, kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="produk-layout">
            <div className="produk-main">
              <div className="produk-main-header">
                <span>Jumlah <strong>{filtered.length}</strong> produk</span>
              </div>
              <div className="product-grid product-grid-full">
                {filtered.length === 0 ? (
                  <div className="empty-state">
                    <p>Tidak ada produk yang cocok dengan pencarian Anda.</p>
                  </div>
                ) : filtered.map(p => <ProductCard key={p.slug} product={p} showDetails={true} />)}
              </div>
            </div>

            <aside className="produk-sidebar-right">
              <div className="sidebar-block">
                <div className="sidebar-block-title">Label</div>
                <ul className="sidebar-menu">
                  {tabs.map(t => (
                    <li key={t.key}>
                      <button
                        className={activeTab === t.key ? 'active' : ''}
                        onClick={() => setActiveTab(t.key)}
                      >
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sidebar-block">
                <div className="sidebar-block-title">Kategori</div>
                <ul className="sidebar-menu">
                  {categories.map(c => (
                    <li key={c.key}>
                      <button
                        className={activeFilter === c.key ? 'active' : ''}
                        onClick={() => setActiveFilter(c.key)}
                      >
                        {c.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
