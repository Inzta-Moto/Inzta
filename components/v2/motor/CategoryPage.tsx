import type { CategoryPageData } from '@/components/v2/motor/motor-page';
import { consultHref } from '@/components/v2/motor/motor-page';
import ProductCardV2 from '@/components/v2/ProductCardV2';
import EmptyState from '@/components/v2/ui/EmptyState';
import CategoryHero from '@/components/v2/motor/CategoryHero';
import PositionTabs from '@/components/v2/motor/PositionTabs';
import InstallNotice from '@/components/v2/motor/InstallNotice';
import MoreCard from '@/components/v2/motor/MoreCard';
import ArticleFeature from '@/components/v2/motor/ArticleFeature';
import OtherCategories from '@/components/v2/motor/OtherCategories';
import CategoryClosing from '@/components/v2/motor/CategoryClosing';

const GRID_ID = 'iz-motor-grid';
const CARD_SIZES = '(max-width: 767px) 50vw, 282px';

// S5.2 ST-NOJS: the tablist needs JavaScript, so it is hidden without it; with JavaScript it is in the first paint.
const NOSCRIPT_TABS = '<style>.iz-motor-tabs { display: none !important; }</style>';

// Per-category page (F-016 S5), section order of motor.dc.html. Server component: every card, the article, and the
// tiles are in the server HTML (G-S2); only the tabs and the category tiles are client islands.
export default function CategoryPage({ data }: { data: CategoryPageData }) {
  const { category, label, lead, cards, cardPositions, tabs, universal, showInstallNotice, article } = data;
  const waHref = consultHref(category);
  const hasTabs = tabs.length > 0;
  return (
    <>
      <CategoryHero category={category} label={label} lead={lead} />

      {hasTabs && (
        <>
          <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_TABS }} />
          <PositionTabs tabs={tabs} panelId={GRID_ID} cardPositions={cardPositions} />
        </>
      )}

      <section id="produk" className="iz-wrap iz-motor-produk">
        {cards.length > 0 ? (
          <>
            <div className="iz-head">
              <h2 className="t-h2-landing">Tas yang ditandai untuk motor {label}.</h2>
            </div>
            <div
              className="iz-grid-4"
              id={GRID_ID}
              {...(hasTabs ? { role: 'tabpanel', 'aria-labelledby': 'iz-postab-semua' } : {})}
            >
              {cards.map(card => (
                <ProductCardV2 key={card.slug} card={card} sizes={CARD_SIZES} />
              ))}
            </div>
          </>
        ) : (
          // S5.3.2: no product is tagged for this category yet; robots follow S5.8.5.
          <EmptyState
            title={`Belum ada tas yang ditandai untuk motor ${label}.`}
            actions={[
              { label: 'Tanya admin soal motor Anda', href: waHref, external: true },
              { label: 'Lihat semua produk', href: '/produk' },
            ]}
          />
        )}
      </section>

      {showInstallNotice && <InstallNotice />}

      <section className="iz-section iz-wrap" style={{ paddingBottom: 0 }}>
        <div className="iz-head">
          <h2 className="t-h2-landing">Bisa juga untuk motor {label}.</h2>
          <p className="t-body">Tas dengan strap yang bisa dipasang di banyak motor.</p>
        </div>
        <div className="iz-grid-4">
          {universal.map(card => (
            <ProductCardV2 key={card.slug} card={card} sizes={CARD_SIZES} />
          ))}
          <MoreCard />
        </div>
      </section>

      {article && <ArticleFeature article={article} />}

      <OtherCategories current={category} />

      <CategoryClosing waHref={waHref} />
    </>
  );
}
