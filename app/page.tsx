'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowRight, ShieldCheck, Feather, Lock, Wrench, LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { Product, Feature } from '@/types';

import Gallery from '@/components/Gallery';
import Testimonials from '@/components/Testimonials';
import BlogSection from '@/components/BlogSection';
import FAQ from '@/components/FAQ';

const heroImages = [
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780326022/99_u0fbp7.jpg',
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780324954/01_rmqx6d.jpg',
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780325195/04_avqwtg.jpg'
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentSlide, setCurrentSlide] = useState<number>(0);



  const typeLines = ['RIDE WITH', 'INZTA.'];
  const [displayedLines, setDisplayedLines] = useState(['', '']);
  const [typeLine, setTypeLine] = useState(0);
  const [typeChar, setTypeChar] = useState(0);
  const [typePhase, setTypePhase] = useState<'typing' | 'pausing' | 'erasing'>('typing');
  const [showHeroContent, setShowHeroContent] = useState(false);
  const [firstPassDone, setFirstPassDone] = useState(false);

  useEffect(() => { loadFeatured(); loadFeatures(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let delay: number;

    if (typePhase === 'typing') {
      delay = typeChar === 0 ? 500 : 75;
      const timer = setTimeout(() => {
        if (typeLine >= typeLines.length) {
          if (!firstPassDone) { setFirstPassDone(true); setShowHeroContent(true); }
          setTypePhase('pausing');
          return;
        }
        if (typeChar <= typeLines[typeLine].length) {
          setDisplayedLines(prev => { const next = [...prev]; next[typeLine] = typeLines[typeLine].slice(0, typeChar); return next; });
          setTypeChar(prev => prev + 1);
        } else { setTypeLine(prev => prev + 1); setTypeChar(0); }
      }, delay);
      return () => clearTimeout(timer);
    }

    if (typePhase === 'pausing') {
      delay = 2200;
      const timer = setTimeout(() => setTypePhase('erasing'), delay);
      return () => clearTimeout(timer);
    }

    if (typePhase === 'erasing') {
      delay = 40;
      const timer = setTimeout(() => {
        if (typeLine < 0) { setTypeLine(0); setTypeChar(0); setTypePhase('typing'); return; }
        if (typeChar <= 0) { setTypeLine(prev => prev - 1); setTypeChar(typeLines[typeLine - 1]?.length ?? 0); return; }
        setDisplayedLines(prev => { const next = [...prev]; next[typeLine] = typeLines[typeLine].slice(0, typeChar - 1); return next; });
        setTypeChar(prev => prev - 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [typeLine, typeChar, typePhase, firstPassDone]);

  async function loadFeatured() {
    try {
      const snap = await getDocs(collection(db, 'products'));
      // ✅ UBAH JADI 4 AGAR DI HP MUNCUL 4 CARD
      let items: Product[] = snap.docs.map(d => d.data() as Product)
        .filter(p => p.isActive === true)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 10);
      setProducts(items);
    } catch (e) { console.error('[Featured]', e); }
  }

  async function loadFeatures() {
    try {
      const snap = await getDocs(collection(db, 'features'));
      let items: Feature[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Feature))
        .filter(f => f.isActive === true)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      if (items.length > 0) setFeatures(items);
    } catch (e) { console.warn('[Features]', e); }
  }

  const iconMap: Record<string, LucideIcon> = { 'shield-check': ShieldCheck, feather: Feather, lock: Lock, wrench: Wrench };
  const fallbackFeatures: Feature[] = [
    { icon: 'shield-check', title: 'Waterproof 100%', description: 'Material tahan air premium. Barang Anda aman dalam segala kondisi cuaca.', order: 1, isActive: true },
    { icon: 'feather', title: 'Ultra Ringan', description: 'Bobot minimal, kapasitas maksimal. Tidak menambah beban berkendara.', order: 2, isActive: true },
    { icon: 'lock', title: 'Anti-Desain', description: 'Desain low-profile mengurangi risiko pencurian. Safety first approach.', order: 3, isActive: true },
    { icon: 'wrench', title: 'Universal Fit', description: 'Kompatibel dengan semua jenis motor. Instalasi mudah tanpa modifikasi.', order: 4, isActive: true },
  ];
  const displayFeatures = features.length > 0 ? features : fallbackFeatures;

  return (
    <>
      <Header active="home" />

      {/* ====== HERO ====== */}
      <section className="hero">
        <div className="hero-carousel">
          {heroImages.map((img, i) => (
            <div key={i} className={`hero-carousel-item ${i === currentSlide ? 'active' : ''}`}>
              <img src={img} alt={`Motorcycle ${i + 1}`} />
            </div>
          ))}
        </div>
        <div className="hero-overlay"></div>

        <div className="container">
          <div className="hero-inner hero-inner-center">
            <div className="hero-content">
              <p className="hero-eyebrow hero-fade-up" style={{ animationDelay: '0.1s' }}>INZTA MOTO</p>

              <h1 className="hero-title">
                <span className="typing-line">
                  {displayedLines[0]}
                  {(typeLine === 0 && typePhase === 'typing') && <span className="typing-cursor" />}
                </span>
                <span className="typing-line">
                  <span className="hero-title-outline">{displayedLines[1]}</span>
                  {(typeLine >= 1 || typePhase === 'erasing') && <span className="typing-cursor" />}
                </span>
              </h1>

              <p className={`hero-desc ${showHeroContent ? 'hero-fade-up' : 'hero-hidden'}`}>
                Tas motor premium yang didesain untuk rider modern. Proteksi maksimal, desain minimal, performa tanpa kompromi.
              </p>

              <div className={`hero-actions ${showHeroContent ? 'hero-fade-up' : 'hero-hidden'}`} style={showHeroContent ? { animationDelay: '0.15s' } : undefined}>
                <Link href="/produk" className="btn btn-primary">Lihat Koleksi <ArrowRight size={16} className="btn-icon" /></Link>
                <a href={`https://wa.me/6289513482410`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-ghost-light">Hubungi Kami</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FEATURES ====== */}
      <section className="section features" id="features">
        <div className="container">
          <div className="section-header">
            <p className="section-eyebrow">Mengapa Pilih Inzta</p>
            <h2 className="section-title">Style & Function</h2>
          </div>
          <div className="features-grid">
            {displayFeatures.map((f, i) => {
              const IconComp = iconMap[f.icon];
              return (
                <div className="feature-card" key={i}>
                  <div className="feature-icon">{IconComp ? <IconComp size={18} /> : <Wrench size={18} />}</div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

{/* ====== FEATURED PRODUCTS ====== */}
<section className="section featured featured-section-bg">
  <div className="container">
    <div className="section-header section-header-row">
      <div className="section-header-left">
        <p className="section-eyebrow">Koleksi Unggulan</p>
        <h2 className="section-title">Pilihan Terbaik</h2>
        <p className="section-desc">Produk yang paling diminati oleh rider Indonesia.</p>
      </div>
      <Link href="/produk" className="section-view-all">
        Lihat Semua Produk <ArrowRight size={14} />
      </Link>
    </div>

    <div className="product-scroll-wrapper">
      <div className="product-scroll-track">
        {products.length === 0
          ? <div className="empty-state"><p>Belum ada produk aktif.</p></div>
          : products.map(p => <ProductCard key={p.slug} product={p} showDetails={false} />)}
      </div>
    </div>

    <Link href="/produk" className="section-mobile-view-all">
      Lihat Semua Produk <ArrowRight size={14} />
    </Link>
  </div>
</section>

      {/* ====== GALLERY ====== */}
      <Gallery />

      {/* ====== TESTIMONIALS ====== */}
      <Testimonials />

      {/* ====== BLOG ====== */}
      <BlogSection />

      {/* ====== FAQ ====== */}
      <FAQ />

      {/* ====== CTA BANNER ====== */}
      <section className="cta-banner">
        <div className="container">
          <div className="cta-inner">
            <h2 className="cta-title">Tampil Stylish<br />Saat Riding?</h2>
            <p className="cta-desc">Dapatkan tas motor terbaik dengan harga spesial minggu ini.</p>
            <Link href="/produk" className="btn btn-primary">Lihat Koleksi <ArrowRight size={16} className="btn-icon" /></Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
