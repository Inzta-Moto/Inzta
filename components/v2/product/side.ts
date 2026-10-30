import type { OrderItemInput, ProductAttribute, ProductVariant, Side, SideChoice, SideOption, SidePickerData } from '@/types';

// Pure helpers of the side picker (F-016 S4). No React or Firebase imports: the buy box, the admin preview, and
// the product API validation (app/api/products/_helpers.ts) share the same detection rule.

export const SIDES: readonly Side[] = ['kiri', 'kanan'];
export const SIDE_LABEL: Record<Side, string> = { kiri: 'Kiri', kanan: 'Kanan' };

// Loose input: a normalized product, a raw Firestore document, or an admin request body.
export interface SideSource {
  productType?: unknown;
  attributes?: unknown;
  variants?: unknown;
  bisaSepasang?: unknown;
}

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// F-016 S4.1.2: an inactive side variant counts as stock 0; stock that is not a finite number counts as 0 too.
function stockOf(v: ProductVariant): number {
  if (!v.isActive) return 0;
  return typeof v.stock === 'number' && Number.isFinite(v.stock) ? Math.max(0, Math.floor(v.stock)) : 0;
}

/**
 * F-016 S4.1.1: a variable product with exactly one attribute whose values are exactly Kiri and Kanan
 * (case-insensitive, trimmed) and exactly one variant per value. `jualPerSisi` is neither required nor
 * sufficient. Variants without a side value (inactive leftovers of an older structure, S4.6.2) are ignored.
 */
export function sideStructure(p: SideSource): { attributeName: string; variants: Record<Side, ProductVariant> } | null {
  if (p.productType !== 'variable' || !Array.isArray(p.attributes) || !Array.isArray(p.variants)) return null;
  if (p.attributes.length !== 1) return null;
  const attr = p.attributes[0] as ProductAttribute;
  if (!attr || typeof attr.name !== 'string' || !Array.isArray(attr.values)) return null;
  const values = attr.values.map(norm);
  if (values.length !== 2 || !SIDES.every(s => values.includes(s))) return null;

  const found: Partial<Record<Side, ProductVariant[]>> = {};
  for (const v of p.variants as ProductVariant[]) {
    const side = norm(v?.attributes?.[attr.name]) as Side;
    if (SIDES.includes(side)) (found[side] ??= []).push(v);
  }
  if (!SIDES.every(s => found[s]?.length === 1)) return null;
  return { attributeName: attr.name, variants: { kiri: found.kiri![0], kanan: found.kanan![0] } };
}

export function isSideProduct(p: SideSource): boolean {
  return sideStructure(p) !== null;
}

// F-016 S4.6.7: `jualPerSisi: true` needs the S4.1.1 structure with one active variant per side.
export function hasActiveSidePair(p: SideSource): boolean {
  const s = sideStructure(p);
  return s !== null && s.variants.kiri.isActive === true && s.variants.kanan.isActive === true;
}

// F-016 S4.1.3: Sepasang is offered unless the admin switched it off.
export function offersSepasang(p: SideSource): boolean {
  return p.bisaSepasang !== false;
}

/**
 * F-016 S4.2: options in canvas order (Kiri, Kanan, Sepasang), with price, stock, and the disabled reason that
 * goes inside the radio label (S4.2.5). Sepasang price = Kiri + Kanan (S4.2.4); its stock is the number of
 * complete pairs (S4.3.1). Returns null when the product is not side-sold (S3.3.9 generic picker instead).
 */
export function sidePicker(p: SideSource): SidePickerData | null {
  const s = sideStructure(p);
  if (!s) return null;
  const { kiri, kanan } = s.variants;
  const stock: Record<Side, number> = { kiri: stockOf(kiri), kanan: stockOf(kanan) };
  const allSoldOut = stock.kiri === 0 && stock.kanan === 0;
  const oneOut: Side | null = allSoldOut ? null : stock.kiri === 0 ? 'kiri' : stock.kanan === 0 ? 'kanan' : null;

  const options: SideOption[] = SIDES.map(side => ({
    choice: side,
    label: SIDE_LABEL[side],
    price: s.variants[side].price,
    stock: stock[side],
    disabled: stock[side] === 0,
    reason: stock[side] === 0 ? 'Habis' : null,
  }));
  if (offersSepasang(p)) {
    options.push({
      choice: 'sepasang',
      label: 'Sepasang',
      price: kiri.price + kanan.price,
      stock: Math.min(stock.kiri, stock.kanan),
      disabled: allSoldOut || oneOut !== null,
      // S4.2.2 "Kanan habis" / S4.2.3 "Habis".
      reason: allSoldOut ? 'Habis' : oneOut ? `${SIDE_LABEL[oneOut]} habis` : null,
    });
  }

  // S4.2.2 and S4.2.3 (design.md §11); "Tanya admin" is linked by the component.
  const note = allSoldOut
    ? 'Kiri dan kanan sedang habis. Tanya admin kapan tersedia lagi.'
    : oneOut
      ? `Sisi ${oneOut} sedang habis. Tanya admin kapan tersedia lagi.`
      : null;

  return {
    attributeName: s.attributeName,
    variants: s.variants,
    options,
    note,
    allSoldOut,
    equalPrices: kiri.price === kanan.price && (kiri.compareAtPrice ?? null) === (kanan.compareAtPrice ?? null),
  };
}

