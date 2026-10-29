import Header from '@/components/Header';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Footer = dynamic(() => import('@/components/Footer'));
import { Calendar } from 'lucide-react';
import { formatDate, optimizeCloudinaryUrl, generateCloudinarySrcSet } from '@/lib/utils';
import { getArticles } from '@/lib/public-content';
import { publicDate } from '@/lib/article-format';
import { canonicalUrl } from '@/lib/seo';

export const metadata = { alternates: { canonical: canonicalUrl('blog') } };

// ISR: rendered on the server so Google sees every article; admin writes call revalidatePath.
export const revalidate = 3600;

export default async function BlogPage() {
  const articles = await getArticles();

  return (
    <>
      <Header active="blog" />
      <section className="page-header page-header-with-bg">
        <div className="page-header-bg"><img src="https://i.ytimg.com/vi/hrJnT58v8Ss/hq720.jpg?sqp=-oaymwE7CK4FEIIDSFryq4qpAy0IARUAAAAAGAElAADIQj0AgKJD8AEB-AH-CYAC0AWKAgwIABABGFQgXihlMA8=&rs=AOn4CLBjwCeRL8haREKtJ3qI5BUFZG6LcQ" alt="Blog" /></div>
        <div className="hero-overlay"></div>
        <div className="container">
          <div className="page-header-content">
            <h1 className="page-title">Article Blog</h1>
            <p className="page-desc">Artikel, tips, dan Informasi</p>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="blog-grid blog-grid-full">
            {articles.length === 0 ? <p className="empty-state">Belum ada artikel.</p> : articles.map(a => {
              const articleImage = a.coverImage || a.images?.[0] || a.imageUrl || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
              
              return (
                <Link href={`/blog/${a.slug}`} key={a.slug} className="blog-card">
                  <div className="blog-card-image">
                    <img 
                      src={optimizeCloudinaryUrl(articleImage, 600)}
                      srcSet={generateCloudinarySrcSet(articleImage, [400, 600, 800])}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      alt={(a.coverImage && a.coverAlt) || a.title}
                      loading="lazy"
                    />
                  </div>
                  <div className="blog-card-body">
                    <div className="blog-card-meta"><Calendar size={12} /> {formatDate(publicDate(a))}</div>
                    <h3 className="blog-card-title">{a.title}</h3>
                    <p className="blog-card-excerpt">{a.excerpt}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
