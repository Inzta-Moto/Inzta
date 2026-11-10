import { buildOrderBody, type FetchLike } from '@/components/v2/product/order-core';
import { cartToOrderItems, pairLines, PAIR_LABEL } from '@/lib/cart/cart-core';
import { buildWaLink, formatPrice } from '@/lib/utils';
import { WA_NUMBER } from '@/lib/constants';
import type { OrderItemInput } from '@/types';
import type { CartCheckoutLine, CartCheckoutRequest, CartCheckoutResult } from '@/lib/cart/types';

/**
 * F-030 hand-off point (spec "Kontrak titik serah", task T12). The cart UI calls only this function, with the selected,
 * re-checked lines and the voucher already validated against their subtotal; it opens `href` on `ok: true` and shows
 * `message` as is on `ok: false`.
 *
 * Order creation is unchanged: the same POST /api/orders body as the buy box (server-side prices, stock, voucher,
 * affiliateId, UTM). What this function adds, without touching the shared order and voucher code (U-8):
 * - a WhatsApp text with one numbered entry per cart line, priced from the server response (cartWaText);
 * - error messages that say what to do, and name the item when the server message or the cart allows it
 *   (cartOrderError). The server does not say which item failed, so a variant error is only named when one
 *   product in the order has variants.
 */
export async function checkoutCart(req: CartCheckoutRequest, fetchFn: FetchLike): Promise<CartCheckoutResult> {
  if (!req.lines.length) return { ok: false, message: 'Pilih barang yang ingin dipesan dulu.' };
  const items = cartToOrderItems(req.lines);
  const body = buildOrderBody(items, req.voucher, req.buyerUID, req.utm);

  let res: Response;
  try {
    res = await fetchFn('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: MSG_NETWORK };
  }
  let data: OrderResponse | ErrorResponse | null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !isOrderResponse(data)) {
    return { ok: false, message: cartOrderError(res.status, data as ErrorResponse | null, req.lines) };
  }
  return { ok: true, href: cartWaLink(req.lines, items, data), orderId: data.orderId, value: data.finalPrice };
}

// ── Server response ─────────────────────────────────────────────────────────────────────────────────────────────────

