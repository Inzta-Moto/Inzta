import { isMotionRoute } from '@/lib/v2/motion/boot';

export type LinkClick = {
  href: string | null;
  target: string | null;
  download: boolean;
  button: number;
  modified: boolean;
  optOut: boolean;
  defaultPrevented: boolean;
};

/**
 * The URL a click should travel to behind the page curtain, or null to leave the click to the browser and Next:
 * other origins, new tabs and windows, downloads, modified or non-primary clicks, opted-out links
 * (data-transition="off"), hash-only links, admin routes, and links that stay on the same pathname (catalogue
 * filters, in-page anchors), which must not cover the page.
 */
export function transitionTarget(click: LinkClick, current: URL): URL | null {
  if (click.defaultPrevented || click.button !== 0 || click.modified || click.optOut || click.download) return null;
  if (click.target && click.target !== '_self') return null;
  if (!click.href || click.href.startsWith('#')) return null;
  let url: URL;
  try {
    url = new URL(click.href, current);
  } catch {
    return null;
  }
  if (url.origin !== current.origin || !/^https?:$/.test(url.protocol)) return null;
  if (!isMotionRoute(url.pathname) || url.pathname === current.pathname) return null;
  return url;
}

const CATEGORY_LABEL: Record<string, string> = { matic: 'Motor Matic', adventure: 'Motor Adventure', retro: 'Motor Retro', trail: 'Motor Trail' };

/** Text under the logo while the curtain covers a route change. */
export function routeLabel(pathname: string): string {
  if (pathname === '/') return 'Beranda';
  if (pathname === '/produk') return 'Semua tas';
  if (pathname.startsWith('/produk/')) return 'Detail produk';
  if (pathname === '/blog') return 'Artikel';
  if (pathname.startsWith('/blog/')) return 'Artikel';
  if (pathname.startsWith('/tentang')) return 'Tentang INZTA';
  const motor = pathname.match(/^\/tas-motor\/([a-z-]+)/);
  if (motor) return CATEGORY_LABEL[motor[1]] ?? 'Pilih motor';
  return 'INZTA';
}
