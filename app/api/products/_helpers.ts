import { computePriceRange, computeTotalStock } from '@/lib/product-utils';
import { CATEGORY_SLUGS, isMotorCategory } from '@/lib/v2/motor-category';
import { hasActiveSidePair } from '@/components/v2/product/side';
import { PRODUCT_IMAGE_MAX, validateImageList } from '@/lib/product-images';

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

  return validateV2Fields(data) ?? validateImageFields(data);
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

  return validateV2Fields(data) ?? validateImageFields(data);
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

// F-022: at most PRODUCT_IMAGE_MAX product photos, each a non-empty URL string. Variant photos get the same sanity
// bound only (the admin form keeps one photo per variant), so a legacy variant with an extra photo never blocks a save.
export function validateImageFields(data: any): ValidationError | null {
  const own = validateImageList(data.images, PRODUCT_IMAGE_MAX, 'produk');
  if (own) return own;
  // imageUrl is stored as is and is the fallback photo when images is missing or empty (review REV-03).
  const u = data.imageUrl;
  if (u !== undefined && u !== null && u !== '' && validateImageList([u], 1, 'produk'))
    return { code: 'INVALID_IMAGES', message: 'Foto utama produk (imageUrl) tidak valid.' };
  const variants: any[] = Array.isArray(data.variants) ? data.variants : [];
  for (const v of variants) {
    const err = validateImageList(v?.images ?? undefined, PRODUCT_IMAGE_MAX, 'variasi');
    if (err) return err;
  }
  return null;
}

// F-016 S4.6.7: an array of unique D1 slugs, at most one per category (ADR-0019, ADR-0022); [] clears the categories.
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

// ── Concurrency ────────────────────────────────────────────────────────────────

// Review REV-03 (F-023): the admin form loads the product list once, and PUT writes the whole document. Without this
// check, a form opened before an automated text update (or another admin's save) would silently write the old name,
// description, and categories back. The form sends the `updatedAt` it loaded as `expectedUpdatedAt`; a stored value
// that differs means the product changed since the page was opened. Compared as JSON because legacy documents hold a
// Firestore Timestamp, which reaches the browser as {_seconds, _nanoseconds}. A body without the key (old clients,
// scripts) is not checked.
export function changedSinceLoaded(stored: Record<string, any> | null | undefined, data: any): boolean {
  if (!data || data.expectedUpdatedAt === undefined) return false;
  return JSON.stringify(stored?.updatedAt ?? null) !== JSON.stringify(data.expectedUpdatedAt ?? null);
}

export const PRODUCT_CHANGED_MESSAGE =
  'Produk ini sudah diubah sejak halaman dibuka (oleh admin lain atau otomasi teks produk). Muat ulang halaman, buka produknya lagi, lalu ulangi perubahan Anda. Belum ada yang tersimpan.';

// ── Read Normalization ─────────────────────────────────────────────────────────
// `normalizeProduct` dipindah ke `lib/product-utils.ts` dan di-re-export di atas
// supaya Server Pages & API route pakai helper yang sama. Lihat komen di
// `lib/product-utils.ts` untuk konteks kenapa normalisasi wajib di setiap baca.
