import type { OrderItemInput } from '@/types';
import {
  CART_MAX_LINES,
  CART_MAX_QTY,
  CART_VERSION,
  type CartAddInput,
  type CartAddOutcome,
  type CartCatalogEntry,
  type CartCheckoutLine,
  type CartLine,
  type CartLineView,
  type CartState,
} from '@/lib/cart/types';

// F-030 cart rules as pure functions (no React, no storage, no Firebase), so tests/f030-cart.cjs can run them directly.
// Every function returns a new state; callers compare identity to know whether anything changed.

export const PAIR_LABEL = 'Sepasang (kiri + kanan)';

export function emptyCart(): CartState {
  return { v: CART_VERSION, lines: [] };
}

export function lineKey(l: Pick<CartLine, 'productSlug' | 'variationId' | 'pair'>): string {
  if (l.pair) return `${l.productSlug}|pair:${l.pair.kiri}+${l.pair.kanan}`;
  return `${l.productSlug}|${l.variationId ?? ''}`;
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const shortStr = (v: unknown, max: number): string | null => (isStr(v) && v.trim() && v.length <= max ? v : null);

function clampQty(q: number, max = CART_MAX_QTY): number {
  const n = Number.isFinite(q) ? Math.floor(q) : 1;
  return Math.max(1, Math.min(n, Math.max(1, Math.min(max, CART_MAX_QTY))));
}

// Stored data is read like untrusted input: a line that does not have the shape is dropped, not repaired into a guess.
function sanitizeLine(raw: unknown): CartLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const productSlug = shortStr(r.productSlug, 200);
  if (!productSlug) return null;
  const variationId = r.variationId == null ? null : shortStr(r.variationId, 200);
  if (r.variationId != null && !variationId) return null;
  let pair: CartLine['pair'] = null;
  if (r.pair != null) {
    const p = r.pair as Record<string, unknown>;
    const kiri = shortStr(p?.kiri, 200);
    const kanan = shortStr(p?.kanan, 200);
    if (!kiri || !kanan || variationId) return null;
    pair = { kiri, kanan };
  }
  const q = typeof r.quantity === 'number' ? r.quantity : NaN;
  if (!Number.isFinite(q) || q < 1) return null;
  const price = typeof r.unitPrice === 'number' && Number.isFinite(r.unitPrice) && r.unitPrice >= 0 ? r.unitPrice : 0;
  return {
    productSlug,
    variationId,
    pair,
    quantity: clampQty(q),
    selected: r.selected !== false,
    addedAt: typeof r.addedAt === 'number' && Number.isFinite(r.addedAt) ? r.addedAt : 0,
    name: shortStr(r.name, 300) ?? productSlug,
    optionLabel: shortStr(r.optionLabel, 200),
    image: shortStr(r.image, 2000),
    unitPrice: price,
  };
}

function sanitizeLines(list: unknown[]): CartLine[] {
  const out: CartLine[] = [];
  const seen = new Map<string, CartLine>();
  for (const raw of list) {
    const l = sanitizeLine(raw);
    if (!l) continue;
    const k = lineKey(l);
    const prev = seen.get(k);
    if (prev) {
      prev.quantity = clampQty(prev.quantity + l.quantity);
      continue;
    }
    if (out.length >= CART_MAX_LINES) continue;
    seen.set(k, l);
    out.push(l);
  }
  return out;
}

/**
 * Reads the stored cart. Missing, broken, or newer-version data gives an empty cart instead of an error; data written
 * before the version field existed (an object with `lines` and no `v`) is migrated to v1 with defaults for missing
 * fields (selected = true, addedAt = 0).
 */
export function parseCart(raw: string | null | undefined): CartState {
  if (!raw) return emptyCart();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyCart();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyCart();
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.lines)) return emptyCart();
  if (d.v === undefined || d.v === CART_VERSION) return { v: CART_VERSION, lines: sanitizeLines(d.lines) };
  // A newer version comes from newer code in another tab; reading it with old rules could lose fields.
  return emptyCart();
}

export function serializeCart(state: CartState): string {
  return JSON.stringify(state);
}

