import type { OrderItemInput, Product, ProductAttribute, ProductVariant, Voucher } from '@/types';
import { buildWaLink } from '@/lib/utils';
import { isSelectionComplete, matchVariant } from '@/lib/product-utils';
import { formatRupiah } from '@/lib/v2/home-data';

// Order and voucher logic of the v2 buy box (F-016 S3.3, E2), moved out of app/produk/[slug]/DetailClient.tsx so it
// can be tested without React. The request and response shapes are the same as DetailClient; only the messages
// move from toast/alert to the form's live region (S3.3.1, S3.3.5). No React or Firebase imports.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// S3.3.5: the body of POST /api/orders, identical in shape to DetailClient.handleOrderClick.
export interface OrderRequestBody {
  items: OrderItemInput[];
  voucherCode: string | null;
  affiliateId: string | null;
  buyerUID: string | null;
}

export function buildOrderBody(items: OrderItemInput[], voucher: Voucher | null, buyerUID: string | null): OrderRequestBody {
  return {
    items,
    voucherCode: voucher?.code ?? null,
    affiliateId: voucher?.affiliateId ?? null,
    buyerUID,
  };
}

// DetailClient recalcDiscount: percentage capped by maxDiscount, never above the subtotal, rounded.
export function voucherDiscount(v: Pick<Voucher, 'type' | 'value' | 'maxDiscount'>, subtotal: number): number {
  let disc = v.type === 'percentage' ? (subtotal * v.value) / 100 : v.value;
  if (v.type === 'percentage' && v.maxDiscount && disc > v.maxDiscount) disc = v.maxDiscount;
  return Math.round(Math.min(disc, subtotal));
}

export const minPurchaseMessage = (min: number) => `Minimal pembelian ${formatRupiah(min)} tidak terpenuhi.`;
export const releasedMessage = (min: number) => `Voucher dilepas. Minimal pembelian ${formatRupiah(min)}.`;

export type VoucherResult = { ok: true; voucher: Voucher; discount: number } | { ok: false; message: string };

