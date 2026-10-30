import '@/app/(v2)/v2-article.css';
import V2Layout from '@/components/v2/V2Layout';
import Closing from '@/components/v2/Closing';
import EmptyState from '@/components/v2/ui/EmptyState';
import ArticleList from '@/components/v2/article/ArticleList';
import { WA_NUMBER } from '@/lib/constants';
import { getArticles } from '@/lib/public-content';
import { articleCardV2 } from '@/lib/v2/article-v2';
import { sectionMetadata } from '@/lib/seo';

// ISR: rendered on the server so Google sees every article; admin writes call revalidatePath (F-001, F-016 S6.7.1).
export const revalidate = 3600;

const LEAD = 'Cara memilih dan memasang tas, panduan per motor, dan catatan dari komunitas.';

// F-005 phase 2 owns the title, description, canonical, and Open Graph (F-016 C-3 replaces design.md §9 "Artikel · INZTA").
export const metadata = sectionMetadata('blog');

// F-016 S6 (blog.dc.html). Reads stay as F-001/F-012 wrote them (published only, newest first); the list island
// receives the card projection only, never `content` (S6.7.2). A failed read throws to error.tsx (S6.6.4).
export default async function BlogPage() {
  const cards = (await getArticles()).map(articleCardV2);

  return (
    <V2Layout current="artikel">
      <div className="iz-wrap" style={{ paddingTop: 128 }}>
        <section>
          <div className="iz-head" style={{ marginBottom: 24 }}>
            <h1 className="t-h1-shop">Artikel</h1>
            <p className="t-lead">{LEAD}</p>
          </div>
        </section>
        {cards.length === 0 ? (
          // S6.6.1: no tabs, featured card, grid, panel, or pager; the closing panel stays.
          <EmptyState title="Belum ada artikel." actions={[{ label: 'Lihat produk', href: '/produk' }]} />
        ) : (
          <ArticleList cards={cards} />
        )}
      </div>
      <div>
        <Closing waHref={`https://wa.me/${WA_NUMBER}`} />
      </div>
    </V2Layout>
  );
}
