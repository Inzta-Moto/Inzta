'use client';

import Link from 'next/link';
import type { MotorCategory, ProductEmbed } from '@/types';
import type { MotorArticleV2 } from '@/lib/v2/article-v2';
import { topicLabel } from '@/lib/v2/article-v2';
import { categoryLabel } from '@/lib/v2/home-content';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { WhatsApp } from '@/components/v2/icons';
import { formatPrice, generateCloudinarySrcSet, optimizeCloudinaryUrl } from '@/lib/utils';
import ArticlePhoto from './ArticlePhoto';

const rp = (n: number) => formatPrice(n).replace(' ', '\u00a0');

const PICKS = 2;

// F-017 right rail, below the products: "Untuk motor <kategori>" for the visitor's "Motor saya" category, then the
// dark "Chat admin" card. The box lists the bags made for that category (same set and order as the category page)
// and other articles tagged with it; the article being read is never listed. The category is only known after mount
// (MotorCategory), so the server HTML has no box and the neutral card copy; nothing shifts above the rail.
export function MotorArticles({ items, products }: { items: MotorArticleV2[]; products: Partial<Record<MotorCategory, ProductEmbed[]>> }) {
  const { category } = useMotorCategory();
  if (!category) return null;
  const bags = products[category] ?? [];
  const picks = items.filter(x => x.tags.includes(category)).slice(0, PICKS);
  if (bags.length === 0 && picks.length === 0) return null;
  const label = categoryLabel(category);
  return (
    <section className="iz-inline-products" aria-labelledby="iz-rail-motor">
      <span className="iz-eyebrow" style={{ marginBottom: 0 }} id="iz-rail-motor">Untuk motor {label}</span>
      {bags.map(p => (
        <Link key={p.slug} className="iz-railpick" href={`/produk/${p.slug}`}>
          <span className="iz-photo">
            {p.image && <img src={optimizeCloudinaryUrl(p.image, 144, 144)} srcSet={generateCloudinarySrcSet(p.image, [72, 144, 216])} sizes="72px" alt="" loading="lazy" decoding="async" />}
          </span>
          <span>
            <b>{p.name}</b>
            {p.price !== null && <span className="iz-meta iz-num">{rp(p.price)}{p.priceTo !== null && ` – ${rp(p.priceTo)}`}</span>}
          </span>
        </Link>
      ))}
      {picks.map(({ card }) => (
        <Link key={card.slug} className="iz-railpick" href={`/blog/${card.slug}`}>
          <ArticlePhoto photo={card.photo} caption={null} sizes="72px" widths={[72, 144, 216]} width={144} />
          <span>
            <b>{card.title}</b>
            <span className="iz-meta">{topicLabel(card.topik) ?? 'Artikel'}</span>
          </span>
        </Link>
      ))}
      {bags.length > 0 && (
        <Link className="iz-link" href={`/tas-motor/${category}`} style={{ minHeight: 32 }}>
          Semua tas untuk motor {label} →
        </Link>
      )}
    </section>
  );
}

export function RailHelp({ waHref }: { waHref: string }) {
  const { category } = useMotorCategory();
  const label = category ? categoryLabel(category) : null;
  return (
    <section className="iz-railhelp iz-dark" aria-labelledby="iz-rail-help">
      {label && (
        <span className="iz-motorchip">
          <span className="iz-motorchip__dot" />
          Motor saya: {label}
        </span>
      )}
      <h3 id="iz-rail-help">Ragu tas mana yang pas untuk motor {label ?? 'Anda'}?</h3>
      <p className="iz-muted">Kirim foto motor Anda, admin bantu pilihkan tas dan ukurannya.</p>
      <a className="iz-btn iz-btn--primary iz-btn--wa" href={waHref} target="_blank" rel="noopener noreferrer">
        <span className="iz-btn__icon">
          <WhatsApp />
        </span>
        <span>Chat admin</span>
      </a>
    </section>
  );
}
