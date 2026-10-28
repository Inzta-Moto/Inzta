import { revalidatePath } from 'next/cache';

// Called after a successful admin write so ISR pages show the change without waiting for the interval.
// revalidatePath only queues the purge, which Next runs after the response; the catch covers synchronous
// errors (e.g. no request scope) so they cannot turn a saved write into an error response. If the queued
// purge fails, the 3600 s interval still refreshes the page.
// ponytail: every article page, not only those with a card for this slug; finding those needs a content scan,
// and ISR regenerates each purged page once on its next visit. Narrow it if the blog grows to hundreds of pages.
const ARTICLE_PAGES = '/blog/[slug]';

function revalidate(paths: string[]) {
  for (const path of paths) {
    try {
      // F-013 phase C4: the route pattern purges every article page (product and "Baca juga" cards).
      if (path === ARTICLE_PAGES) revalidatePath(path, 'page');
      else revalidatePath(path);
    } catch (error) {
      console.error('Revalidation failed:', { path, error });
    }
  }
}

// Other articles may show this one as a "Baca juga" card, so all article pages are purged (K-10).
export function revalidateArticlePaths(slug: string) {
  revalidate(['/', '/blog', `/blog/${slug}`, '/sitemap.xml', ARTICLE_PAGES]);
}

// Product cards in articles show price and stock (requirement 22.3).
export function revalidateProductPaths() {
  revalidate(['/', '/sitemap.xml', ARTICLE_PAGES]);
}
