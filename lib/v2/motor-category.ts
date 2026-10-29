import type { MotorCategory, Product } from '@/types';

// Category placement for /tas-motor/[kategori] (F-016 P2-2). A-049 (which product fits which category) is open, so
// a product joins a category only when its own name names a model of that category, and products named
// "universal" are listed under "Bisa juga" in every category. No fitment is inferred beyond the name.
const MODELS_BY_CATEGORY: Record<MotorCategory, readonly RegExp[]> = {
  retro: [/\bxsr\b/i, /\bw\s*-?\s*175\b/i],
  matic: [/\bn\s*-?\s*max\b/i, /\bx\s*-?\s*max\b/i, /\bpcx\b/i, /\bmatic\b/i],
  adventure: [/\badventure\b/i, /\bversys\b/i, /\bcb\s*-?\s*150\s*x\b/i],
  trail: [],
};

export const CATEGORY_SLUGS: readonly MotorCategory[] = ['matic', 'adventure', 'retro', 'trail'];

export function isMotorCategory(v: string): v is MotorCategory {
  return (CATEGORY_SLUGS as readonly string[]).includes(v);
}

export function categoryHref(c: MotorCategory): string {
  return `/tas-motor/${c}`;
}

export function madeForCategory(p: Pick<Product, 'name'>, c: MotorCategory): boolean {
  return MODELS_BY_CATEGORY[c].some(re => re.test(p.name));
}

export function isUniversalByName(p: Pick<Product, 'name'>): boolean {
  return /\buniversal\b/i.test(p.name);
}

export function categoriesOf(p: Pick<Product, 'name'>): MotorCategory[] {
  return CATEGORY_SLUGS.filter(c => madeForCategory(p, c));
}
