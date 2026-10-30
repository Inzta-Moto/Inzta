import type { MotorCategory, ProductAttribute, ProductVariant, Side, SidePickerData } from '@/types';
import { CATEGORY_SLUGS, normalizeKategoriMotor } from '@/lib/v2/motor-category';
import { SIDES, SIDE_LABEL, sidePicker, sideStructure } from '@/components/v2/product/side';

// Pure state and payload rules of the admin side preset and motor categories (F-016 S4.6, D2). No React imports, so
// tests/f016-product.cjs loads them. The page keeps its own fields; these only add what S4.6 needs.

export type SaleMode = 'none' | 'side' | 'other';

export interface SideRow {
  variationId: string;
  sku: string;
  // Kept as typed text ("150.000"); parsed on save.
  price: string;
  compareAt: string;
  stock: string;
  images: string[];
}

export interface FormV2State {
  mode: SaleMode;
  rows: Record<Side, SideRow>;
  bisaSepasang: boolean;
  kategori: MotorCategory[];
  kategoriTouched: boolean;
  // What the loaded product stored, so a save writes no new field the admin did not change (S4.6.5).
  loaded: { hadKategori: boolean; jualPerSisi: boolean | undefined; bisaSepasang: boolean | undefined; sideAttrId: string | null };
}

export const CONFIRM_MODE_CHANGE = 'Varian yang ada akan diganti. Perubahan baru berlaku setelah klik Simpan.';
export const UNEQUAL_PRICES = 'Harga dan harga coret kiri dan kanan harus sama.';
export const KATEGORI_LABEL: Record<MotorCategory, string> = { matic: 'Matic', adventure: 'Adventure', retro: 'Retro', trail: 'Trail' };

const emptyRow = (): SideRow => ({ variationId: '', sku: '', price: '', compareAt: '', stock: '', images: [] });
const money = (n: number | null | undefined) => (typeof n === 'number' && n > 0 ? n.toLocaleString('id-ID') : '');
const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Loose admin product shape (GET /api/products returns normalized documents).
export interface AdminProduct {
  productType?: string;
  attributes?: ProductAttribute[];
  variants?: ProductVariant[];
  jualPerSisi?: unknown;
  bisaSepasang?: unknown;
  kategoriMotor?: unknown;
}

// S4.6.1: S4.1.1 structure → "Dijual per sisi"; other variable → "Varian lain"; simple → "Tanpa varian".
export function modeOf(p: AdminProduct | null): SaleMode {
  if (!p) return 'none';
  if (sideStructure(p)) return 'side';
  return p.productType === 'variable' ? 'other' : 'none';
}

function rowOf(v: ProductVariant): SideRow {
  return {
    variationId: v.variationId,
    sku: v.sku ?? '',
    price: money(v.price),
    compareAt: money(v.compareAtPrice),
    stock: typeof v.stock === 'number' ? String(v.stock) : '',
    images: Array.isArray(v.images) ? v.images.slice(0, 1) : [],
  };
}

/**
 * Rows for "Dijual per sisi". A side product loads its two variants; switching from "Varian lain" reuses a variant
 * whose only attribute value is Kiri or Kanan, so its variationId and order history stay attached (S4.6.2).
 */
export function rowsFromVariants(variants: ProductVariant[] | undefined): Record<Side, SideRow> {
  const rows: Record<Side, SideRow> = { kiri: emptyRow(), kanan: emptyRow() };
  for (const s of SIDES) {
    const v = (variants ?? []).find(x => {
      const vals = Object.values(x?.attributes ?? {});
      return vals.length === 1 && norm(vals[0]) === s;
    });
    if (v) rows[s] = rowOf(v);
  }
  return rows;
}

export function initialState(p: AdminProduct | null): FormV2State {
  const structure = p ? sideStructure(p) : null;
  const rows = structure ? { kiri: rowOf(structure.variants.kiri), kanan: rowOf(structure.variants.kanan) } : { kiri: emptyRow(), kanan: emptyRow() };
  return {
    mode: modeOf(p),
    rows,
    // S4.6.1: the switch is on when the field is missing.
    bisaSepasang: p?.bisaSepasang !== false,
    kategori: normalizeKategoriMotor(p?.kategoriMotor),
    kategoriTouched: false,
    loaded: {
      hadKategori: Array.isArray(p?.kategoriMotor),
      jualPerSisi: typeof p?.jualPerSisi === 'boolean' ? p.jualPerSisi : undefined,
      bisaSepasang: typeof p?.bisaSepasang === 'boolean' ? p.bisaSepasang : undefined,
      sideAttrId: structure ? p?.attributes?.[0]?.id ?? null : null,
    },
  };
}

// S4.6.4: "Tanpa varian" → "Dijual per sisi" copies the simple price and compare-at into both rows; Stok stays empty.
export function prefillFromSimple(rows: Record<Side, SideRow>, price: string, compareAt: string): Record<Side, SideRow> {
  const fill = (r: SideRow): SideRow => ({ ...r, price, compareAt, stock: '' });
  return { kiri: fill(rows.kiri), kanan: fill(rows.kanan) };
}

