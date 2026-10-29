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
  leadSource: 'product' | 'product_list',
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
