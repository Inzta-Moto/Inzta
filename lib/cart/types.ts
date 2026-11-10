import type { OrderUtm, Voucher } from '@/types';

// F-030: guest cart kept in localStorage (no account, no Firestore). Bump CART_VERSION and extend parseCart() when the
// stored shape changes; old data is migrated or dropped, never trusted as is.
export const CART_VERSION = 1;
export const CART_STORAGE_KEY = 'inzta_cart';
export const CART_MAX_LINES = 30;
export const CART_MAX_QTY = 99;

// One cart line = one product + one choice: a simple product (variationId null, pair null), one variant, or a side
// product's Sepasang (pair = the Kiri and Kanan variationIds, quantity = number of pairs).
export interface CartLine {
  productSlug: string;
  variationId: string | null;
  pair: { kiri: string; kanan: string } | null;
  quantity: number;
  selected: boolean;
  addedAt: number;
  // Snapshot at add time, shown while the catalog is unavailable and used to detect a price change.
  name: string;
  optionLabel: string | null;
  image: string | null;
  unitPrice: number;
}

export interface CartState {
  v: typeof CART_VERSION;
  lines: CartLine[];
}

// What the product page knows when the buyer adds: the line without the cart bookkeeping, plus the stock of the chosen
// option so the merged quantity never passes it.
export interface CartAddInput {
  productSlug: string;
  variationId: string | null;
  pair: { kiri: string; kanan: string } | null;
  quantity: number;
  name: string;
  optionLabel: string | null;
  image: string | null;
  unitPrice: number;
  stock: number;
}

export type CartAddOutcome =
  | { kind: 'added'; quantity: number }
  | { kind: 'clamped'; quantity: number; stock: number }
  | { kind: 'atStock'; stock: number }
  | { kind: 'full'; max: number }
  | { kind: 'invalid' };

// Compact public data of one active product, built on the server for /keranjang (lib/cart/catalog.ts).
export interface CartCatalogVariant {
  variationId: string;
  label: string;
  price: number;
  stock: number;
  isActive: boolean;
  image: string | null;
}

export interface CartCatalogEntry {
  slug: string;
  name: string;
  image: string | null;
  productType: 'simple' | 'variable';
  price: number;
  stock: number;
  variants: CartCatalogVariant[];
  // Side products (F-016 S4.1.1): the Kiri and Kanan variationIds and whether Sepasang is offered.
  side: { kiri: string; kanan: string; sepasang: boolean } | null;
}

export type CartLineStatus = 'ok' | 'soldout' | 'unavailable';

export interface CartLineView {
  key: string;
  line: CartLine;
  status: CartLineStatus;
  // Current values when the catalog knows the line; the stored snapshot otherwise.
  name: string;
  optionLabel: string | null;
  image: string | null;
  unitPrice: number;
  stock: number | null;
  quantity: number;
  // Stored price when it differs from the current one (E13).
  priceWas: number | null;
  // The stored quantity was above the stock and has been lowered (E14).
  clamped: boolean;
  // Review REV-07: selected lines sharing one variant (Kiri and Sepasang) ask for more than its stock together; the
  // value is that variant's stock. Checkout waits until the buyer lowers a quantity, because the server would reject
  // the whole order.
  sharedOver: number | null;
}

// Hand-off contract of the checkout (spec F-030, "Kontrak titik serah"). The cart UI only calls checkoutCart() with
// this request; the WhatsApp text and the order creation behind it belong to lib/cart/checkout.ts.
export interface CartCheckoutLine {
  productSlug: string;
  variationId: string | null;
  pair: { kiri: string; kanan: string } | null;
  quantity: number;
  name: string;
  optionLabel: string | null;
  unitPrice: number;
}

export interface CartCheckoutRequest {
  lines: CartCheckoutLine[];
  voucher: Voucher | null;
  buyerUID: string | null;
  utm: OrderUtm | null;
}

export type CartCheckoutResult = { ok: true; href: string; orderId: string; value: number } | { ok: false; message: string };
