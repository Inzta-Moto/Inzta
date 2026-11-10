import { buildOrderBody, submitOrder, type FetchLike } from '@/components/v2/product/order-core';
import { cartToOrderItems, pairLines } from '@/lib/cart/cart-core';
import type { CartCheckoutRequest, CartCheckoutResult } from '@/lib/cart/types';

/**
 * F-030 hand-off point (spec "Kontrak titik serah"). The cart UI calls only this function, with the selected,
 * re-checked lines and the voucher already validated against their subtotal; it opens `href` on `ok: true` and shows
 * `message` as is on `ok: false`.
 *
 * The WhatsApp text and the order creation are owned by Angkasa and may be replaced here, keeping this signature.
 * Until then it reuses the existing single-product flow unchanged: POST /api/orders (server-side prices, stock,
 * voucher, affiliateId, UTM) and buildWaLink, which already writes one line per item.
 */
export async function checkoutCart(req: CartCheckoutRequest, fetchFn: FetchLike): Promise<CartCheckoutResult> {
  if (!req.lines.length) return { ok: false, message: 'Pilih barang yang ingin dipesan dulu.' };
  const body = buildOrderBody(cartToOrderItems(req.lines), req.voucher, req.buyerUID, req.utm);
  return submitOrder(body, fetchFn, pairLines(req.lines));
}
