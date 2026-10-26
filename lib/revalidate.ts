import { revalidatePath } from 'next/cache';

// Called after a successful admin write so ISR pages show the change without waiting for the interval.
// A failure here must not turn a saved write into an error response; the interval still refreshes.
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
