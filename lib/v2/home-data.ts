import type { BagPosition, FitLabel, FlashSaleState, HomeData, HomeGuideCard, HomeProductCard, Product, ProductPosition, PublicArticle } from '@/types';
import { DEFAULT_AUTHOR } from '@/lib/constants';
import {
  BANNED_LABEL_WORDS,
  CROP_HALF_SLUGS,
  CROP_TOP_SLUGS,
  FOR_LINE_BY_SLUG,
  POSITION_BY_SLUG,
  UNIVERSAL_SLUGS,
} from '@/lib/v2/product-copy';
import { isFlashActive } from '@/lib/v2/flash-time';
import { ARTICLE_CHIP_BY_SLUG, GASBER_SLUG, TOURMAX_SLUG } from '@/lib/v2/home-content';

// Pure helpers for the v2 Beranda (F-016). No Firebase or React imports, so tests/f016-home.cjs can load them.

export const POSITIONS: readonly BagPosition[] = ['tank', 'side', 'tail', 'aksesori'];
export const BEST_SELLER_MAX = 8;
export const GUIDES_MAX = 3;

// Mirrors components/ProductCard.tsx (simple: price + compareAtPrice or legacy originalPrice; variable: priceFrom +
// the highest variant compareAtPrice above it). Copied because that file is a client component that loads Firebase.
export function effectivePrice(p: Product): { price: number; compareAt: number | null } {
  const any = p as any;
  const legacyCompare = any.compareAtPrice ?? any.originalPrice ?? null;
  if (p.productType === 'variable') {
    const price = any.priceFrom ?? 0;
    const variants: any[] = any.variants || [];
    const compares = variants.map(v => v.compareAtPrice || 0).filter((v: number) => v > 0);
    const maxCompare = compares.length ? Math.max(...compares) : 0;
    const compareAt = maxCompare > price ? maxCompare : legacyCompare;
    return { price, compareAt: compareAt && compareAt > price ? compareAt : null };
  }
  const price = any.price ?? 0;
  return { price, compareAt: legacyCompare && legacyCompare > price ? legacyCompare : null };
}

// design.md §4 (F-016 A3): extend and harian added for the Katalog filter (S2.2) and the card chip (S0.9).
// The order matters: "Side bag Daily Ride" is a side bag, not a daily bag.
export function positionOf(p: Pick<Product, 'slug' | 'name'>): ProductPosition | null {
  if (p.slug in POSITION_BY_SLUG) return POSITION_BY_SLUG[p.slug];
  const name = p.name.toLowerCase();
  if (/tank\s?bag/.test(name)) return 'tank';
  if (/side\s?bag/.test(name)) return 'side';
  if (/tail\s?bag/.test(name)) return 'tail';
  if (/extend\s?bag/.test(name)) return 'extend';
  if (/\bbotol\b|\bacc\s|toolkit|medikit|rollkit/.test(name)) return 'aksesori';
  if (/chest\s?bag|waist\s?bag|sling\s?bag|hand\s?bag|\bdaily\b/.test(name)) return 'harian';
  return null;
}

// Narrows to the four navbar/Beranda positions (S0.4.3); extend and harian have no tile or menu price.
export function isBagPosition(v: ProductPosition | null): v is BagPosition {
  return v !== null && (POSITIONS as readonly string[]).includes(v);
}

function bagPositionOf(p: Pick<Product, 'slug' | 'name'>): BagPosition | null {
  const pos = positionOf(p);
  return isBagPosition(pos) ? pos : null;
}

const MODEL_RULES: readonly [RegExp, string][] = [
  [/xsr\s*-?\s*155/i, 'Yamaha XSR 155'],
  [/\bx\s*-?\s*max\b/i, 'Yamaha XMAX'],
  [/\bn\s*-?\s*max\b/i, 'Yamaha NMAX'],
];

export function fitLabel(p: Pick<Product, 'slug' | 'name'>): FitLabel {
  for (const [re, model] of MODEL_RULES) if (re.test(p.name)) return { kind: 'model', text: `Dibuat untuk ${model}` };
  if (UNIVERSAL_SLUGS.includes(p.slug)) return { kind: 'universal', text: 'Universal, pakai strap' };
  const line = FOR_LINE_BY_SLUG[p.slug];
  return line ? { kind: 'for', text: line } : null;
}

