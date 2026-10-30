import Link from 'next/link';
import type { ArticleEmbeds, ProductEmbed, RenderBlock } from '@/types';
import { formatPrice, generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';

export const RAIL_PRODUCTS_MAX = 3;

// F-017: the products the body names with [[produk:…]], in body order, without repeats, at most three. Only cards
// the resolver found (active products) are listed, the same set the body shows.
export function railProducts(blocks: RenderBlock[], embeds: ArticleEmbeds): ProductEmbed[] {
  const out: ProductEmbed[] = [];
  for (const b of blocks) {
    const p = b.type === 'product' ? embeds.products[b.slug] : undefined;
    if (p && !out.some(x => x.slug === p.slug)) out.push(p);
    if (out.length === RAIL_PRODUCTS_MAX) break;
  }
  return out;
}

const rp = (n: number) => formatPrice(n).replace(' ', ' ');

// F-017 right rail, wide screens only (v2-article.css): the canvas iz-inline-products / iz-iprod box, a summary of
// the products the body names. The body's own product cards always stay where the writer put them (Sehan,
// 30 Oct); below 1200 px the rail sits under the body, so the summary is hidden there.
export default function RailProducts({ products }: { products: ProductEmbed[] }) {
  if (products.length === 0) return null;
  return (
    <section className="iz-inline-products iz-rail-products" aria-labelledby="iz-rail-products">
      <span className="iz-eyebrow" style={{ marginBottom: 0 }}>Produk INZTA</span>
      <h3 id="iz-rail-products">Disebut di artikel ini</h3>
      {products.map(p => (
        <div key={p.slug} className="iz-iprod">
          {p.image ? (
            <img src={optimizeCloudinaryUrl(p.image, 144, 144)} srcSet={generateCloudinarySrcSet(p.image, [72, 144, 216])} sizes="72px" alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="iz-iprod__blank" aria-hidden="true" />
          )}
          <div>
            <h4>{p.name}</h4>
            {p.price !== null && (
              <p className="iz-num" style={{ fontWeight: 700, fontSize: 17 }}>
                {rp(p.price)}
                {p.priceTo !== null && ` – ${rp(p.priceTo)}`}
              </p>
            )}
            {!p.inStock && <p className="iz-meta">Stok habis</p>}
            <Link className="iz-link" href={`/produk/${p.slug}`} style={{ minHeight: 32 }}>
              Lihat detail<span className="iz-sr"> {p.name}</span> →
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}
