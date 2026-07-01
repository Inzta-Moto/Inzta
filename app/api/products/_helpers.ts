import { computePriceRange, computeTotalStock } from '@/lib/product-utils';

export type ValidationError = { code: string; message: string };

// ── Validation ─────────────────────────────────────────────────────────────────

export function validateSimpleProduct(data: any): ValidationError | null {
  if (typeof data.price !== 'number' || data.price <= 0)
    return { code: 'INVALID_PRICE', message: 'Harga harus lebih dari 0' };

  if (typeof data.stock !== 'number' || data.stock < 0)
    return { code: 'INVALID_STOCK', message: 'Stok tidak boleh negatif' };

  if (data.compareAtPrice != null) {
    if (typeof data.compareAtPrice !== 'number' || data.compareAtPrice <= data.price)
      return { code: 'INVALID_COMPARE_PRICE', message: 'Harga coret harus lebih besar dari harga jual' };
  }

  return null;
}

export function validateVariableProduct(data: any): ValidationError | null {
  const attrs: any[] = Array.isArray(data.attributes) ? data.attributes : [];

  if (attrs.length === 0)
    return { code: 'MISSING_ATTRIBUTES', message: 'Produk variasi harus memiliki minimal 1 atribut' };

  const attrNames = attrs.map((a) => a.name?.trim()).filter(Boolean);
  if (new Set(attrNames).size !== attrNames.length)
    return { code: 'DUPLICATE_ATTRIBUTE', message: 'Nama atribut tidak boleh duplikat' };

  for (const attr of attrs) {
    if (!attr.name?.trim())
      return { code: 'INVALID_ATTRIBUTE', message: 'Nama atribut tidak boleh kosong' };

    const validValues = (attr.values ?? []).filter((v: any) => typeof v === 'string' && v.trim());
    if (validValues.length === 0)
      return { code: 'INVALID_ATTRIBUTE_VALUES', message: `Atribut "${attr.name}" harus memiliki minimal 1 nilai` };
  }

  const variants: any[] = Array.isArray(data.variants) ? data.variants : [];
  const activeVariants = variants.filter((v) => v.isActive);

  if (data.isActive && activeVariants.length === 0)
    return { code: 'NO_ACTIVE_VARIANTS', message: 'Produk aktif harus memiliki minimal 1 variasi aktif' };

  const activeSkus: string[] = [];
  for (const v of activeVariants) {
    if (!v.sku?.trim())
      return { code: 'MISSING_SKU', message: 'SKU wajib diisi untuk semua variasi aktif' };

    if (typeof v.price !== 'number' || v.price <= 0)
      return { code: 'INVALID_VARIANT_PRICE', message: `Harga variasi "${v.sku || '?'}" harus lebih dari 0` };

    if (v.compareAtPrice != null) {
      if (typeof v.compareAtPrice !== 'number' || v.compareAtPrice <= v.price)
        return { code: 'INVALID_VARIANT_COMPARE_PRICE', message: `Harga coret variasi "${v.sku}" harus lebih besar dari harga jual` };
    }

    activeSkus.push(v.sku.trim());
  }

  if (new Set(activeSkus).size !== activeSkus.length)
    return { code: 'DUPLICATE_SKU', message: 'SKU tidak boleh duplikat dalam satu produk' };

  return null;
}

// ── Payload Builders ───────────────────────────────────────────────────────────

export function buildSimplePayload(data: any) {
  return {
    name: data.name,
    slug: data.slug,
    description: data.description ?? '',
    category: data.category ?? '',
    productType: 'simple' as const,
    images: data.images?.length ? data.images : data.imageUrl ? [data.imageUrl] : [],
    ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
    features: Array.isArray(data.features) ? data.features : [],
    badge: data.badge ?? null,
    ...(data.badgeType ? { badgeType: data.badgeType } : {}),
    isActive: Boolean(data.isActive),
    price: data.price,
    compareAtPrice: data.compareAtPrice ?? null,
    stock: data.stock,
    sku: data.sku ?? null,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

export function buildVariablePayload(data: any) {
  const variants = (Array.isArray(data.variants) ? data.variants : []).map((v: any) => ({
    variationId: v.variationId || crypto.randomUUID(),
    sku: v.sku ?? '',
    attributes: v.attributes ?? {},
    price: v.price ?? 0,
    compareAtPrice: v.compareAtPrice ?? null,
    stock: v.stock ?? 0,
    images: Array.isArray(v.images) ? v.images : [],
    isActive: Boolean(v.isActive ?? true),
  }));

  const { priceFrom, priceTo } = computePriceRange(variants);
  const totalStock = computeTotalStock(variants);

  return {
    name: data.name,
    slug: data.slug,
    description: data.description ?? '',
    category: data.category ?? '',
    productType: 'variable' as const,
    images: data.images?.length ? data.images : [],
    ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
    features: Array.isArray(data.features) ? data.features : [],
    badge: data.badge ?? null,
    ...(data.badgeType ? { badgeType: data.badgeType } : {}),
    isActive: Boolean(data.isActive),
    attributes: Array.isArray(data.attributes) ? data.attributes : [],
    variants,
    priceFrom,
    priceTo,
    totalStock,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

// ── Read Normalization ─────────────────────────────────────────────────────────

// Menangani existing Firestore docs yang belum punya productType / pakai originalPrice
export function normalizeProduct(id: string, data: Record<string, any>) {
  return {
    id,
    ...data,
    productType: data.productType ?? 'simple',
    compareAtPrice: data.compareAtPrice ?? data.originalPrice ?? null,
    images: data.images?.length ? data.images : data.imageUrl ? [data.imageUrl] : [],
  };
}