export function addToCart(state: CartState, input: CartAddInput, now: number): { state: CartState; outcome: CartAddOutcome } {
  const q = Number.isFinite(input.quantity) ? Math.floor(input.quantity) : 0;
  const stock = Number.isFinite(input.stock) ? Math.floor(input.stock) : 0;
  const max = Math.min(CART_MAX_QTY, stock);
  if (q < 1 || max < 1 || !input.productSlug) return { state, outcome: { kind: 'invalid' } };

  const key = lineKey(input);
  const idx = state.lines.findIndex(l => lineKey(l) === key);
  const snapshot = { name: input.name, optionLabel: input.optionLabel, image: input.image, unitPrice: input.unitPrice };

  if (idx >= 0) {
    const cur = state.lines[idx];
    if (cur.quantity >= max) return { state, outcome: { kind: 'atStock', stock: max } };
    const wanted = cur.quantity + q;
    const quantity = Math.min(wanted, max);
    const next: CartLine = { ...cur, ...snapshot, quantity, selected: true, addedAt: now };
    // The line the buyer just touched moves to the top, as a new one would.
    const lines = [next, ...state.lines.slice(0, idx), ...state.lines.slice(idx + 1)];
    return { state: { ...state, lines }, outcome: wanted > max ? { kind: 'clamped', quantity, stock: max } : { kind: 'added', quantity } };
  }

  if (state.lines.length >= CART_MAX_LINES) return { state, outcome: { kind: 'full', max: CART_MAX_LINES } };
  const quantity = Math.min(q, max);
  const line: CartLine = {
    productSlug: input.productSlug,
    variationId: input.pair ? null : input.variationId,
    pair: input.pair,
    quantity,
    selected: true,
    addedAt: now,
    ...snapshot,
  };
  return { state: { ...state, lines: [line, ...state.lines] }, outcome: q > max ? { kind: 'clamped', quantity, stock: max } : { kind: 'added', quantity } };
}

// Quantity within 1..max (max = known stock, never above CART_MAX_QTY). A value below 1 stays 1: removing is explicit.
export function setLineQuantity(state: CartState, key: string, quantity: number, max?: number | null): CartState {
  const idx = state.lines.findIndex(l => lineKey(l) === key);
  if (idx < 0) return state;
  const q = clampQty(quantity, max ?? CART_MAX_QTY);
  if (state.lines[idx].quantity === q) return state;
  const lines = state.lines.slice();
  lines[idx] = { ...lines[idx], quantity: q };
  return { ...state, lines };
}

export interface RemovedLine {
  line: CartLine;
  index: number;
}

export function removeLines(state: CartState, keys: readonly string[]): { state: CartState; removed: RemovedLine[] } {
  const drop = new Set(keys);
  const removed: RemovedLine[] = [];
  const lines = state.lines.filter((l, index) => {
    if (!drop.has(lineKey(l))) return true;
    removed.push({ line: l, index });
    return false;
  });
  return removed.length ? { state: { ...state, lines }, removed } : { state, removed };
}

// "Batalkan" after a remove: lines go back to their old positions unless the same choice was added again meanwhile.
export function restoreLines(state: CartState, removed: readonly RemovedLine[]): CartState {
  if (!removed.length) return state;
  const lines = state.lines.slice();
  const present = new Set(lines.map(lineKey));
  for (const r of [...removed].sort((a, b) => a.index - b.index)) {
    if (present.has(lineKey(r.line)) || lines.length >= CART_MAX_LINES) continue;
    lines.splice(Math.min(r.index, lines.length), 0, r.line);
    present.add(lineKey(r.line));
  }
  return { ...state, lines };
}

export function setSelected(state: CartState, keys: readonly string[], selected: boolean): CartState {
  const set = new Set(keys);
  let changed = false;
  const lines = state.lines.map(l => {
    if (!set.has(lineKey(l)) || l.selected === selected) return l;
    changed = true;
    return { ...l, selected };
  });
  return changed ? { ...state, lines } : state;
}

/**
 * E13–E15: compares every line with the current catalog of active products. `catalog` null means the server could not
 * read the products; the lines are then shown from their snapshot and stay orderable (the order API still checks).
 */
export function reconcileCart(state: CartState, catalog: readonly CartCatalogEntry[] | null): CartLineView[] {
  const bySlug = catalog ? new Map(catalog.map(e => [e.slug, e])) : null;
  return state.lines.map(line => {
    const key = lineKey(line);
    const base: CartLineView = {
      key,
      line,
      status: 'ok',
      name: line.name,
      optionLabel: line.optionLabel,
      image: line.image,
      unitPrice: line.unitPrice,
      stock: null,
      quantity: line.quantity,
      priceWas: null,
      clamped: false,
    };
    if (!bySlug) return base;
    const entry = bySlug.get(line.productSlug);
    if (!entry) return { ...base, status: 'unavailable' };

    let price: number;
    let stock: number;
    let label: string | null;
    let image = entry.image;
    if (line.pair) {
      const side = entry.side;
      const kiri = entry.variants.find(v => v.variationId === line.pair!.kiri);
      const kanan = entry.variants.find(v => v.variationId === line.pair!.kanan);
      const sameSides = side && side.kiri === line.pair.kiri && side.kanan === line.pair.kanan;
      if (!sameSides || !side.sepasang || !kiri?.isActive || !kanan?.isActive) return { ...base, name: entry.name, status: 'unavailable' };
      price = kiri.price + kanan.price;
      stock = Math.min(kiri.stock, kanan.stock);
      label = PAIR_LABEL;
    } else if (line.variationId) {
      const v = entry.variants.find(x => x.variationId === line.variationId);
      if (!v || !v.isActive || entry.productType !== 'variable') return { ...base, name: entry.name, status: 'unavailable' };
      price = v.price;
      stock = v.stock;
      label = v.label || line.optionLabel;
      image = v.image ?? entry.image;
    } else {
      if (entry.productType !== 'simple') return { ...base, name: entry.name, status: 'unavailable' };
      price = entry.price;
      stock = entry.stock;
      label = null;
    }

    stock = Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : 0;
    const view: CartLineView = {
      ...base,
      name: entry.name,
      optionLabel: label,
      image: image ?? line.image,
      unitPrice: price,
      stock,
      priceWas: line.unitPrice > 0 && line.unitPrice !== price ? line.unitPrice : null,
    };
    if (stock <= 0) return { ...view, status: 'soldout' };
    const max = Math.min(stock, CART_MAX_QTY);
    return line.quantity > max ? { ...view, quantity: max, clamped: true } : view;
  });
}

