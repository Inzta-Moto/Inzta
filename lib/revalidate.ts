import { revalidatePath } from 'next/cache';

// Called after a successful admin write so ISR pages show the change without waiting for the interval.
// revalidatePath only queues the purge, which Next runs after the response; the catch covers synchronous
// errors (e.g. no request scope) so they cannot turn a saved write into an error response. If the queued
// purge fails, the 3600 s interval still refreshes the page.
function revalidate(paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.error('Revalidation failed:', { path, error });
    }
  }
}

export function revalidateArticlePaths(slug: string) {
  revalidate(['/', '/blog', `/blog/${slug}`, '/sitemap.xml']);
}

export function revalidateProductPaths() {
  revalidate(['/', '/sitemap.xml']);
}
