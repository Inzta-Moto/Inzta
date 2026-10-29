import Link from 'next/link';
import type { ArticleCardV2 } from '@/types';
import { topicLabel } from '@/lib/v2/article-v2';
import ArticlePhoto from './ArticlePhoto';
import ArticleMeta from './ArticleMeta';

// One article card of the grid (F-016 S6.4, blog.dc.html:53-59). `hidden` is set after hydration for cards outside
// the current page (S6.5.2); without JavaScript every card stays visible.
export default function ArticleCardItem({ card, hidden = false }: { card: ArticleCardV2; hidden?: boolean }) {
  const label = topicLabel(card.topik);
  return (
    <Link className="iz-acard" href={`/blog/${card.slug}`} hidden={hidden}>
      <ArticlePhoto
        photo={card.photo}
        caption={card.coverCaption}
        sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1199px) 31vw, 368px"
        widths={[400, 600, 800]}
        width={600}
      />
      {label && <span className="iz-cat-chip">{label}</span>}
      <h3 className="t-h3">{card.title}</h3>
      <ArticleMeta author={card.author} date={card.date} />
    </Link>
  );
}