export function optionFor(data: SidePickerData, choice: SideChoice): SideOption | null {
  return data.options.find(o => o.choice === choice) ?? null;
}

// F-016 S4.3.1: Kiri stock, Kanan stock, or the lower of both for Sepasang; 0 when the option is unavailable.
export function maxQuantity(data: SidePickerData, choice: SideChoice): number {
  const o = optionFor(data, choice);
  return o && !o.disabled ? o.stock : 0;
}

// F-016 S3.3.4, S4.3.1: the quantity stays within 1..max (1 also when ordering is impossible).
export function clampQuantity(data: SidePickerData, choice: SideChoice, quantity: number): number {
  const max = maxQuantity(data, choice);
  const q = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  return Math.max(1, Math.min(q, Math.max(1, max)));
}

// F-016 S4.3.3: voucher subtotal = option total (Sepasang: (Kiri + Kanan) x n).
export function optionTotal(data: SidePickerData, choice: SideChoice, quantity: number): number {
  const o = optionFor(data, choice);
  return o ? o.price * quantity : 0;
}

// F-016 S4.3.2: POST /api/orders items. Sepasang = one Kiri item and one Kanan item of n each, in that order.
export function buildSideItems(productSlug: string, data: SidePickerData, choice: SideChoice, quantity: number): OrderItemInput[] {
  const item = (side: Side): OrderItemInput => ({ productSlug, variationId: data.variants[side].variationId, quantity });
  return choice === 'sepasang' ? [item('kiri'), item('kanan')] : [item(choice)];
}

/**
 * F-016 S4.2.4: the price row shows the chosen side's variant (Kiri's when nothing or Sepasang is chosen). Legacy
 * data with unequal prices shows a range "/ sisi" until Kiri or Kanan is chosen.
 */
export function sidePriceRow(
  data: SidePickerData,
  choice: SideChoice | null,
): { kind: 'single'; price: number; compareAt: number | null } | { kind: 'range'; low: number; high: number } {
  const side: Side = choice === 'kanan' ? 'kanan' : 'kiri';
  if (!data.equalPrices && (choice === null || choice === 'sepasang')) {
    const prices = SIDES.map(s => data.variants[s].price);
    if (prices[0] !== prices[1]) return { kind: 'range', low: Math.min(...prices), high: Math.max(...prices) };
  }
  const v = data.variants[side];
  const compareAt = v.compareAtPrice != null && v.compareAtPrice > v.price ? v.compareAtPrice : null;
  return { kind: 'single', price: v.price, compareAt };
}

// F-016 S4.3.4: extra WhatsApp line after the order ID for Sepasang (composed from canvas strings).
export function sepasangWaLine(pairs: number): string {
  return `Pilihan: Sepasang (kiri + kanan), ${pairs} pasang`;
}

// F-016 S4.3: the "Pilihan" and "Isi pesanan" rows of the order summary after a choice.
export function sideSummary(choice: SideChoice, quantity: number): { pilihan: string; isi: string } {
  if (choice === 'sepasang') return { pilihan: 'Sepasang (kiri + kanan)', isi: `${quantity} kiri + ${quantity} kanan` };
  return { pilihan: SIDE_LABEL[choice], isi: `${quantity} ${choice}` };
}

// F-016 S4.3.1: the quantity label reads "Jumlah pasang" only for Sepasang.
export function quantityLabel(choice: SideChoice | null): string {
  return choice === 'sepasang' ? 'Jumlah pasang' : 'Jumlah';
}