export const parseMoney = (s: string): number => parseInt(s.replace(/\D/g, ''), 10) || 0;

// S4.6.3: blocks saving with one inline message (the first problem found, Kiri before Kanan).
export function validateSideRows(rows: Record<Side, SideRow>): string | null {
  for (const s of SIDES) {
    const r = rows[s];
    const label = SIDE_LABEL[s];
    const price = parseMoney(r.price);
    if (price <= 0) return `${label}: harga harus lebih dari 0.`;
    if (r.compareAt.trim() !== '' && parseMoney(r.compareAt) <= price) return `${label}: harga coret harus lebih besar dari harga jual.`;
    if (!/^\d+$/.test(r.stock.trim())) return `${label}: stok wajib diisi dengan bilangan bulat 0 atau lebih.`;
  }
  const compare = (r: SideRow) => (r.compareAt.trim() === '' ? null : parseMoney(r.compareAt));
  if (parseMoney(rows.kiri.price) !== parseMoney(rows.kanan.price) || compare(rows.kiri) !== compare(rows.kanan)) return UNEQUAL_PRICES;
  return null;
}

function sideVariant(s: Side, r: SideRow, slug: string): ProductVariant {
  const compare = r.compareAt.trim() === '' ? null : parseMoney(r.compareAt);
  return {
    variationId: r.variationId,
    // validateVariableProduct requires SKUs; the canvas has no SKU column (S4.6.2).
    sku: r.sku.trim() || `${slug}-${s}`,
    attributes: { Sisi: SIDE_LABEL[s] },
    price: parseMoney(r.price),
    compareAtPrice: compare,
    stock: parseInt(r.stock.trim(), 10),
    images: r.images.slice(0, 1),
    isActive: true,
  };
}

// The optional fields of every mode: categories only when stored before or changed now, side flags per S4.6.5.
function optionalFields(state: FormV2State): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (state.loaded.hadKategori || state.kategoriTouched) out.kategoriMotor = CATEGORY_SLUGS.filter(c => state.kategori.includes(c));
  if (state.mode === 'side') {
    out.jualPerSisi = true;
    out.bisaSepasang = state.bisaSepasang;
  } else if (state.mode === 'other') {
    // Leaving "Dijual per sisi" clears the stored flag; a stored bisaSepasang is carried (rename = POST, no stored doc).
    if (state.loaded.jualPerSisi === true) out.jualPerSisi = false;
    if (state.loaded.bisaSepasang !== undefined) out.bisaSepasang = state.loaded.bisaSepasang;
  }
  return out;
}

/**
 * S4.6.2: the save body. In "Dijual per sisi" the attribute is `Sisi: Kiri, Kanan`, the two side variants are active
 * and keep their variationIds, and every other variant of the form stays with isActive false (no removal, so order
 * history keeps its variant). Other modes keep the page's body and only add the optional fields.
 */
export function applyToPayload(data: Record<string, any>, state: FormV2State, formVariants: ProductVariant[], uuid: () => string): Record<string, any> {
  const out: Record<string, any> = { ...data, ...optionalFields(state) };
  if (state.mode !== 'side') return out;
  const slug = String(data.slug ?? '');
  const sides = SIDES.map(s => sideVariant(s, state.rows[s], slug));
  const used = new Set(sides.map(v => v.variationId).filter(Boolean));
  const others = formVariants.filter(v => !used.has(v.variationId)).map(v => ({ ...v, isActive: false }));
  out.productType = 'variable';
  out.attributes = [{ id: state.loaded.sideAttrId ?? uuid(), name: 'Sisi', values: ['Kiri', 'Kanan'] }];
  out.variants = [...sides.map(v => (v.variationId ? v : { ...v, variationId: uuid() })), ...others];
  for (const k of ['price', 'compareAtPrice', 'stock', 'sku']) delete out[k];
  return out;
}

// S4.6 preview: the public picker computed from the form values (empty stock counts as 0, so it reads "Habis").
export function previewData(state: FormV2State): SidePickerData | null {
  const variant = (s: Side): ProductVariant => {
    const r = state.rows[s];
    const stock = /^\d+$/.test(r.stock.trim()) ? parseInt(r.stock.trim(), 10) : 0;
    return {
      variationId: `pv-${s}`,
      sku: '',
      attributes: { Sisi: SIDE_LABEL[s] },
      price: parseMoney(r.price),
      compareAtPrice: r.compareAt.trim() === '' ? null : parseMoney(r.compareAt),
      stock,
      images: r.images,
      isActive: true,
    };
  };
  return sidePicker({
    productType: 'variable',
    attributes: [{ id: 'pv', name: 'Sisi', values: ['Kiri', 'Kanan'] }],
    variants: [variant('kiri'), variant('kanan')],
    bisaSepasang: state.bisaSepasang,
  });
}