// Fields of the 201 response of POST /api/orders that the WhatsApp text uses; items are in the request order.
export interface OrderResponseItem {
  productName: string;
  selectedVariantLabel: string | null;
  sku: string | null;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface OrderResponse {
  orderId: string;
  items: OrderResponseItem[];
  totalPrice: number;
  discountAmount: number;
  voucherCode: string | null;
  finalPrice: number;
}

interface ErrorResponse {
  code?: string;
  message?: string;
  error?: string;
}

function isOrderResponse(d: unknown): d is OrderResponse {
  const o = d as Partial<OrderResponse>;
  return typeof o?.orderId === 'string' && o.orderId !== '' && Array.isArray(o.items) && Number.isFinite(o.finalPrice);
}

// ── WhatsApp text ───────────────────────────────────────────────────────────────────────────────────────────────────

interface WaEntry {
  name: string;
  label: string | null;
  sku: string | null;
  quantityText: string;
  unitPrice: number;
  subtotal: number;
}

const itemKey = (productSlug: string, variationId: string | null) => `${productSlug}|${variationId ?? ''}`;

/**
 * One entry per cart line, in cart order. The server merges a Kiri line and a Sepasang line of the same product into
 * one Kiri item, so the server items are mapped back to the request items by position, and each line is priced with
 * the server unit price: Sepasang = Kiri + Kanan per pair. Returns null when the response does not line up with the
 * request (different item count, a missing item, or entries that do not add up to the server subtotal); the caller
 * then falls back to the buy box text, which is built from the server items alone.
 */
export function cartWaEntries(lines: readonly CartCheckoutLine[], requested: readonly OrderItemInput[], data: OrderResponse): WaEntry[] | null {
  if (data.items.length !== requested.length) return null;
  const byKey = new Map<string, OrderResponseItem>();
  requested.forEach((it, i) => byKey.set(itemKey(it.productSlug, it.variationId), data.items[i]));
  const priced = (si: OrderResponseItem | undefined): si is OrderResponseItem =>
    !!si && Number.isFinite(si.price) && si.price >= 0 && typeof si.productName === 'string';

  const entries: WaEntry[] = [];
  for (const l of lines) {
    if (l.pair) {
      const kiri = byKey.get(itemKey(l.productSlug, l.pair.kiri));
      const kanan = byKey.get(itemKey(l.productSlug, l.pair.kanan));
      if (!priced(kiri) || !priced(kanan)) return null;
      const unit = kiri.price + kanan.price;
      entries.push({
        name: kiri.productName || l.name,
        label: PAIR_LABEL,
        sku: kiri.sku && kanan.sku ? `${kiri.sku} + ${kanan.sku}` : null,
        quantityText: `${l.quantity} pasang`,
        unitPrice: unit,
        subtotal: unit * l.quantity,
      });
    } else {
      const si = byKey.get(itemKey(l.productSlug, l.variationId));
      if (!priced(si)) return null;
      entries.push({
        name: si.productName || l.name,
        label: si.selectedVariantLabel || l.optionLabel,
        sku: si.sku,
        quantityText: String(l.quantity),
        unitPrice: si.price,
        subtotal: si.price * l.quantity,
      });
    }
  }
  const sum = entries.reduce((s, e) => s + e.subtotal, 0);
  return sum === data.totalPrice ? entries : null;
}

/** The cart WhatsApp text. Same header, totals, and buyer form as buildWaLink, so the admin reads one format. */
export function cartWaText(orderId: string, entries: readonly WaEntry[], data: OrderResponse): string {
  let msg = `PESANAN PRODUK\nOrder ID: #${orderId}\nDari keranjang: ${entries.length} produk\n\n`;
  entries.forEach((e, i) => {
    msg += `${i + 1}. ${e.name}`;
    if (e.label) msg += ` — ${e.label}`;
    if (e.sku) msg += ` (SKU: ${e.sku})`;
    msg += `\nJumlah: ${e.quantityText} × ${formatPrice(e.unitPrice)} = ${formatPrice(e.subtotal)}\n\n`;
  });
  if (data.discountAmount > 0) {
    msg += `Subtotal: ${formatPrice(data.totalPrice)}\n`;
    if (data.voucherCode) msg += `Voucher: ${data.voucherCode}\n`;
    msg += `Diskon: -${formatPrice(data.discountAmount)}\n`;
  }
  msg += `Total Bayar: ${formatPrice(data.finalPrice)}\n\n`;
  msg += `Data Pemesan:\nNama: \nNo. HP: \nAlamat: \n\nTerima kasih!`;
  return msg;
}

export function cartWaLink(lines: readonly CartCheckoutLine[], requested: readonly OrderItemInput[], data: OrderResponse): string {
  const entries = cartWaEntries(lines, requested, data);
  if (entries) return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(cartWaText(data.orderId, entries, data))}`;
  return buildWaLink(
    data.orderId,
    data.items,
    { totalPrice: data.totalPrice, discountAmount: data.discountAmount, voucherCode: data.voucherCode, finalPrice: data.finalPrice },
    pairLines(lines),
  );
}

// ── Error messages ──────────────────────────────────────────────────────────────────────────────────────────────────

export const MSG_NETWORK = 'Pesanan belum terkirim. Periksa koneksi internet, lalu coba lagi.';
export const MSG_SERVER = 'Pesanan belum terkirim karena gangguan di server. Coba lagi sebentar lagi, atau chat admin.';
const RELOAD = 'Muat ulang halaman untuk melihat stok dan status terbaru.';
const STOCK_NEXT = 'Muat ulang halaman untuk melihat stok terbaru, lalu sesuaikan jumlahnya.';

const describe = (l: CartCheckoutLine) => (l.optionLabel ? `${l.name} (${l.optionLabel})` : l.name);

// The item a server error is about, when only one product could have caused it: the line itself when that product
// has one line, the product name when it has several. Null when two or more products are possible.
function onlyCandidate(candidates: readonly CartCheckoutLine[]): string | null {
  const slugs = new Set(candidates.map(l => l.productSlug));
  if (slugs.size !== 1) return null;
  return candidates.length === 1 ? describe(candidates[0]) : candidates[0].name;
}

const hasVariant = (l: CartCheckoutLine) => l.pair !== null || l.variationId !== null;
// Server messages that already name the product quote it ("Stok produk "X" tidak mencukupi").
const namesProduct = (m: string) => /".+"/.test(m);
const sentence = (m: string) => (/[.!?]$/.test(m.trim()) ? m.trim() : `${m.trim()}.`);

/**
 * Maps a failed POST /api/orders to a message for the buyer: what went wrong, which item when known, and what to do.
 * Codes and texts are those of app/api/orders/route.ts; a voucher failure has no code, only `error`.
 */
export function cartOrderError(status: number, data: ErrorResponse | null, lines: readonly CartCheckoutLine[]): string {
  const code = data?.code ?? null;
  const text = (data?.message || data?.error || '').trim();

  switch (code) {
    case 'INSUFFICIENT_STOCK': {
      // The server does not say how many are left (0 or fewer than asked), so the reload shows it: lowered, or moved
      // to "Tidak bisa dipesan" when sold out (E14).
      if (namesProduct(text)) return `${sentence(text)} ${STOCK_NEXT}`;
      const who = onlyCandidate(lines.filter(hasVariant));
      return who ? `Stok ${who} tidak mencukupi. ${STOCK_NEXT}` : `Stok salah satu barang tidak mencukupi. ${STOCK_NEXT}`;
    }
    case 'PRODUCT_INACTIVE':
      return `${sentence(text || 'Salah satu produk sedang tidak aktif')} Hapus centangnya, lalu pesan lagi.`;
    case 'VARIANT_INACTIVE':
    case 'VARIANT_NOT_FOUND': {
      const who = onlyCandidate(lines.filter(hasVariant));
      return who ? `Pilihan ${who} sudah tidak tersedia. ${RELOAD}` : `Salah satu pilihan varian sudah tidak tersedia. ${RELOAD}`;
    }
    case 'PRODUCT_NOT_FOUND': {
      const who = onlyCandidate(lines);
      return who ? `${who} sudah tidak dijual. ${RELOAD}` : `Salah satu produk sudah tidak dijual. ${RELOAD}`;
    }
    case 'VARIATION_REQUIRED':
    case 'INVALID_VARIATION':
    case 'INVALID_QUANTITY':
    case 'MISSING_PRODUCT':
    case 'MISSING_ITEMS': {
      // The product changed shape since it was added (simple ↔ variable), or the stored line is broken.
      const who = code === 'VARIATION_REQUIRED' && namesProduct(text) ? text.match(/"(.+)"/)![1] : onlyCandidate(lines);
      const item = who ?? 'salah satu barang';
      return `Data ${item} di keranjang tidak cocok dengan produk terbaru. Hapus barang itu, lalu tambahkan lagi dari halaman produk.`;
    }
  }
  // Voucher failure: { error: 'Gagal menggunakan voucher: <alasan>' }, status 400, no code.
  if (status === 400 && /voucher/i.test(text)) return `${sentence(text)} Lepas atau ganti vouchernya, lalu pesan lagi.`;
  if (status >= 500 || !text) return MSG_SERVER;
  return `Pesanan belum terkirim: ${sentence(text)}`;
}
