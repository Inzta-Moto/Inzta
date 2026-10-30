import type { Product, ProductVariant } from '@/types';
import { WA_NUMBER } from '@/lib/constants';
import { POSITION_CHIP } from '@/lib/v2/home-content';
import { badgeOf, effectivePrice, positionOf, positionsOf } from '@/lib/v2/home-data';

// Pure helpers of the v2 product page (F-016 S3). No React or Firebase imports, so tests/f016-product.cjs loads them.

export interface SpecRow {
  label: string;
  value: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface Crumb {
  label: string;
  href: string;
}

const activeVariants = (p: Product): ProductVariant[] =>
  p.productType === 'variable' && Array.isArray(p.variants) ? p.variants.filter(v => v.isActive) : [];

// S3.1: the first position of the product links to the catalog filter; no position, no step.
export function crumbPosition(p: Pick<Product, 'slug' | 'name'>): Crumb | null {
  const pos = positionsOf(p)[0];
  return pos ? { label: POSITION_CHIP[pos], href: `/produk?posisi=${pos}` } : null;
}

// S3.2: product images (else imageUrl), then the images of active variants, deduplicated in that order. Side-sold
// products show their side photos as separate tiles (S4.4), so `withVariants` is false for them.
export function galleryImages(p: Product, withVariants = true): string[] {
  const main = p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : [];
  const fromVariants = withVariants ? activeVariants(p).flatMap(v => v.images || []) : [];
  const out: string[] = [];
  for (const url of [...main, ...fromVariants]) if (url && !out.includes(url)) out.push(url);
  return out;
}

// S3.5: "Label: nilai" splits on the first colon; other entries keep an empty label column. Nothing is invented.
export function specRows(features: unknown): SpecRow[] {
  if (!Array.isArray(features)) return [];
  return features
    .filter((f): f is string => typeof f === 'string' && f.trim() !== '')
    .map(f => {
      const i = f.indexOf(':');
      if (i <= 0) return { label: '', value: f.trim() };
      const label = f.slice(0, i).trim();
      const value = f.slice(i + 1).trim();
      return value ? { label, value } : { label: '', value: f.trim() };
    });
}

// S3.6: plain text; blank lines start a paragraph, single line breaks stay inside it. No HTML is interpreted.
export function descriptionParagraphs(description: unknown): string[][] {
  if (typeof description !== 'string') return [];
  return description
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map(block => block.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== ''))
    .filter(lines => lines.length > 0);
}

// Server guess for the "Lihat selengkapnya" fold (DescriptionMore), so a long description is folded in the first HTML
// and the page does not jump on load: about 55 characters per line between the phone and desktop column widths, and
// a paragraph gap of half a line. More than 12 such lines (the fold plus its slack) starts folded; the browser then
// measures the real height.
export function descriptionFolds(paragraphs: string[][]): boolean {
  let lines = 0;
  for (const block of paragraphs) {
    for (const line of block) lines += Math.max(1, Math.ceil(line.length / 55));
    lines += 0.5;
  }
  return lines > 12;
}

// S3.7 copy: canvas text for tail bags, the design.md §11 string for everything else.
export function faqItems(p: Pick<Product, 'slug' | 'name'>, rows: SpecRow[]): FaqItem[] {
  const fitAnswer = positionOf(p) === 'tail'
    ? 'Kirim foto jok belakang motor Anda ke admin. Kami cek ukurannya sebelum Anda memesan.'
    : 'Kirim foto motor Anda ke admin. Kami cek ukurannya sebelum Anda memesan.';
  const material = rows.find(r => r.label.toLowerCase() === 'bahan luar')?.value;
  const rain = 'Untuk perjalanan hujan, tanyakan ke admin cara menyimpan barang elektronik.';
  return [
    { q: 'Apakah bisa dipasang di motor saya?', a: fitAnswer },
    { q: 'Apakah tahan hujan?', a: material ? `Bahan luarnya ${material}. ${rain}` : rain },
    { q: 'Berapa lama pengiriman?', a: 'PLACEHOLDER: waktu kirim' },
  ];
}

const isBest = (p: Product) => badgeOf(p.badge) === 'best';

// S3.8: up to 4 active products in another position (no position counts as different), best sellers first, then
// newest; `all` comes from getActiveProducts, which is already active-only and newest first.
export function selectRelated(p: Product, all: Product[], max = 4): Product[] {
  const own = positionOf(p);
  const pool = all.filter(o => o.slug !== p.slug && o.isActive !== false && (own === null || positionOf(o) !== own));
  const byNewest = (a: Product, b: Product) => (Number((b as any).createdAt) || 0) - (Number((a as any).createdAt) || 0);
  return [...pool.filter(isBest).sort(byNewest), ...pool.filter(o => !isBest(o)).sort(byNewest)].slice(0, max);
}

// S3.3.8: the link used without JavaScript (canvas text, no order record).
export function plainOrderHref(name: string): string {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Halo INZTA, saya ingin pesan ${name}`)}`;
}

// S3.3.8: sold out at render shows "Stok Habis" even without JavaScript.
export function soldOutAtRender(p: Product): boolean {
  if (p.productType === 'variable') return !activeVariants(p).some(v => (v.stock ?? 0) > 0);
  return !((p as any).stock > 0);
}

/**
 * S3.10.4: the existing Product JSON-LD, with variable products priced from `priceFrom` and in stock when any active
 * variant has stock (variable documents have no `price`/`stock`). No rating fields. F-005 owns the final shape.
 */
export function productJsonLd(p: Product, baseUrl: string): Record<string, unknown> {
  const raw = p as any;
  const imageUrl: string = (p.images && p.images.length > 0 ? p.images[0] : raw.imageUrl) || '/logo.png';
  const variable = p.productType === 'variable';
  const price = variable ? raw.priceFrom ?? effectivePrice(p).price ?? 0 : raw.price || 0;
  const inStock = variable ? activeVariants(p).some(v => (v.stock ?? 0) > 0) : raw.stock > 0;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name || 'Produk INZTA',
    image: imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`,
    description: p.description || 'Tas motor premium INZTA',
    sku: p.slug,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/produk/${p.slug}`,
      priceCurrency: 'IDR',
      price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    brand: { '@type': 'Brand', name: 'INZTA Moto' },
  };
}

