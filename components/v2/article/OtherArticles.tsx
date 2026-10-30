import Link from 'next/link';
import type { ArticleCardV2 } from '@/types';
import { topicLabel } from '@/lib/v2/article-v2';
import { ArrowRight } from '@/components/v2/icons';
import ArticlePhoto from './ArticlePhoto';

// "Artikel lain" (F-016 S7.6, artikel.dc.html:81-87): card fields from otherArticles(), at most two. Without any
// other published article the section, H2 included, does not render (S7.6.1).
export default function OtherArticles({ cards }: { cards: ArticleCardV2[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="iz-wrap">
      <h2 className="t-h2-shop" style={{ marginBottom: 24 }}>Artikel lain</h2>
      <div className="iz-grid-2">
        {cards.map(c => {
          const label = topicLabel(c.topik);
          return (
            <Link key={c.slug} className="iz-grow" href={`/blog/${c.slug}`}>
              <ArticlePhoto photo={c.photo} caption={c.coverCaption} sizes="(max-width: 767px) 112px, 176px" widths={[176, 352, 528]} width={352} />
              <div className="iz-grow__body">
                {label && <span className="iz-cat-chip">{label}</span>}
                <h3>{c.title}</h3>
                <span className="iz-link">
                  Baca panduan <ArrowRight size={18} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
