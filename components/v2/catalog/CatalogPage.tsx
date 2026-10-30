import { Suspense } from 'react';
import EmptyState from '@/components/v2/ui/EmptyState';
import Closing from '@/components/v2/Closing';
import CatalogBody from '@/components/v2/catalog/CatalogBody';
import CatalogHead from '@/components/v2/catalog/CatalogHead';
import CatalogQuery from '@/components/v2/catalog/CatalogQuery';
import type { CatalogItem } from '@/components/v2/catalog/filter';
import { CATEGORY_SLUGS } from '@/lib/v2/motor-category';

// Without JavaScript the filters cannot apply, so they are hidden and every product stays listed (S2.2.10).
const NOSCRIPT_STYLE = '<style>.iz-filters, .iz-filters__meta > .iz-row { display: none !important; }</style>';

// MotorCategoryProvider applies the stored category only after mount, so the lead's green-mark sentence used to
// appear late and push the grid down by a line on phones (CLS about 0.13 at 390 px). This runs while the HTML is
// parsed, before the lead, and marks <html> (suppressHydrationWarning) so v2-catalog.css shows the sentence at once.
// The key mirrors MOTOR_CATEGORY_KEY in components/v2/MotorCategory.tsx; a client module's constant cannot be
// imported into this server component as a value. Storage can throw, so the script swallows errors.
export const MOTOR_ATTR_SCRIPT = `try{var m=localStorage.getItem('inzta.motorCategory');if(/^(${CATEGORY_SLUGS.join('|')})$/.test(m||''))document.documentElement.setAttribute('data-iz-motor',m)}catch(e){}`;

// Katalog of produk.dc.html (F-016 S2). The head, filter bar, and grid are a client island whose Suspense fallback
// is the full unfiltered list, so the server HTML lists every product name and price (S2.2.8, G-S2); the closing
// panel is server markup. The sections stay direct children of main#isi, as in the canvas (design.md §19).
export default function CatalogPage({ items, waHref }: { items: readonly CatalogItem[]; waHref: string }) {
  return (
    <>
      {items.length > 0 ? (
        <>
          <noscript dangerouslySetInnerHTML={{ __html: NOSCRIPT_STYLE }} />
          <script dangerouslySetInnerHTML={{ __html: MOTOR_ATTR_SCRIPT }} />
          <Suspense fallback={<CatalogBody items={items} waHref={waHref} />}>
            <CatalogQuery items={items} waHref={waHref} />
          </Suspense>
        </>
      ) : (
        <>
          <CatalogHead title="Semua tas motor INZTA" />
          <section className="iz-wrap iz-catalog__results">
            <EmptyState title="Belum ada produk." actions={[{ label: 'Chat admin', href: waHref, external: true }]} />
          </section>
        </>
      )}

      <Closing waHref={waHref} />
    </>
  );
}
