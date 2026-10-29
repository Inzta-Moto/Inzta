import type { MotorCategory, Product } from '@/types';

// Motor categories of ADR-0019 (D1 slugs, D1 order). Pure: no Firebase or React imports, so the tests, the API
// helpers, and scripts/f016-kategori-draft.mjs can load it.
export const CATEGORY_SLUGS: readonly MotorCategory[] = ['matic', 'adventure', 'retro', 'trail'];

// F-016 S5.8.4: a category page is indexable only after RND validates the mapping (A-049) and the owner's index
// policy is known. Change this list only in a PR that cites that written validation.
export const INDEXABLE_CATEGORIES: readonly MotorCategory[] = [];

// F-016 S5.8.4: S5.3 needs at least this many products before the page may be indexed.
export const INDEXABLE_MIN_PRODUCTS = 2;

export function isMotorCategory(v: unknown): v is MotorCategory {
  return typeof v === 'string' && (CATEGORY_SLUGS as readonly string[]).includes(v);
}

export function categoryHref(c: MotorCategory): string {
  return `/tas-motor/${c}`;
}

// F-016 S5.3, S6.8.4: readers keep only D1 slugs, once each, in D1 order; anything else (missing, not an array,
// unknown values) reads as [].
export function normalizeKategoriMotor(v: unknown): MotorCategory[] {
  if (!Array.isArray(v)) return [];
  return CATEGORY_SLUGS.filter(c => v.includes(c));
}

type WithKategori = Pick<Product, 'kategoriMotor'>;

// F-016 S5.5: a product tagged with all four categories is a strap/universal product, shown under "Bisa juga".
export function isUniversalProduct(p: WithKategori): boolean {
  return normalizeKategoriMotor(p.kategoriMotor).length === CATEGORY_SLUGS.length;
}

// F-016 D2, S5.3: tagged with the category, and not with all four (those belong to S5.5). Order is kept, so the
// caller decides the sort (best sellers first, then newest).
export function productsForCategory<T extends WithKategori>(products: readonly T[], c: MotorCategory): T[] {
  return products.filter(p => !isUniversalProduct(p) && normalizeKategoriMotor(p.kategoriMotor).includes(c));
}

// F-016 D2, S5.5: products tagged with all four categories. Being universal here never produces the
// "Universal, pakai strap" chip (S5.5.1, D10); that chip comes only from fitLabel().
export function universalProducts<T extends WithKategori>(products: readonly T[]): T[] {
  return products.filter(isUniversalProduct);
}

// F-016 S5.8.4: true only when the category is on the allowlist, S5.3 has at least two products, and the hero
// shows an approved lead (not P-17). Page metadata and app/sitemap.ts call this same helper (S5.8.5).
export function isCategoryIndexable(
  c: MotorCategory,
  products: readonly WithKategori[],
  hasApprovedLead = false,
): boolean {
  return INDEXABLE_CATEGORIES.includes(c) && hasApprovedLead && productsForCategory(products, c).length >= INDEXABLE_MIN_PRODUCTS;
}

// Draft proposal only (design.md §3.2, P-22, "perlu validasi Bang Raja"): read by scripts/f016-kategori-draft.mjs
// to print suggested values. It never places a product on a page; placement reads kategoriMotor (D2).
const DRAFT_MODELS_BY_CATEGORY: Record<MotorCategory, readonly RegExp[]> = {
  retro: [/\bxsr\b/i],
  matic: [/\bn\s*-?\s*max\b/i, /\bx\s*-?\s*max\b/i, /\bpcx\b/i, /\bmatic\b/i],
  adventure: [/\badventure\b/i, /\bversys\b/i, /\bcb\s*-?\s*150\s*x\b/i],
  trail: [],
};

export function madeForCategory(p: Pick<Product, 'name'>, c: MotorCategory): boolean {
  return DRAFT_MODELS_BY_CATEGORY[c].some(re => re.test(p.name));
}

export function isUniversalByName(p: Pick<Product, 'name'>): boolean {
  return /\buniversal\b/i.test(p.name);
}

export function categoriesOf(p: Pick<Product, 'name'>): MotorCategory[] {
  return CATEGORY_SLUGS.filter(c => madeForCategory(p, c));
}

// design.md §3.2: names with "universal" are proposed for all four categories, others by the model in the name.
export function draftKategoriMotor(p: Pick<Product, 'name'>): MotorCategory[] {
  return isUniversalByName(p) ? [...CATEGORY_SLUGS] : categoriesOf(p);
}