export function hasBannedWord(text: string): boolean {
  const t = text.toLowerCase();
  return BANNED_LABEL_WORDS.some(w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&')}([^a-z]|$)`).test(t));
}

function cropClassOf(slug: string): HomeProductCard['cropClass'] {
  if (CROP_TOP_SLUGS.includes(slug)) return 'iz-crop-top';
  if (CROP_HALF_SLUGS.includes(slug)) return 'iz-crop-half';
  return null;
}

function firstImage(p: Product): string | null {
  return p.images?.[0] || p.imageUrl || null;
}

export function toCard(p: Product): HomeProductCard {
  const { price, compareAt } = effectivePrice(p);
  return {
    slug: p.slug,
    name: p.name,
    image: firstImage(p),
    // HomeProductCard.position and POSITION_CHIP cover the four tile positions only, so extend and harian show
    // no chip until both gain those keys (S0.9 labels "Extend bag", "Tas harian").
    position: bagPositionOf(p),
    fit: fitLabel(p),
    price,
    compareAt,
    cropClass: cropClassOf(p.slug),
  };
}

export function minPriceByPosition(products: Product[]): Record<BagPosition, number | null> {
  const out: Record<BagPosition, number | null> = { tank: null, side: null, tail: null, aksesori: null };
  for (const p of products) {
    const pos = bagPositionOf(p);
    if (!pos) continue;
    const { price } = effectivePrice(p);
    if (price > 0 && (out[pos] === null || price < (out[pos] as number))) out[pos] = price;
  }
  return out;
}

// Same rule as /produk's "Best seller" tab (app/produk/ProdukClient.tsx). Input is already active and newest first.
export function selectBestSellers(products: Product[], max = BEST_SELLER_MAX): HomeProductCard[] {
  return products.filter(p => (p.badge || '').toLowerCase().includes('best')).slice(0, max).map(toCard);
}

export function selectGuides(articles: PublicArticle[], max = GUIDES_MAX): HomeGuideCard[] {
  return articles.slice(0, max).map(a => ({
    slug: a.slug,
    title: a.title,
    image: a.coverImage || a.images?.[0] || a.imageUrl || null,
    imageAlt: a.coverAlt || '',
    author: a.author?.trim() || DEFAULT_AUTHOR,
    date: a.publishedAt ?? a.createdAt ?? null,
    chip: ARTICLE_CHIP_BY_SLUG[a.slug] ?? null,
    credit: a.coverCaption?.trim() || null,
  }));
}

// "Rp520.000" as in the design; lib/utils formatPrice writes "Rp 520.000" (D-10).
export function formatRupiah(n: number): string {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

// "6289513482410" → "+62 895-1348-2410", so the footer text always matches the WA_NUMBER link (16.3).
export function formatWaDisplay(n: string): string {
  const d = n.replace(/\D/g, '');
  if (!d.startsWith('62') || d.length < 10) return '+' + d;
  const rest = d.slice(2);
  return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
}

// "26 Okt 2026" in Jakarta time, identical on server and client.
export function formatShortDate(ms: number | null): string {
  if (ms === null) return '';
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(new Date(ms))
    .replace('.', '');
}

// A sale that has already ended at render time is passed on as inactive, so a regenerated page never ships the
// promo bar only to remove it after hydration (24.7). The client still hides it at zero for stale ISR copies.
export function buildHomeData(products: Product[], articles: PublicArticle[], flash: FlashSaleState, now = Date.now()): HomeData {
  const productImages: Record<string, string> = {};
  for (const p of products) {
    const img = firstImage(p);
    if (img) productImages[p.slug] = img;
  }
  const tourmaxProduct = products.find(p => p.slug === TOURMAX_SLUG);
  return {
    bestSellers: selectBestSellers(products),
    minPrices: minPriceByPosition(products),
    tourmax: tourmaxProduct ? effectivePrice(tourmaxProduct) : null,
    guides: selectGuides(articles),
    gasberPublished: articles.some(a => a.slug === GASBER_SLUG),
    productImages,
    flash: isFlashActive(flash, now) ? flash : { isActive: false, endsAt: null },
  };
}
