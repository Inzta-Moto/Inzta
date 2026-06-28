'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { Article } from '@/types';
import { Calendar, ArrowRight } from 'lucide-react';
import { formatDate, optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';

export default function BlogSection() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, 'articles'));
      setArticles(
        snap.docs.map(d => d.data() as Article)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 3)
      );
    };
    load();
  }, []);

  return (
    <section className="section blog-section">
      <div className="container">
        
        {/* 1. JUDUL SECTION (Desktop: ada tombol disamping, HP: tombol di-hide via CSS) */}
        <div className="section-header section-header-row">
          <div className="section-header-left">
            <p className="section-eyebrow">Journal</p>
            <h2 className="section-title">Tips & Berita</h2>
          </div>
          <Link href="/blog" className="section-view-all">
            Lihat Semua Blog <ArrowRight size={14} />
          </Link>
        </div>

        {/* 2. GRID CARD BLOG */}
        <div className="blog-grid">
          {articles.length === 0 ? (
            <p className="empty-state">Belum ada artikel.</p>
          ) : articles.map(a => {
            const articleImage = (a as any).images?.[0] || a.imageUrl || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
            
            return (
              <Link href={`/blog/${a.slug}`} key={a.slug} className="blog-card">
                <div className="blog-card-image">
                  <img 
                    src={optimizeCloudinaryUrl(articleImage, 600)}
                    srcSet={generateCloudinarySrcSet(articleImage, [400, 600, 800])}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    alt={a.title} 
                    loading="lazy" 
                  />
                </div>
                <div className="blog-card-body">
                  <div className="blog-card-meta"><Calendar size={12} /> {formatDate(a.createdAt)}</div>
                  <h3 className="blog-card-title">{a.title}</h3>
                  <p className="blog-card-excerpt">{a.excerpt}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 3. TOMBOL "LIHAT SEMUA" VERSI HP (Ditampilkan di bawah card via CSS) */}
        <Link href="/blog" className="section-mobile-view-all">
          Lihat Semua Blog <ArrowRight size={14} />
        </Link>

      </div>
    </section>
  );
}
