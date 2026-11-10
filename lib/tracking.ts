// F-002: GA4 + Meta Pixel. Semua pemanggilan vendor lewat sini; bila skrip
// diblokir atau ID kosong, semuanya no-op tanpa error.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

// Ditulis literal supaya di-inline Next.js saat build (ubah di Vercel = redeploy).
const RAW_GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const GA_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;
export const PIXEL_ID_PATTERN = /^[0-9]{6,20}$/;

export function validId(raw: string | undefined, pattern: RegExp): string | null {
  const v = raw?.trim();
  return v && pattern.test(v) ? v : null;
}

export const GA_ID = validId(RAW_GA_ID, GA_ID_PATTERN);
export const META_PIXEL_ID = validId(RAW_PIXEL_ID, PIXEL_ID_PATTERN);
// Hanya domain asli yang dihitung sebagai traffic produksi. Project Vercel
// inzta-staging juga ber-VERCEL_ENV=production, jadi debug_mode ditentukan
// dari hostname saat runtime: staging, Preview, dan localhost = debug.
export const PRODUCTION_HOSTS = ['inzta.id', 'www.inzta.id'];

const UNTRACKED = ['/admin', '/affiliate'];

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/**
 * Satu-satunya gerbang untuk skrip, event, dan capture UTM.
 * D-4 (consent, UU PDP) belum diputuskan: bila opt-in dipilih, cek
 * persetujuan tersimpan ditambahkan di sini saja.
 */
export function isTrackingAllowed(pathname: string): boolean {
  return isTrackedPath(pathname);
}

function allowedHere(): boolean {
  return typeof window !== 'undefined' && isTrackingAllowed(window.location.pathname);
}

function gtagSafe(...args: unknown[]) {
  try {
    if (typeof window.gtag === 'function') window.gtag(...args);
  } catch { /* vendor error tidak boleh mengganggu halaman */ }
}

function fbqSafe(...args: unknown[]) {
  try {
    if (typeof window.fbq === 'function') window.fbq(...args);
  } catch { /* idem */ }
}

export function trackViewItem(p: { slug: string; name: string; price: number }): void {
  if (!allowedHere()) return;
  gtagSafe('event', 'view_item', {
    currency: 'IDR',
    value: p.price,
    items: [{ item_id: p.slug, item_name: p.name, price: p.price }],
  });
  fbqSafe('track', 'ViewContent', {
    content_ids: [p.slug],
    content_type: 'product',
    content_name: p.name,
    value: p.price,
    currency: 'IDR',
  });
}

/**
 * Dipanggil sinkron setelah POST /api/orders sukses, tepat sebelum WhatsApp
 * dibuka. Tidak menunda navigasi (bug iOS). Catatan: GA4 mem-batch hit ~5 detik
 * dan event_callback tidak menunggu pengiriman, jadi generate_lead bisa hilang
 * saat halaman langsung pindah; Contact (Pixel) terkirim seketika. Perbaikan
 * andal = kirim dari server (Measurement Protocol) di tahap 2 bersama CAPI.
 */
export function trackLead(
  lead: { orderId: string; value: number; slugs: string[] },
  leadSource: 'product' | 'product_list' | 'cart',
): void {
  if (!allowedHere()) return;
  // eventID = Order ID, untuk dedup dengan Conversions API di tahap 2.
  fbqSafe(
    'track',
    'Contact',
    { content_ids: lead.slugs, content_type: 'product', value: lead.value, currency: 'IDR' },
    { eventID: lead.orderId },
  );
  gtagSafe('event', 'generate_lead', { currency: 'IDR', value: lead.value, lead_source: leadSource });
}

// F-030: GA4 ecommerce events of the cart, same gate and no-op rules as above. `items` use the product slug as
// item_id and the chosen option as item_variant.
export interface CartTrackItem {
  slug: string;
  name: string;
  variant: string | null;
  price: number;
  quantity: number;
}

function gaItems(items: readonly CartTrackItem[]) {
  return items.map(i => ({ item_id: i.slug, item_name: i.name, ...(i.variant ? { item_variant: i.variant } : {}), price: i.price, quantity: i.quantity }));
}

const valueOf = (items: readonly CartTrackItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0);

export function trackAddToCart(item: CartTrackItem): void {
  if (!allowedHere()) return;
  gtagSafe('event', 'add_to_cart', { currency: 'IDR', value: valueOf([item]), items: gaItems([item]) });
  fbqSafe('track', 'AddToCart', { content_ids: [item.slug], content_type: 'product', value: valueOf([item]), currency: 'IDR' });
}

export function trackRemoveFromCart(items: readonly CartTrackItem[]): void {
  if (!allowedHere() || !items.length) return;
  gtagSafe('event', 'remove_from_cart', { currency: 'IDR', value: valueOf(items), items: gaItems(items) });
}

export function trackViewCart(items: readonly CartTrackItem[]): void {
  if (!allowedHere() || !items.length) return;
  gtagSafe('event', 'view_cart', { currency: 'IDR', value: valueOf(items), items: gaItems(items) });
}

export function trackBeginCheckout(items: readonly CartTrackItem[], coupon: string | null): void {
  if (!allowedHere() || !items.length) return;
  gtagSafe('event', 'begin_checkout', { currency: 'IDR', value: valueOf(items), ...(coupon ? { coupon } : {}), items: gaItems(items) });
  fbqSafe('track', 'InitiateCheckout', { content_ids: items.map(i => i.slug), content_type: 'product', value: valueOf(items), num_items: items.length, currency: 'IDR' });
}