// Persists what the buyer has now seen: current name, option, photo, and price, and quantities lowered to the stock.
// Unavailable lines keep their snapshot so they still show what was added.
export function applyReconcile(state: CartState, views: readonly CartLineView[]): CartState {
  const byKey = new Map(views.map(v => [v.key, v]));
  let changed = false;
  const lines = state.lines.map(l => {
    const v = byKey.get(lineKey(l));
    if (!v || v.status === 'unavailable' || v.stock === null) return l;
    if (l.name === v.name && l.optionLabel === v.optionLabel && l.image === v.image && l.unitPrice === v.unitPrice && l.quantity === v.quantity) return l;
    changed = true;
    return { ...l, name: v.name, optionLabel: v.optionLabel, image: v.image, unitPrice: v.unitPrice, quantity: v.quantity };
  });
  return changed ? { ...state, lines } : state;
}

export const isOrderable = (v: CartLineView) => v.status === 'ok';

export function cartTotals(views: readonly CartLineView[]): { lines: number; quantity: number; subtotal: number } {
  let lines = 0;
  let quantity = 0;
  let subtotal = 0;
  for (const v of views) {
    if (!isOrderable(v) || !v.line.selected) continue;
    lines += 1;
    quantity += v.quantity;
    subtotal += v.unitPrice * v.quantity;
  }
  return { lines, quantity, subtotal };
}

// D-7: the navbar badge counts pieces, so every add changes the number the buyer sees (research F-030, NN/g).
export function badgeCount(state: CartState): number {
  return state.lines.reduce((n, l) => n + l.quantity, 0);
}

export function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export function checkoutLines(views: readonly CartLineView[]): CartCheckoutLine[] {
  return views
    .filter(v => isOrderable(v) && v.line.selected)
    .map(v => ({
      productSlug: v.line.productSlug,
      variationId: v.line.pair ? null : v.line.variationId,
      pair: v.line.pair,
      quantity: v.quantity,
      name: v.name,
      optionLabel: v.optionLabel,
      unitPrice: v.unitPrice,
    }));
}

// POST /api/orders items: Sepasang becomes one Kiri and one Kanan item of n each (F-016 S4.3.2). Items of the same
// product and variant are merged, so the server checks the stock of a variant against the whole quantity once.
export function cartToOrderItems(lines: readonly CartCheckoutLine[]): OrderItemInput[] {
  const out: OrderItemInput[] = [];
  const index = new Map<string, number>();
  const push = (productSlug: string, variationId: string | null, quantity: number) => {
    const k = `${productSlug}|${variationId ?? ''}`;
    const at = index.get(k);
    if (at !== undefined) out[at] = { ...out[at], quantity: out[at].quantity + quantity };
    else {
      index.set(k, out.length);
      out.push({ productSlug, variationId, quantity });
    }
  };
  for (const l of lines) {
    if (l.pair) {
      push(l.productSlug, l.pair.kiri, l.quantity);
      push(l.productSlug, l.pair.kanan, l.quantity);
    } else push(l.productSlug, l.variationId, l.quantity);
  }
  return out;
}

// Extra WhatsApp lines after the order ID, one per Sepasang product (the buy box writes one line for its Sepasang,
// F-016 S4.3.4); without them the admin would only see separate Kiri and Kanan items.
export function pairLines(lines: readonly CartCheckoutLine[]): string | undefined {
  const rows = lines.filter(l => l.pair).map(l => `${l.name}: Sepasang (kiri + kanan), ${l.quantity} pasang`);
  return rows.length ? rows.join('\n') : undefined;
}
