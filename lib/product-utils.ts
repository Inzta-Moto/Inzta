import type {
  ProductAttribute,
  ProductVariant,
  OrderItem,
  ProductType,
} from '@/types';

// ── Label ──────────────────────────────────────────────────────────────────────

export function generateLabel(attributes: Record<string, string>): string {
  return Object.values(attributes).join(', ');
}

// ── Variant Matching ───────────────────────────────────────────────────────────

export function isSelectionComplete(
  attributes: ProductAttribute[],
  selected: Record<string, string>,
): boolean {
  return attributes.every((a) => selected[a.name] !== undefined);
}

export function matchVariant(
  variants: ProductVariant[],
  selected: Record<string, string>,
  attributes: ProductAttribute[],
): ProductVariant | null {
  if (!isSelectionComplete(attributes, selected)) return null;
  return (
    variants.find(
      (v) =>
        v.isActive &&
        Object.entries(selected).every(([k, val]) => v.attributes[k] === val),
    ) ?? null
  );
}

// Returns true jika value ini — dikombinasikan dengan selection saat ini — masih
// punya setidaknya satu active variant yang memungkinkan.
export function isValueAvailable(
  variants: ProductVariant[],
  attributeName: string,
  value: string,
  currentSelection: Record<string, string>,
): boolean {
  const trial = { ...currentSelection, [attributeName]: value };
  return variants.some(
    (v) =>
      v.isActive &&
      Object.entries(trial).every(
        ([k, val]) => v.attributes[k] === undefined || v.attributes[k] === val,
      ),
  );
}

// ── Price & Stock Cache ────────────────────────────────────────────────────────

export function computePriceRange(variants: ProductVariant[]): {
  priceFrom: number | null;
  priceTo: number | null;
} {
  const active = variants.filter((v) => v.isActive);
  if (active.length === 0) return { priceFrom: null, priceTo: null };
  const prices = active.map((v) => v.price);
  return { priceFrom: Math.min(...prices), priceTo: Math.max(...prices) };
}

export function computeTotalStock(variants: ProductVariant[]): number {
  return variants
    .filter((v) => v.isActive)
    .reduce((sum, v) => sum + v.stock, 0);
}

// ── Variant Generation (admin) ─────────────────────────────────────────────────

export function cartesianProduct(
  attributes: ProductAttribute[],
): Record<string, string>[] {
  if (attributes.length === 0) return [];
  return attributes.reduce<Record<string, string>[]>(
    (acc, attr) =>
      acc.flatMap((combo) =>
        attr.values.map((val) => ({ ...combo, [attr.name]: val })),
      ),
    [{}],
  );
}

export function countCombinations(attributes: ProductAttribute[]): number {
  if (attributes.length === 0) return 0;
  return attributes.reduce((acc, a) => acc * Math.max(a.values.length, 1), 1);
}

// Generates variant list dari attributes, mempertahankan data variant yang
// sudah ada. Variant yang kombinasinya hilang di-set isActive=false (soft delete).
export function generateVariants(
  attributes: ProductAttribute[],
  existingVariants: ProductVariant[],
  defaults: { price: number; compareAtPrice: number | null; stock: number },
): ProductVariant[] {
  const combinations = cartesianProduct(attributes);

  const regenerated: ProductVariant[] = combinations.map((attrsRecord) => {
    const existing = existingVariants.find((v) =>
      sameAttributes(v.attributes, attrsRecord),
    );
    if (existing) return existing;
    return {
      variationId: crypto.randomUUID(),
      sku: '',
      attributes: attrsRecord,
      price: defaults.price,
      compareAtPrice: defaults.compareAtPrice,
      stock: defaults.stock,
      images: [],
      isActive: true,
      isDefault: false,
    };
  });

  const orphaned: ProductVariant[] = existingVariants
    .filter((v) => !combinations.some((c) => sameAttributes(v.attributes, c)))
    .map((v) => ({ ...v, isActive: false }));

  return [...regenerated, ...orphaned];
}

function sameAttributes(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}

// ── Order Normalization (backward compat untuk order lama) ─────────────────────

export function normalizeOrderItem(raw: Record<string, unknown>): OrderItem {
  const id = raw.id as string | undefined;
  return {
    id,
    productId:            (raw.productId   as string)  ?? id ?? '',
    productSlug:          (raw.productSlug as string)  ?? id ?? '',
    productName:          (raw.productName as string)  ?? (raw.name as string) ?? '',
    productType:          (raw.productType as ProductType) ?? 'simple',
    variationId:          (raw.variationId as string | null) ?? null,
    quantity:             raw.quantity as number,
    price:                raw.price as number,
    subtotal:             (raw.subtotal as number) ?? (raw.price as number) * (raw.quantity as number),
    imageUrl:             (raw.imageUrl as string | null) ?? null,
    selectedVariantLabel: (raw.selectedVariantLabel as string | null) ?? null,
    variantSnapshot:      (raw.variantSnapshot as OrderItem['variantSnapshot']) ?? null,
  };
}

// ── Image Helper ───────────────────────────────────────────────────────────────

export function primaryImage(images: string[]): string | null {
  return images[0] ?? null;
}
