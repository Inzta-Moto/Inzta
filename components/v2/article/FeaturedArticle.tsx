import Link from 'next/link';
import type { ArticleCardV2 } from '@/types';
import { topicLabel } from '@/lib/v2/article-v2';
import ArticlePhoto from './ArticlePhoto';
import ArticleMeta from './ArticleMeta';

// Featured article of the selected tab (F-016 S6.3, blog.dc.html:40-52). The whole card is one link; "Baca" is a
// span in the button look, never a nested control. Its photo is the page's only eager image (S6.3.2).
export default function FeaturedArticle({ card }: { card: ArticleCardV2 }) {
  const label = topicLabel(card.topik);
  return (
    <section style={{ marginTop: 40 }}>
      <Link className="iz-afeature" href={`/blog/${card.slug}`}>
        <ArticlePhoto
          photo={card.photo}
          caption={card.coverCaption}
          priority
          sizes="(max-width: 767px) calc(100vw - 64px), (max-width: 1199px) 55vw, 640px"
          widths={[480, 800, 1200]}
          width={800}
        />
        <div className="iz-afeature__body">
          {label && <span className="iz-cat-chip">{label}</span>}
          <h2 className="t-h2-shop">{card.title}</h2>
          {card.excerpt && <p className="t-body">{card.excerpt}</p>}
          <ArticleMeta author={card.author} date={card.date} />
          <span className="iz-btn iz-btn--primary" style={{ alignSelf: 'flex-start' }}>Baca</span>
        </div>
      </Link>
    </section>
  );
}
