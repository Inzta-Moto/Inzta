import Link from 'next/link';
import type { ArticleEmbed, ArticleEmbeds, ProductEmbed, RenderBlock } from '@/types';
import { formatPrice, generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';

// F-013 phase C: the article body for the public page, /admin/pratinjau, and the editor's Pratinjau tab
// (requirement 15.6). HTML blocks are already sanitized on the server (lib/markdown.ts); cards are built here
// from resolved data (lib/article-embeds.ts), never from HTML. No marked or sanitize-html in this file.

interface ArticleBodyProps {
  blocks: RenderBlock[];
  embeds: ArticleEmbeds;
  className: string;
  // Admins see a note where a card is missing; visitors see nothing (K-4).
  adminPreview?: boolean;
}

const THUMB_SIZES = '(max-width: 767px) 72px, 96px';
// "Rp" and the amount never split over two lines on a narrow card.
const rp = (n: number) => formatPrice(n).replace(' ', '\u00a0');

function Thumb({ src }: { src: string | null }) {
  if (!src) return null;
  // The card text names the product or article, so the image is decorative.
  return (
    <img
      className="article-embed-image"
      src={optimizeCloudinaryUrl(src, 192, 192)}
      srcSet={generateCloudinarySrcSet(src, [96, 192, 288])}
      sizes={THUMB_SIZES}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

export function ArticleProductCard({ product: p }: { product: ProductEmbed }) {
  return (
    <div className="article-embed article-embed--produk">
      <Link href={`/produk/${p.slug}`} className="article-embed-link">
        <Thumb src={p.image} />
        <span className="article-embed-text">
          <span className="article-embed-label">Produk INZTA</span>
          <span className="article-embed-title">{p.name}</span>
          {p.price !== null && (
            <span className="article-embed-price">
              {p.compareAtPrice !== null && (
                <s className="article-embed-compare">
                  <span className="article-embed-sr">Harga normal </span>
                  {rp(p.compareAtPrice)}
                </s>
              )}
              {p.compareAtPrice !== null && ' '}
              {rp(p.price)}
              {p.priceTo !== null && ` – ${rp(p.priceTo)}`}
            </span>
          )}
          {!p.inStock && <span className="article-embed-stock">Stok habis</span>}
          <span className="article-embed-cta">Lihat produk</span>
        </span>
      </Link>
    </div>
  );
}

export function ArticleReadAlso({ article: a }: { article: ArticleEmbed }) {
  return (
    <div className="article-embed article-embed--artikel">
      <Link href={`/blog/${a.slug}`} className="article-embed-link">
        <Thumb src={a.image} />
        <span className="article-embed-text">
          <span className="article-embed-label">Baca juga</span>
          <span className="article-embed-title">{a.title}</span>
          {a.excerpt && <span className="article-embed-excerpt">{a.excerpt}</span>}
        </span>
      </Link>
    </div>
  );
}

export default function ArticleBody({ blocks, embeds, className, adminPreview }: ArticleBodyProps) {
  // Without cards the body stays one element with the sanitized HTML, as before phase C (K-7).
  if (blocks.length <= 1 && blocks.every(b => b.type === 'html')) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: blocks[0]?.type === 'html' ? blocks[0].html : '' }} />;
  }
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === 'html') return <div key={i} className="article-part" dangerouslySetInnerHTML={{ __html: b.html }} />;
        const product = b.type === 'product' ? embeds.products[b.slug] : undefined;
        const article = b.type === 'article' ? embeds.articles[b.slug] : undefined;
        if (product) return <ArticleProductCard key={i} product={product} />;
        if (article) return <ArticleReadAlso key={i} article={article} />;
        if (!adminPreview) return null;
        const what = b.type === 'product' ? `Produk "${b.slug}"` : `Artikel "${b.slug}"`;
        const why = b.type === 'product' ? 'tidak ada atau nonaktif' : 'tidak ada, belum terbit, atau artikel ini sendiri';
        return (
          <p key={i} className="article-embed-missing" role="note">
            {what} {why}; kartunya tidak tampil di halaman publik.
          </p>
        );
      })}
    </div>
  );
}
