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
 * (data-transition="off"), hash-only links, admin routes, links that stay on the same pathname (catalogue
 * filters, in-page anchors), which must not cover the page, and product detail pages, which open straight away
 * (Sehan, 2026-10-29: no transition when a buyer opens a product).
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
  if (/^\/produk\/[^/]+/.test(url.pathname)) return null;
  return url;
}

/** True when a plain click goes to the page that is already open (same path and query, no hash): the logo on the
 * Beranda, for example. SiteMotion replays the page intro for it instead of doing nothing. */
export function samePage(click: LinkClick, current: URL): boolean {
  if (click.defaultPrevented || click.button !== 0 || click.modified || click.optOut || click.download) return false;
  if (click.target && click.target !== '_self') return false;
  if (!click.href || click.href.startsWith('#')) return false;
  let url: URL;
  try {
    url = new URL(click.href, current);
  } catch {
    return false;
  }
  return url.origin === current.origin && isMotionRoute(url.pathname) && url.pathname === current.pathname && url.search === current.search && !url.hash;
}

const CATEGORY_LABEL: Record<string, string> = { matic: 'Motor Matic', adventure: 'Motor Adventure', retro: 'Motor Retro', trail: 'Motor Trail' };

const POSITION_LABEL: Record<string, string> = {
  tank: 'Tank bag',
  side: 'Side bag',
  tail: 'Tail bag',
  extend: 'Extend bag',
  aksesori: 'Aksesori touring',
  harian: 'Tas harian',
};

/** Text under the logo while the curtain covers a route change; the catalogue names the position filter it opens. */
export function routeLabel(pathname: string, search = ''): string {
  if (pathname === '/') return 'Beranda';
  if (pathname === '/produk') {
    const positions = new URLSearchParams(search).get('posisi')?.split(',').filter(p => POSITION_LABEL[p]) ?? [];
    return positions.length === 1 ? POSITION_LABEL[positions[0]] : 'Semua tas';
  }
  if (pathname.startsWith('/produk/')) return 'Detail produk';
  if (pathname === '/blog') return 'Artikel';
  if (pathname.startsWith('/blog/')) return 'Artikel';
  if (pathname.startsWith('/tentang')) return 'Tentang INZTA';
  const motor = pathname.match(/^\/tas-motor\/([a-z-]+)/);
  if (motor) return CATEGORY_LABEL[motor[1]] ?? 'Pilih motor';
  return 'INZTA';
}
