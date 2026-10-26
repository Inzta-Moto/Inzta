'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import dynamic from 'next/dynamic';

const Footer = dynamic(() => import('@/components/Footer'));
import Link from 'next/link';
import { PublicArticle } from '@/types';
import { ArrowLeft, Calendar } from 'lucide-react';
import { formatDate, optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';

// The article comes from the server render (page.tsx, ISR); a missing slug is handled there with notFound().
export default function BlogDetailClient({ article, articleUrl }: { article: PublicArticle; articleUrl: string }) {
  const a = article;
  // window does not exist during the server render; after mount the share links use the address bar
  // again, so an affiliate's ?aff= code stays in the shared link as before F-001.
  const [shareUrl, setShareUrl] = useState(articleUrl);
  useEffect(() => setShareUrl(window.location.href), []);
  // Kompatibel: ambil array images, fallback ke imageUrl lama jika belum diupdate
  const images = a.images || (a.imageUrl ? [a.imageUrl] : []);

  return (
    <>
      <Header active="blog" />
      
      <section className="detail-page-header">
        <div className="container">
          <div className="breadcrumb-wrapper">
            <nav className="breadcrumb">
              <Link href="/">Home</Link>
              <span className="breadcrumb-sep">/</span>
              <Link href="/blog">Article</Link>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{a.title}</span>
            </nav>
          </div>
        </div>
      </section>
      
      <section className="section blog-detail">
        <div className="container">
          <div className="blog-detail-header">
            <h1 className="blog-detail-title">{a.title}</h1>
            <div className="blog-card-meta" style={{ marginBottom: '24px' }}>
              <Calendar size={14} /> {formatDate(a.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            
            {/* GALLERY GAMBAR (1 BESAR, SISANYA KECIL) */}
            {images.length > 0 && (
              <div className="blog-detail-gallery">
                {/* Gambar Utama (Selalu Full Width Besar) */}
                <div className="blog-detail-image-main">
                  <img 
                    src={optimizeCloudinaryUrl(images[0], 1200)}
                    srcSet={generateCloudinarySrcSet(images[0], [600, 1000, 1400])}
                    sizes="(max-width: 768px) 100vw, 800px"
                    alt={`${a.title} - Cover`} 
                  />
                </div>

                {/* Gambar Tambahan (Grid Kecil di bawah) */}
                {images.length > 1 && (
                  <div className="blog-detail-gallery-grid">
                    {images.slice(1).map((img: string, i: number) => (
                      <div key={i} className="blog-detail-image-thumb">
                        <img 
                          src={optimizeCloudinaryUrl(img, 400)} 
                          srcSet={generateCloudinarySrcSet(img, [200, 400, 600])}
                          sizes="(max-width: 768px) 50vw, 300px"
                          alt={`${a.title} - ${i + 2}`} 
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="blog-detail-content">
            {a.content}
          </div>
          
          {/* ── Share Section ── */}
          <div className="detail-share" style={{ marginTop: '48px' }}>
            <button
              className="detail-share-btn detail-share-copy"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                const toast = document.getElementById('share-toast-blog');
                if (toast) { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2000); }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Salin Link</span>
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`*${a.title}*\n\n${a.content?.split('\n')[0] || ''}\n\nBaca selengkapnya: ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-share-btn detail-share-wa"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Bagikan</span>
            </a>
          </div>

          {/* Toast feedback salin link */}
          <div id="share-toast-blog" className="toast">✓ Link berhasil disalin!</div>

          <div style={{ marginTop: '24px' }}>
            <Link href="/blog" className="btn btn-ghost">
              <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Kembali ke Blog
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}