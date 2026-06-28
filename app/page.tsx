'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowRight, ShieldCheck, Feather, Lock, Wrench, LucideIcon, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Product, Feature } from '@/types';
import { optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';


const Gallery = dynamic(() => import('@/components/Gallery'));
const Testimonials = dynamic(() => import('@/components/Testimonials'));
const BlogSection = dynamic(() => import('@/components/BlogSection'));
const FAQ = dynamic(() => import('@/components/FAQ'));
const Footer = dynamic(() => import('@/components/Footer'));

const heroImages = [
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780326022/99_u0fbp7.jpg',
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780324954/01_rmqx6d.jpg',
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780325195/04_avqwtg.jpg',
  'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780670761/099_oaaken.jpg',
];

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [openFeature, setOpenFeature] = useState<number | null>(0);



  const typeLines = ['PRIDE WITH', 'INZTAMOTO.'];
  const [displayedLines, setDisplayedLines] = useState(['PRIDE WITH', 'INZTAMOTO.']);
  const [typeLine, setTypeLine] = useState(2);
  const [typeChar, setTypeChar] = useState(0);
  const [typePhase, setTypePhase] = useState<'typing' | 'pausing' | 'erasing'>('pausing');
  const [showHeroContent, setShowHeroContent] = useState(true);
  const [firstPassDone, setFirstPassDone] = useState(true);


    // REF UNTUK CAROUSEL (Agar panah bisa menggeser card)
  const scrollRef = useRef<HTMLDivElement>(null);

  // FUNGSI UNTUK MENGGERAKKAN CAROUSEL
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320; // Jarak geser per klik panah
      const newScrollLeft = direction === 'left' 
        ? scrollRef.current.scrollLeft - scrollAmount 
        : scrollRef.current.scrollLeft + scrollAmount;
        
      scrollRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };
  // STATE UNTUK FLASH SALE (KONEKSI KE DATABASE ADMIN)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [flashSaleActive, setFlashSaleActive] = useState(false);

  useEffect(() => {
    // Ambil data flash sale dari server
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.isActive && data.endsAt) {
          setFlashSaleActive(true);
          const endTime = new Date(data.endsAt).getTime();

          const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
              clearInterval(timer);
              setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); // ✅ TAMBAHKAN days: 0
              setFlashSaleActive(false);
              return;
            }

            setTimeLeft({
              days: Math.floor(distance / (1000 * 60 * 60 * 24)),
              hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
              minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
              seconds: Math.floor((distance % (1000 * 60)) / 1000),
            });
          }, 1000);

        } else {
          setFlashSaleActive(false); // Sembunyikan jika admin mematikan
        }
      })
      .catch(() => setFlashSaleActive(false));
  }, []);

  // KOMPONEN KECIL UNTUK KOTAK COUNTDOWN
  const CountdownItem = ({ value }: { value: number }) => (
    <div className="countdown-item">
      <span className="countdown-value">{value < 10 ? `0${value}` : value}</span>
    </div>
  );

  // LOGIKA TYPING EFFECT FLASH SALE
  const flashTexts = ['FLASH SALE', 'EXTRA DISKON', 'SPECIAL PRICE'];
  const [flashDisplayed, setFlashDisplayed] = useState('');
  const [flashTextIndex, setFlashTextIndex] = useState(0);
  const [flashCharIndex, setFlashCharIndex] = useState(0);
  const [flashPhase, setFlashPhase] = useState<'typing' | 'pausing' | 'erasing'>('typing');

  useEffect(() => {
    let delay: number;

    if (flashPhase === 'typing') {
      delay = flashCharIndex === 0 ? 400 : 70;
      const timer = setTimeout(() => {
        if (flashCharIndex <= flashTexts[flashTextIndex].length) {
          setFlashDisplayed(flashTexts[flashTextIndex].slice(0, flashCharIndex));
          setFlashCharIndex(prev => prev + 1);
        } else {
          setFlashPhase('pausing');
        }
      }, delay);
      return () => clearTimeout(timer);
    }

    if (flashPhase === 'pausing') {
      delay = 2000;
      const timer = setTimeout(() => setFlashPhase('erasing'), delay);
      return () => clearTimeout(timer);
    }

    if (flashPhase === 'erasing') {
      delay = 35;
      const timer = setTimeout(() => {
        if (flashCharIndex <= 0) {
          setFlashTextIndex(prev => (prev + 1) % flashTexts.length);
          setFlashPhase('typing');
        } else {
          setFlashDisplayed(flashTexts[flashTextIndex].slice(0, flashCharIndex - 1));
          setFlashCharIndex(prev => prev - 1);
        }
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [flashPhase, flashCharIndex, flashTextIndex]);


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
    } catch (e) { /* Silently use fallback if permission denied */ }
  }

  async function loadFeatures() {
    try {
      const snap = await getDocs(collection(db, 'features'));
      let items: Feature[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Feature))
        .filter(f => f.isActive === true)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      if (items.length > 0) setFeatures(items);
    } catch (e) { /* Silently use fallback if permission denied */ }
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
              <img 
                src={optimizeCloudinaryUrl(img, 1920)} 
                srcSet={generateCloudinarySrcSet(img, [600, 800, 1200, 1920])}
                sizes="100vw"
                alt={`Motorcycle ${i + 1}`} 
                {...(i === 0 ? { fetchPriority: 'high' } : { loading: 'lazy' })}
              />
            </div>
          ))}
        </div>
        <div className="hero-overlay"></div>

        <div className="container">
          <div className="hero-inner hero-inner-center">
            <div className="hero-content">
              <p className="hero-eyebrow hero-fade-up" style={{ animationDelay: '0.1s' }}>ENTHUSIAST JOURNEY</p>

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
              
              // ✅ TAMBAHKAN: Array gambar untuk masing-masing card
              const featureImages = [
                'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780326022/99_u0fbp7.jpg', // Gambar utk card 1
                'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780324954/01_rmqx6d.jpg', // Gambar utk card 2
                'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780325195/04_avqwtg.jpg', // Gambar utk card 3
                'https://res.cloudinary.com/dukddlp0b/image/upload/q_auto/f_auto/v1780670761/099_oaaken.jpg' // Gambar utk card 4
              ];

              return (
                <div 
                  className="feature-card" 
                  key={i}
                  style={{ backgroundImage: `url(${optimizeCloudinaryUrl(featureImages[i] || featureImages[0], 600)})` }}
                >
                  <div className="feature-card-overlay"></div>
                  <div className="feature-card-content">
                    <div className="feature-icon">{IconComp ? <IconComp size={18} /> : <Wrench size={18} />}</div>
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


            {/* ====== FEATURED PRODUCTS / FLASH SALE ====== */}
      <section className="section featured featured-section-bg">
        <div className="container">
          
          {/* ✅ LOGIKA BARU: Jika Flash Sale Aktif, tampilan Banner Kuning. Jika mati, tampilan header biasa */}
          {flashSaleActive ? (
            <div className="flashsale-banner">
              <div className="flashsale-banner-inner">
                <div className="flashsale-title-area">
                  <h2 className="flashsale-heading">
                    <img src="/logo.png" alt="Inzta" className="flashsale-logo" /> {flashDisplayed}<span className="typing-cursor"></span>
                  </h2>
                </div>

                <div className="flashsale-countdown">
                  <span className="countdown-label">Berakhir dalam</span>
                  <div className="countdown-timer">
                    {/* ✅ TAMBAHAN HARI */}
                    <CountdownItem value={timeLeft.days} />
                    <span className="countdown-separator">:</span>
                    <CountdownItem value={timeLeft.hours} />
                    <span className="countdown-separator">:</span>
                    <CountdownItem value={timeLeft.minutes} />
                    <span className="countdown-separator">:</span>
                    <CountdownItem value={timeLeft.seconds} />
                  </div>
                </div>

                <Link href="/produk" className="flashsale-view-all">
                  Lihat Semua <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            /* Header Produk Standar (Muncul saat Flash Sale mati) */
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
          )}

          {/* ✅ CAROUSEL PRODUK (SELALU TAMPIL) */}
          <div className="product-scroll-wrapper">
            <button className="carousel-arrow carousel-arrow-left" onClick={() => scrollCarousel('left')}>
              <ChevronLeft size={20} />
            </button>

            <div className="product-scroll-track" ref={scrollRef}>
              {products.length === 0
                ? <div className="empty-state"><p>Belum ada produk aktif.</p></div>
                : products.map(p => <ProductCard key={p.slug} product={p} showDetails={false} />)}
            </div>

            <button className="carousel-arrow carousel-arrow-right" onClick={() => scrollCarousel('right')}>
              <ChevronRight size={20} />
            </button>
          </div>

          <Link href="/produk" className="section-mobile-view-all">
            Lihat Semua Produk <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* ====== GALLERY ====== */}
      <Gallery />

            {/* ====== FEATURE HIGHLIGHT ====== */}
      <section className="highlight-section">
        <div className="container">
          <div className="highlight-inner">
            <p className="highlight-eyebrow">Premium Engineering</p>
            <h2 className="highlight-title">
             Kebanggaan Lokal untuk<br/>Setiap Perjalanan
            </h2>
            
            <p className="highlight-desc">
             Jalanan yang berat, cuaca yang tak menentu, dan ribuan kilometer perjalanan.
             Inzta membuat tas yang siap menghadapi tuntutan petualangan berkendara,
             namun tetap praktis untuk digunakan dalam kehidupan sehari-hari.
            </p>

            <div className="highlight-grid">
              {[
                { num: '01', title: 'Waterproof 100%', desc: 'Material premium tahan air, menjamin barang Anda kering dalam cuaca ekstrem sekalipun.' },
                { num: '02', title: 'Ergonomis & Ringan', desc: 'Desain aerodinamis mengurangi hambatan angin tanpa menambah beban pada motor Anda.' },
                { num: '03', title: 'Safety Lock System', desc: 'Sistem penguncian ganda anti-maling memberikan rasa aman saat parkir di mana saja.' },
                { num: '04', title: 'Universal Fit', desc: 'Kompatibel dengan 99% jenis motor, instalasi praktis tanpa modifikasi tambahan.' }
              ].map((f, i) => (
                <div 
                  key={i} 
                  className={`highlight-item ${openFeature === i ? 'open' : ''}`}
                  onClick={() => setOpenFeature(openFeature === i ? null : i)}
                >
                  <div className="highlight-item-header">
                    <div className="highlight-item-left">
                      <span className="highlight-item-num">{f.num}</span>
                      <h3 className="highlight-item-title">{f.title}</h3>
                    </div>
                    <ChevronDown size={18} className="highlight-item-chevron" />
                  </div>
                  <div className="highlight-item-content">
                    <p className="highlight-item-desc">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      
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
