import { revalidatePath } from 'next/cache';

// Called after a successful admin write so ISR pages show the change without waiting for the interval.
// revalidatePath only queues the purge, which Next runs after the response; the catch covers synchronous
// errors (e.g. no request scope) so they cannot turn a saved write into an error response. If the queued
// purge fails, the 3600 s interval still refreshes the page.
// ponytail: every article page, not only those with a card for this slug; finding those needs a content scan,
// and ISR regenerates each purged page once on its next visit. Narrow it if the blog grows to hundreds of pages.
const ARTICLE_PAGES = '/blog/[slug]';
// F-016 design.md §2: dynamic v2 routes are purged by pattern like the article pages.
const PRODUCT_PAGES = '/produk/[slug]';
const CATEGORY_PAGES = '/tas-motor/[kategori]';
const PATTERNS = new Set([ARTICLE_PAGES, PRODUCT_PAGES, CATEGORY_PAGES]);

// Every v2 page shows navbar starting prices and the promo bar (F-016 S0.3, S0.4).
const V2_FRAME_PAGES = ['/', '/produk', PRODUCT_PAGES, CATEGORY_PAGES, '/blog', ARTICLE_PAGES, '/tentang'];

function revalidate(paths: string[]) {
  for (const path of new Set(paths)) {
    try {
      // F-013 phase C4: the route pattern purges every article page (product and "Baca juga" cards).
      if (PATTERNS.has(path)) revalidatePath(path, 'page');
      else revalidatePath(path);
    } catch (error) {
      console.error('Revalidation failed:', { path, error });
    }
  }
}

// Other articles may show this one as a "Baca juga" card, so all article pages are purged (K-10). Category pages
// embed their lead article and /tentang links the Gasber article only once it is published (F-016 S5.6, S8.3).
export function revalidateArticlePaths(slug: string) {
  revalidate(['/', '/blog', `/blog/${slug}`, '/sitemap.xml', ARTICLE_PAGES, CATEGORY_PAGES, '/tentang']);
}

// Product cards in articles show price and stock (requirement 22.3); every v2 frame shows starting prices.
export function revalidateProductPaths() {
  revalidate(['/sitemap.xml', ...V2_FRAME_PAGES]);
}

// F-016 S0.3.4: the flash-sale switch changes the promo bar of every v2 page and the Beranda panel.
export function revalidateV2Paths(kind: 'flash') {
  if (kind === 'flash') revalidate(V2_FRAME_PAGES);
}
