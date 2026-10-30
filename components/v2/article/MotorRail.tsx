'use client';

import Link from 'next/link';
import type { MotorArticleV2 } from '@/lib/v2/article-v2';
import { topicLabel } from '@/lib/v2/article-v2';
import { categoryLabel } from '@/lib/v2/home-content';
import { useMotorCategory } from '@/components/v2/MotorCategory';
import { WhatsApp } from '@/components/v2/icons';
import ArticlePhoto from './ArticlePhoto';

const PICKS = 2;

// F-017 right rail, below the products: articles tagged with the visitor's "Motor saya" category, and the dark "Chat
// admin" card. The category is only known after mount (MotorCategory), so the server HTML has the card with the
// neutral copy and no list; nothing shifts above the rail when the list appears.
export function MotorArticles({ items }: { items: MotorArticleV2[] }) {
  const { category } = useMotorCategory();
  if (!category) return null;
  const picks = items.filter(x => x.tags.includes(category)).slice(0, PICKS);
  if (picks.length === 0) return null;
  return (
    <section className="iz-inline-products" aria-labelledby="iz-rail-motor">
      <span className="iz-eyebrow" style={{ marginBottom: 0 }} id="iz-rail-motor">Untuk motor {categoryLabel(category)}</span>
      {picks.map(({ card }) => (
        <Link key={card.slug} className="iz-railpick" href={`/blog/${card.slug}`}>
          <ArticlePhoto photo={card.photo} caption={null} sizes="72px" widths={[72, 144, 216]} width={144} />
          <span>
            <b>{card.title}</b>
            {topicLabel(card.topik) && <span className="iz-meta">{topicLabel(card.topik)}</span>}
          </span>
        </Link>
      ))}
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