// S3.3.1: "Pakai". The code is uppercased and URL-encoded (DetailClient sent it raw); API error text is shown as is.
export async function checkVoucher(input: string, subtotal: number, fetchFn: FetchLike): Promise<VoucherResult> {
  const code = input.trim().toUpperCase();
  try {
    const res = await fetchFn(`/api/vouchers/validate?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data?.error || 'Voucher tidak ditemukan.' };
    const v = data.voucher as Voucher;
    if (v.minPurchase && subtotal < v.minPurchase) return { ok: false, message: minPurchaseMessage(v.minPurchase) };
    return { ok: true, voucher: v, discount: voucherDiscount(v, subtotal) };
  } catch {
    return { ok: false, message: 'Gagal memvalidasi voucher.' };
  }
}

// S3.3.1: affiliate auto-apply (localStorage.inzta_affiliate → GET /api/vouchers/resolve). Every failure is silent
// (null); DetailClient toasted the API text.
export async function resolveAffiliateVoucher(affiliateId: string, subtotal: number, fetchFn: FetchLike): Promise<{ voucher: Voucher; discount: number } | null> {
  try {
    const res = await fetchFn(`/api/vouchers/resolve?affiliateId=${affiliateId}`);
    const data = await res.json();
    if (res.status !== 200) return null;
    const v = data.voucher as Voucher;
    if (v.minPurchase && subtotal < v.minPurchase) return null;
    return { voucher: v, discount: voucherDiscount(v, subtotal) };
  } catch {
    return null;
  }
}

// S3.3.1 "released": the subtotal dropped below minPurchase after a quantity or choice change.
export function recalcVoucher(v: Voucher, subtotal: number): { released: true; message: string } | { released: false; discount: number } {
  if (v.minPurchase && subtotal < v.minPurchase) return { released: true, message: releasedMessage(v.minPurchase) };
  return { released: false, discount: voucherDiscount(v, subtotal) };
}

export type OrderResult = { ok: true; href: string; orderId: string } | { ok: false; message: string };

/**
 * S3.3.5: POST /api/orders, then the WhatsApp link from the server-computed response (DetailClient used the same
 * fields). `extraLine` is the S4.3.4 Sepasang line. Errors read "Gagal membuat pesanan: <message | error>".
 */
export async function submitOrder(body: OrderRequestBody, fetchFn: FetchLike, extraLine?: string): Promise<OrderResult> {
  try {
    const res = await fetchFn('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Gagal membuat pesanan');
    const href = buildWaLink(
      data.orderId,
      data.items,
      {
        totalPrice: data.totalPrice,
        discountAmount: data.discountAmount,
        voucherCode: data.voucherCode,
        finalPrice: data.finalPrice,
      },
      extraLine,
    );
    return { ok: true, href, orderId: data.orderId };
  } catch (e: any) {
    return { ok: false, message: `Gagal membuat pesanan: ${e?.message ?? ''}` };
  }
}

// Generic (non-side) selection state, the DetailClient rules for price, compare-at, stock, and "can order".
export interface GenericState {
  variable: boolean;
  selected: ProductVariant | null;
  complete: boolean;
  variantExists: boolean;
  unitPrice: number;
  compareAt: number | null;
  showSaving: boolean;
  stock: number;
  canOrder: boolean;
  maxQuantity: number;
}

export function genericState(p: Product, selection: Record<string, string>): GenericState {
  const variable = p.productType === 'variable';
  const attrs: ProductAttribute[] = variable ? p.attributes ?? [] : [];
  const variants: ProductVariant[] = variable ? p.variants ?? [] : [];
  const selected = variable ? matchVariant(variants, selection, attrs) : null;
  const complete = variable ? isSelectionComplete(attrs, selection) : true;
  const variantExists = !variable || !complete || selected !== null;
  const raw = p as any;

  const unitPrice = !variable ? raw.price ?? 0 : selected?.price ?? raw.priceFrom ?? 0;
  let compare: number | null;
  if (!variable) compare = raw.compareAtPrice ?? raw.originalPrice ?? null;
  else if (selected) compare = selected.compareAtPrice ?? null;
  else {
    const max = Math.max(0, ...variants.filter(v => v.isActive).map(v => v.compareAtPrice || 0));
    compare = max > 0 ? max : null;
  }
  const compareAt = compare !== null && compare > unitPrice ? compare : null;
  // Variable stock without a matched variant falls back to the legacy top-level stock, as DetailClient did; it never
  // enables ordering on its own because canOrder also needs variantExists.
  const stock = !variable ? raw.stock ?? 0 : selected ? selected.stock ?? 0 : raw.stock ?? 0;
  const canOrder = complete && (variable ? variantExists && selected !== null && stock > 0 : stock > 0);
  const maxQuantity = complete && (!variable || variantExists) ? stock : 0;
  return {
    variable,
    selected,
    complete,
    variantExists,
    unitPrice,
    compareAt,
    // S3.3.3: no "Hemat" while a variable product has no complete selection.
    showSaving: compareAt !== null && complete,
    stock,
    canOrder,
    maxQuantity,
  };
}

// S3.3.2 order button text for the generic picker.
export type ButtonState = 'ready' | 'processing' | 'incomplete' | 'missing' | 'soldout';

export function genericButton(s: GenericState, processing: boolean): ButtonState {
  if (processing) return 'processing';
  if (!s.complete) return 'incomplete';
  if (s.variable && !s.variantExists) return 'missing';
  if (s.stock <= 0 || !s.canOrder) return 'soldout';
  return 'ready';
}

export const BUTTON_TEXT: Record<Exclude<ButtonState, 'incomplete'>, string> = {
  ready: 'Pesan via WhatsApp',
  processing: 'Memproses...',
  missing: 'Varian tidak tersedia',
  soldout: 'Stok Habis',
};
export const INCOMPLETE_TEXT = { generic: 'Pilih variasi terlebih dahulu', side: 'Pilih sisi dulu' } as const;
