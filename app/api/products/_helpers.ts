import { computePriceRange, computeTotalStock } from '@/lib/product-utils';
import { CATEGORY_SLUGS, isMotorCategory } from '@/lib/v2/motor-category';
import { hasActiveSidePair } from '@/components/v2/product/side';

// Re-export shared normalization helper so existing API route imports keep
// working. Canonical source lives in `lib/product-utils.ts` karena juga dipakai
// di server pages (lihat app/produk/[slug]/page.tsx & app/produk/page.tsx).
export { normalizeProduct } from '@/lib/product-utils';

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

  return validateV2Fields(data);
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

  return validateV2Fields(data);
}

// F-016 S4.6.7: optional fields of D2 and E3. Checked after the existing rules, so legacy bodies get the same
// errors in the same order as before. A missing key (undefined) is valid: the builders then carry the stored value.
export function validateV2Fields(data: any): ValidationError | null {
  if (data.kategoriMotor !== undefined && !isValidKategoriMotor(data.kategoriMotor))
    return { code: 'INVALID_KATEGORI_MOTOR', message: 'Kategori motor tidak dikenal.' };

  for (const key of ['jualPerSisi', 'bisaSepasang'])
    if (data[key] !== undefined && typeof data[key] !== 'boolean')
      return { code: 'INVALID_SIDE_FLAG', message: 'Nilai sisi harus true atau false.' };

  if (data.jualPerSisi === true && !hasActiveSidePair(data))
    return { code: 'INVALID_SIDE_VARIANTS', message: 'Produk per sisi harus punya varian Kiri dan Kanan.' };

  return null;
}

// F-016 S4.6.7: an array of at most four unique D1 slugs (ADR-0019); [] clears the categories.
function isValidKategoriMotor(v: unknown): v is string[] {
  return Array.isArray(v) && v.length <= CATEGORY_SLUGS.length && v.every(isMotorCategory) && new Set(v).size === v.length;
}

// PUT is a full overwrite (set without merge) and the Admin SDK throws on undefined, so an optional field is
// taken from the body when present, else from the stored document, and left out entirely when neither is valid
// (F-016 S4.6.5, S4.6.6). A legacy product therefore saves with no new key.
function pickOptional(data: any, stored: Record<string, any> | null | undefined, key: string): unknown {
  return data[key] !== undefined ? data[key] : stored?.[key];
}

function v2ProductFields(data: any, stored: Record<string, any> | null | undefined) {
  const kategoriMotor = pickOptional(data, stored, 'kategoriMotor');
  return isValidKategoriMotor(kategoriMotor) ? { kategoriMotor: [...kategoriMotor] } : {};
}

// buildVariablePayload only (S4.6.6). A stored `jualPerSisi: true` is not carried onto a structure that no longer
// meets S4.1.1, because that combination would never pass validateV2Fields from a body.
function v2SideFields(data: any, stored: Record<string, any> | null | undefined, built: { productType: 'variable'; attributes: unknown; variants: unknown }) {
  const out: { jualPerSisi?: boolean; bisaSepasang?: boolean } = {};
  const jualPerSisi = pickOptional(data, stored, 'jualPerSisi');
  if (typeof jualPerSisi === 'boolean' && (!jualPerSisi || data.jualPerSisi === true || hasActiveSidePair(built)))
    out.jualPerSisi = jualPerSisi;
  const bisaSepasang = pickOptional(data, stored, 'bisaSepasang');
  if (typeof bisaSepasang === 'boolean') out.bisaSepasang = bisaSepasang;
  return out;
}

// ── Payload Builders ───────────────────────────────────────────────────────────

// `stored` is the current document on PUT (absent on POST): optional F-016 fields and createdAt missing from the
// body are kept from it instead of being erased by the full overwrite.
export function buildSimplePayload(data: any, stored?: Record<string, any> | null) {
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
    ...v2ProductFields(data, stored),
    createdAt: data.createdAt ?? stored?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildVariablePayload(data: any, stored?: Record<string, any> | null) {
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
  const attributes = Array.isArray(data.attributes) ? data.attributes : [];

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
    attributes,
    variants,
    priceFrom,
    priceTo,
    totalStock,
    ...v2ProductFields(data, stored),
    ...v2SideFields(data, stored, { productType: 'variable', attributes, variants }),
    createdAt: data.createdAt ?? stored?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Read Normalization ─────────────────────────────────────────────────────────
// `normalizeProduct` dipindah ke `lib/product-utils.ts` dan di-re-export di atas
// supaya Server Pages & API route pakai helper yang sama. Lihat komen di
// `lib/product-utils.ts` untuk konteks kenapa normalisasi wajib di setiap baca.
