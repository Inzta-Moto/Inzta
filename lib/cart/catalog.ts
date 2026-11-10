import type { Product, ProductVariant } from '@/types';
import { generateLabel } from '@/lib/product-utils';
import { SIDE_LABEL, offersSepasang, sideStructure } from '@/components/v2/product/side';
import type { CartCatalogEntry, CartCatalogVariant } from '@/lib/cart/types';

// F-030 D-2: the public fields /keranjang needs to re-check a stored cart, built on the server from the active products
// the page already reads for the navbar. Inactive products never reach this list, so their lines show as unavailable.

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const firstImage = (list: unknown): string | null => (Array.isArray(list) ? list.find(x => typeof x === 'string' && x) ?? null : null);

export function toCartCatalogEntry(p: Product): CartCatalogEntry | null {
  if (!p?.slug) return null;
  const raw = p as unknown as Record<string, unknown>;
  const image = firstImage(raw.images) ?? (typeof raw.imageUrl === 'string' && raw.imageUrl ? raw.imageUrl : null);
  if (p.productType !== 'variable') {
    return { slug: p.slug, name: p.name, image, productType: 'simple', price: num(raw.price), stock: num(raw.stock), variants: [], side: null };
  }
  const s = sideStructure(p);
  const sideOf = new Map<string, string>();
  if (s) {
    sideOf.set(s.variants.kiri.variationId, SIDE_LABEL.kiri);
    sideOf.set(s.variants.kanan.variationId, SIDE_LABEL.kanan);
  }
  const variants: CartCatalogVariant[] = (Array.isArray(p.variants) ? p.variants : [])
    .filter((v: ProductVariant) => v && typeof v.variationId === 'string')
    .map(v => ({
      variationId: v.variationId,
      label: sideOf.get(v.variationId) ?? generateLabel(v.attributes ?? {}),
      price: num(v.price),
      stock: v.isActive ? num(v.stock) : 0,
      isActive: v.isActive === true,
      image: firstImage(v.images),
    }));
  return {
    slug: p.slug,
    name: p.name,
    image,
    productType: 'variable',
    price: num(raw.priceFrom),
    stock: num(raw.totalStock),
    variants,
    side: s ? { kiri: s.variants.kiri.variationId, kanan: s.variants.kanan.variationId, sepasang: offersSepasang(p) } : null,
  };
}

export function toCartCatalog(products: readonly Product[]): CartCatalogEntry[] {
  return products.map(toCartCatalogEntry).filter((e): e is CartCatalogEntry => e !== null);
}
