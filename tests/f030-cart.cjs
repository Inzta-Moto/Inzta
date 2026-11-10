// F-030 cart: pure rules (lib/cart/cart-core.ts), the server catalog (lib/cart/catalog.ts), the checkout hand-off
// contract (lib/cart/checkout.ts) with a mocked fetch, and a static check that the existing order and voucher code is
// untouched. Example data only ("(contoh)" names, made-up ids and prices).
// Usage: npm run test:cart  (or: node tests/f030-cart.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');
const { execSync } = require('child_process');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

// No network: the checkout goes through an injected fetch.
global.fetch = async (url) => { throw new Error(`real fetch called: ${url}`); };

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
const compile = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  m._compile(out.outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const C = require(path.join(ROOT, 'lib/cart/cart-core.ts'));
const T = require(path.join(ROOT, 'lib/cart/types.ts'));
const { toCartCatalog } = require(path.join(ROOT, 'lib/cart/catalog.ts'));
const { checkoutCart } = require(path.join(ROOT, 'lib/cart/checkout.ts'));

const results = [];
const pending = [];
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(() => results.push(['PASS', name]), e => results.push(['FAIL', name + ': ' + (e && e.message)])));
      return;
    }
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ': ' + (e && e.message)]);
  }
}

const NOW = 1_800_000_000_000;
const simple = (over = {}) => ({ productSlug: 'tail-bag-contoh', variationId: null, pair: null, quantity: 1, name: 'Tail bag (contoh)', optionLabel: null, image: null, unitPrice: 520000, stock: 5, ...over });
const variant = (over = {}) => ({ productSlug: 'tank-bag-contoh', variationId: 'v-hitam', pair: null, quantity: 1, name: 'Tank bag (contoh)', optionLabel: 'Hitam', image: null, unitPrice: 400000, stock: 3, ...over });
const pair = (over = {}) => ({ productSlug: 'side-bag-contoh', variationId: null, pair: { kiri: 'v-kiri', kanan: 'v-kanan' }, quantity: 1, name: 'Side bag (contoh)', optionLabel: 'Sepasang (kiri + kanan)', image: null, unitPrice: 300000, stock: 3, ...over });
const add = (s, input) => C.addToCart(s, input, NOW);

// Catalog as the server builds it, from Product-shaped objects.
const PRODUCTS = [
  { slug: 'tail-bag-contoh', name: 'Tail bag (contoh)', productType: 'simple', price: 520000, stock: 5, images: ['https://example.test/tail.jpg'], isActive: true },
  {
    slug: 'tank-bag-contoh', name: 'Tank bag (contoh)', productType: 'variable', priceFrom: 400000, totalStock: 4, images: ['https://example.test/tank.jpg'], isActive: true,
    attributes: [{ id: 'a1', name: 'Warna', values: ['Hitam', 'Abu'] }],
    variants: [
      { variationId: 'v-hitam', sku: 'S1', attributes: { Warna: 'Hitam' }, price: 400000, compareAtPrice: null, stock: 3, images: ['https://example.test/hitam.jpg'], isActive: true },
      { variationId: 'v-abu', sku: 'S2', attributes: { Warna: 'Abu' }, price: 410000, compareAtPrice: null, stock: 1, images: [], isActive: false },
    ],
  },
  {
    slug: 'side-bag-contoh', name: 'Side bag (contoh)', productType: 'variable', priceFrom: 150000, totalStock: 7, images: [], isActive: true, bisaSepasang: true,
    attributes: [{ id: 'a2', name: 'Sisi', values: ['Kiri', 'Kanan'] }],
    variants: [
      { variationId: 'v-kiri', sku: 'K', attributes: { Sisi: 'Kiri' }, price: 150000, compareAtPrice: null, stock: 4, images: [], isActive: true },
      { variationId: 'v-kanan', sku: 'N', attributes: { Sisi: 'Kanan' }, price: 150000, compareAtPrice: null, stock: 3, images: [], isActive: true },
    ],
  },
];
const CATALOG = toCartCatalog(PRODUCTS);

check('lineKey: simple, variant, and Sepasang are distinct keys', () => {
  assert.strictEqual(C.lineKey(simple()), 'tail-bag-contoh|');
  assert.strictEqual(C.lineKey(variant()), 'tank-bag-contoh|v-hitam');
  assert.strictEqual(C.lineKey(pair()), 'side-bag-contoh|pair:v-kiri+v-kanan');
  assert.notStrictEqual(C.lineKey(pair()), C.lineKey({ ...pair(), pair: null, variationId: 'v-kiri' }));
});

check('U-1 add: new lines go on top, selected; same product + same choice merges; another choice is a new line', () => {
  let s = C.emptyCart();
  let r = add(s, simple());
  assert.deepStrictEqual(r.outcome, { kind: 'added', quantity: 1 });
  s = r.state;
  s = add(s, variant()).state;
  assert.deepStrictEqual(s.lines.map(C.lineKey), ['tank-bag-contoh|v-hitam', 'tail-bag-contoh|']);
  assert.ok(s.lines.every(l => l.selected && l.addedAt === NOW));
  r = add(s, simple({ quantity: 2 }));
  assert.deepStrictEqual(r.outcome, { kind: 'added', quantity: 3 });
  assert.strictEqual(r.state.lines.length, 2);
  assert.strictEqual(r.state.lines[0].productSlug, 'tail-bag-contoh', 'touched line moves to the top');
  s = add(r.state, variant({ variationId: 'v-abu', optionLabel: 'Abu' })).state;
  s = add(s, pair()).state;
  s = add(s, { ...pair(), pair: null, variationId: 'v-kiri', optionLabel: 'Kiri' }).state;
  assert.strictEqual(s.lines.length, 5);
});

check('U-1 add: merging refreshes the snapshot and re-selects the line; input is never mutated', () => {
  let s = add(C.emptyCart(), simple()).state;
  s = C.setSelected(s, [C.lineKey(simple())], false);
  const input = simple({ unitPrice: 500000, name: 'Tail bag baru (contoh)' });
  const frozen = JSON.stringify(input);
  s = add(s, input).state;
  assert.strictEqual(s.lines[0].unitPrice, 500000);
  assert.strictEqual(s.lines[0].name, 'Tail bag baru (contoh)');
  assert.strictEqual(s.lines[0].selected, true);
  assert.strictEqual(JSON.stringify(input), frozen);
});

check('U-2 add: stock limits, full cart, invalid input', () => {
  let r = add(C.emptyCart(), simple({ quantity: 7 }));
  assert.deepStrictEqual(r.outcome, { kind: 'clamped', quantity: 5, stock: 5 });
  r = add(r.state, simple());
  assert.deepStrictEqual(r.outcome, { kind: 'atStock', stock: 5 });
  let s = add(C.emptyCart(), simple({ quantity: 4 })).state;
  r = add(s, simple({ quantity: 3 }));
  assert.deepStrictEqual(r.outcome, { kind: 'clamped', quantity: 5, stock: 5 });
  assert.strictEqual(add(C.emptyCart(), simple({ stock: 0 })).outcome.kind, 'invalid');
  assert.strictEqual(add(C.emptyCart(), simple({ quantity: 0 })).outcome.kind, 'invalid');
  assert.strictEqual(add(C.emptyCart(), simple({ stock: 500, quantity: 150 })).state.lines[0].quantity, T.CART_MAX_QTY);
  s = C.emptyCart();
  for (let i = 0; i < T.CART_MAX_LINES; i++) s = add(s, simple({ productSlug: `contoh-${i}` })).state;
  assert.strictEqual(s.lines.length, 30);
  r = add(s, simple({ productSlug: 'contoh-baru' }));
  assert.deepStrictEqual(r.outcome, { kind: 'full', max: 30 });
  assert.strictEqual(r.state, s);
  assert.strictEqual(add(s, simple({ productSlug: 'contoh-3' })).outcome.kind, 'added', 'an existing line still merges when full');
});

check('U-3 quantity: 1..max, decimals floored, unknown key is a no-op', () => {
  let s = add(C.emptyCart(), simple({ quantity: 2 })).state;
  const k = C.lineKey(simple());
  assert.strictEqual(C.setLineQuantity(s, k, 0, 5).lines[0].quantity, 1);
  assert.strictEqual(C.setLineQuantity(s, k, -3, 5).lines[0].quantity, 1);
  assert.strictEqual(C.setLineQuantity(s, k, 3.9, 5).lines[0].quantity, 3);
  assert.strictEqual(C.setLineQuantity(s, k, 9, 5).lines[0].quantity, 5);
  assert.strictEqual(C.setLineQuantity(s, k, 500, null).lines[0].quantity, 99);
  assert.strictEqual(C.setLineQuantity(s, k, 2, 5), s, 'same value returns the same state');
  assert.strictEqual(C.setLineQuantity(s, 'nope|', 3, 5), s);
});

check('U-3 remove and restore ("Batalkan"): old positions, no duplicate when re-added meanwhile', () => {
  let s = C.emptyCart();
  s = add(s, simple()).state; // index 2 after the next two
  s = add(s, variant()).state;
  s = add(s, pair()).state;
  const before = s.lines.map(C.lineKey);
  const r = C.removeLines(s, [C.lineKey(variant()), C.lineKey(simple())]);
  assert.strictEqual(r.state.lines.length, 1);
  assert.deepStrictEqual(r.removed.map(x => x.index), [1, 2]);
  assert.deepStrictEqual(C.restoreLines(r.state, r.removed).lines.map(C.lineKey), before);
  const readded = add(r.state, variant()).state;
  assert.strictEqual(C.restoreLines(readded, r.removed).lines.length, 3);
  assert.strictEqual(C.removeLines(s, ['nope|']).state, s);
});

check('selection: per line and all; unchanged selection keeps identity', () => {
  let s = add(add(C.emptyCart(), simple()).state, variant()).state;
  const keys = s.lines.map(C.lineKey);
  const off = C.setSelected(s, keys, false);
  assert.ok(off.lines.every(l => !l.selected));
  assert.strictEqual(C.setSelected(off, keys, false), off);
  assert.ok(C.setSelected(off, [keys[0]], true).lines[0].selected);
});

check('U-4 parseCart: empty, broken JSON, wrong shapes, newer version give an empty cart', () => {
  for (const raw of [null, undefined, '', '{', 'null', '42', '[]', '{"v":1}', '{"v":1,"lines":{}}', '{"v":2,"lines":[]}']) {
    assert.deepStrictEqual(C.parseCart(raw), { v: 1, lines: [] }, String(raw));
  }
  const newer = JSON.stringify({ v: 2, lines: [{ productSlug: 'tail-bag-contoh', quantity: 1 }] });
  assert.deepStrictEqual(C.parseCart(newer).lines, []);
});

check('U-4 parseCart: data without a version is migrated to v1 with defaults; broken lines are dropped', () => {
  const legacy = JSON.stringify({
    lines: [
      { productSlug: 'tail-bag-contoh', variationId: null, quantity: 2, name: 'Tail bag (contoh)', unitPrice: 520000 },
      { productSlug: 'side-bag-contoh', pair: { kiri: 'v-kiri', kanan: 'v-kanan' }, quantity: 1 },
      { productSlug: '', quantity: 1 },
      { productSlug: 'x', quantity: 0 },
      { productSlug: 'x', quantity: 'dua' },
      { productSlug: 'x', variationId: 5, quantity: 1 },
      { productSlug: 'x', variationId: 'v1', pair: { kiri: 'a', kanan: 'b' }, quantity: 1 },
      { productSlug: 'y', pair: { kiri: 'a' }, quantity: 1 },
      'junk',
    ],
  });
  const s = C.parseCart(legacy);
  assert.strictEqual(s.v, 1);
  assert.strictEqual(s.lines.length, 2);
  assert.deepStrictEqual(
    { sel: s.lines[0].selected, added: s.lines[0].addedAt, label: s.lines[0].optionLabel, image: s.lines[0].image },
    { sel: true, added: 0, label: null, image: null },
  );
  assert.strictEqual(s.lines[1].name, 'side-bag-contoh', 'missing name falls back to the slug');
  assert.strictEqual(s.lines[1].unitPrice, 0);
});

check('U-4 parseCart: duplicates merge (capped 99), more than 30 lines are cut, round trip keeps the state', () => {
  const dup = JSON.stringify({ v: 1, lines: [{ productSlug: 'a', quantity: 60 }, { productSlug: 'a', quantity: 60 }, { productSlug: 'b', quantity: 1.7 }] });
  const s = C.parseCart(dup);
  assert.deepStrictEqual(s.lines.map(l => [l.productSlug, l.quantity]), [['a', 99], ['b', 1]]);
  const many = JSON.stringify({ v: 1, lines: Array.from({ length: 40 }, (_, i) => ({ productSlug: `p${i}`, quantity: 1 })) });
  assert.strictEqual(C.parseCart(many).lines.length, 30);
  let full = add(add(add(C.emptyCart(), simple()).state, variant()).state, pair()).state;
  assert.deepStrictEqual(C.parseCart(C.serializeCart(full)), full);
});

check('catalog: simple, variant labels, inactive variant stock 0, side structure with Kiri/Kanan labels', () => {
  const byslug = Object.fromEntries(CATALOG.map(e => [e.slug, e]));
  assert.deepStrictEqual(byslug['tail-bag-contoh'], { slug: 'tail-bag-contoh', name: 'Tail bag (contoh)', image: 'https://example.test/tail.jpg', productType: 'simple', price: 520000, stock: 5, variants: [], side: null });
  const tank = byslug['tank-bag-contoh'];
  assert.deepStrictEqual(tank.variants.map(v => [v.label, v.stock, v.isActive, v.image]), [['Hitam', 3, true, 'https://example.test/hitam.jpg'], ['Abu', 0, false, null]]);
  assert.strictEqual(tank.side, null);
  const side = byslug['side-bag-contoh'];
  assert.deepStrictEqual(side.side, { kiri: 'v-kiri', kanan: 'v-kanan', sepasang: true });
  assert.deepStrictEqual(side.variants.map(v => v.label), ['Kiri', 'Kanan']);
  assert.strictEqual(toCartCatalog([{ ...PRODUCTS[2], bisaSepasang: false }])[0].side.sepasang, false);
});

check('U-5 reconcile: ok lines take current name, price, stock, photo; Sepasang = Kiri + Kanan, stock = min', () => {
  let s = add(add(add(C.emptyCart(), simple()).state, variant()).state, pair({ quantity: 2 })).state;
  const v = Object.fromEntries(C.reconcileCart(s, CATALOG).map(x => [x.key, x]));
  const p = v[C.lineKey(pair())];
  assert.deepStrictEqual([p.status, p.unitPrice, p.stock, p.optionLabel, p.priceWas, p.quantity], ['ok', 300000, 3, 'Sepasang (kiri + kanan)', null, 2]);
  const t = v[C.lineKey(variant())];
  assert.deepStrictEqual([t.status, t.image, t.stock], ['ok', 'https://example.test/hitam.jpg', 3]);
  assert.strictEqual(v[C.lineKey(simple())].stock, 5);
});

check('U-5 reconcile: missing product, inactive variant, Sepasang switched off, structure change are unavailable', () => {
  let s = C.emptyCart();
  s = add(s, simple({ productSlug: 'hilang-contoh', name: 'Produk hilang (contoh)' })).state;
  s = add(s, variant({ variationId: 'v-abu', optionLabel: 'Abu' })).state;
  s = add(s, variant({ variationId: 'v-tidak-ada' })).state;
  s = add(s, pair()).state;
  s = add(s, simple({ productSlug: 'tank-bag-contoh' })).state; // simple line of a variable product
  const offCatalog = toCartCatalog([PRODUCTS[0], PRODUCTS[1], { ...PRODUCTS[2], bisaSepasang: false }]);
  const views = C.reconcileCart(s, offCatalog);
  assert.ok(views.every(x => x.status === 'unavailable'), views.map(x => x.status).join());
  assert.strictEqual(views.find(x => x.line.productSlug === 'hilang-contoh').name, 'Produk hilang (contoh)', 'keeps the snapshot name');
  const kananOff = toCartCatalog([{ ...PRODUCTS[2], variants: PRODUCTS[2].variants.map(x => (x.variationId === 'v-kanan' ? { ...x, isActive: false } : x)) }]);
  assert.strictEqual(C.reconcileCart(add(C.emptyCart(), pair()).state, kananOff)[0].status, 'unavailable');
});

check('U-5 reconcile: stock 0 is sold out, quantity above stock is lowered, price change is reported', () => {
  let s = add(C.emptyCart(), simple({ quantity: 5, unitPrice: 480000 })).state;
  s = add(s, variant({ quantity: 3 })).state;
  const cat = toCartCatalog([{ ...PRODUCTS[0], stock: 2 }, { ...PRODUCTS[1], variants: PRODUCTS[1].variants.map(x => ({ ...x, stock: 0 })) }]);
  const views = Object.fromEntries(C.reconcileCart(s, cat).map(x => [x.key, x]));
  const t = views[C.lineKey(simple())];
  assert.deepStrictEqual([t.status, t.quantity, t.clamped, t.priceWas, t.unitPrice], ['ok', 2, true, 480000, 520000]);
  assert.strictEqual(views[C.lineKey(variant())].status, 'soldout');
  const persisted = C.applyReconcile(s, Object.values(views));
  const line = persisted.lines.find(l => l.productSlug === 'tail-bag-contoh');
  assert.deepStrictEqual([line.quantity, line.unitPrice], [2, 520000]);
  assert.strictEqual(C.reconcileCart(persisted, cat).find(x => x.line.productSlug === 'tail-bag-contoh').priceWas, null, 'note shown once');
  assert.strictEqual(C.applyReconcile(persisted, C.reconcileCart(persisted, cat)), persisted, 'nothing new: same state');
});

check('U-5 reconcile: catalog unavailable (null) keeps snapshot lines orderable', () => {
  const s = add(C.emptyCart(), simple()).state;
  const [v] = C.reconcileCart(s, null);
  assert.deepStrictEqual([v.status, v.unitPrice, v.stock], ['ok', 520000, null]);
  assert.strictEqual(C.applyReconcile(s, [v]), s);
});

check('U-5 shared stock (review REV-07): Kiri + Sepasang above Kiri stock are flagged; unselecting one clears it', () => {
  const cat = toCartCatalog([{ ...PRODUCTS[2], variants: PRODUCTS[2].variants.map(x => (x.variationId === 'v-kiri' ? { ...x, stock: 3 } : { ...x, stock: 5 })) }]);
  let s = add(C.emptyCart(), { ...pair(), quantity: 2, stock: 3 }).state;
  s = add(s, { ...pair(), pair: null, variationId: 'v-kiri', optionLabel: 'Kiri', quantity: 3, stock: 3 }).state;
  let views = C.reconcileCart(s, cat);
  assert.ok(views.every(v => v.status === 'ok' && v.sharedOver === 3), JSON.stringify(views.map(v => [v.key, v.sharedOver])));
  assert.strictEqual(C.hasSharedConflict(views), true);
  s = C.setLineQuantity(s, C.lineKey({ productSlug: 'side-bag-contoh', variationId: 'v-kiri', pair: null }), 1, 3);
  assert.strictEqual(C.hasSharedConflict(C.reconcileCart(s, cat)), false, '2 pairs + 1 Kiri = 3 Kiri');
  s = C.setLineQuantity(s, C.lineKey({ productSlug: 'side-bag-contoh', variationId: 'v-kiri', pair: null }), 3, 3);
  s = C.setSelected(s, [C.lineKey(pair())], false);
  assert.strictEqual(C.hasSharedConflict(C.reconcileCart(s, cat)), false, 'an unselected line does not count');
  assert.strictEqual(C.hasSharedConflict(C.reconcileCart(s, null)), false, 'unknown catalog: no flag');
});

check('U-6 totals and badge: only selected orderable lines count; badge = products (lines), "99+" above 99', () => {
  let s = add(add(add(C.emptyCart(), simple({ quantity: 2 })).state, variant()).state, pair({ quantity: 2 })).state;
  s = C.setSelected(s, [C.lineKey(variant())], false);
  const views = C.reconcileCart(s, CATALOG);
  assert.deepStrictEqual(C.cartTotals(views), { lines: 2, quantity: 4, subtotal: 2 * 520000 + 2 * 300000 });
  const sold = C.reconcileCart(s, toCartCatalog([{ ...PRODUCTS[0], stock: 0 }, PRODUCTS[1], PRODUCTS[2]]));
  assert.deepStrictEqual(C.cartTotals(sold), { lines: 1, quantity: 2, subtotal: 600000 });
  assert.strictEqual(C.badgeCount(s), 3);
  assert.strictEqual(C.badgeText(5), '5');
  assert.strictEqual(C.badgeText(100), '99+');
  assert.strictEqual(C.badgeCount(C.emptyCart()), 0);
});

check('order items: Sepasang = Kiri + Kanan of n; same product and variant merged; pair WhatsApp lines', () => {
  let s = add(add(C.emptyCart(), pair({ quantity: 2 })).state, { ...pair(), pair: null, variationId: 'v-kiri', optionLabel: 'Kiri', quantity: 1 }).state;
  s = add(s, simple()).state;
  const lines = C.checkoutLines(C.reconcileCart(s, CATALOG));
  assert.deepStrictEqual(C.cartToOrderItems(lines), [
    { productSlug: 'tail-bag-contoh', variationId: null, quantity: 1 },
    { productSlug: 'side-bag-contoh', variationId: 'v-kiri', quantity: 3 },
    { productSlug: 'side-bag-contoh', variationId: 'v-kanan', quantity: 2 },
  ]);
  assert.strictEqual(C.pairLines(lines), 'Side bag (contoh): Sepasang (kiri + kanan), 2 pasang');
  assert.strictEqual(C.pairLines(lines.filter(l => !l.pair)), undefined);
});

// Mocked POST /api/orders echoing what the real route answers (server prices) so the WhatsApp text can be read back.
function orderFetch(calls, answer) {
  return async (url, init) => {
    calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    const a = answer(JSON.parse(init.body));
    return { ok: a.status < 400, status: a.status, json: async () => a.body };
  };
}

check('U-7 checkout hand-off: body for POST /api/orders, voucher + affiliateId + UTM + buyer, WhatsApp text has every item', async () => {
  let s = add(add(C.emptyCart(), simple({ quantity: 2 })).state, pair()).state;
  const lines = C.checkoutLines(C.reconcileCart(s, CATALOG));
  const voucher = { code: 'INZ-CONTOH', type: 'percentage', value: 10, minPurchase: 0, maxDiscount: 0, affiliateId: 'aff-contoh', affiliateName: null, isActive: true, usageCount: 0, maxUsage: null, expiresAt: null, createdAt: null };
  const utm = { source: 'instagram', medium: 'social' };
  const calls = [];
  const r = await checkoutCart({ lines, voucher, buyerUID: null, utm }, orderFetch(calls, () => ({
    status: 201,
    body: {
      orderId: 'ORD-CONTOH',
      items: [
        { productName: 'Tail bag (contoh)', selectedVariantLabel: null, sku: null, quantity: 2, price: 520000, subtotal: 1040000 },
        { productName: 'Side bag (contoh)', selectedVariantLabel: 'Kiri', sku: 'K', quantity: 1, price: 150000, subtotal: 150000 },
        { productName: 'Side bag (contoh)', selectedVariantLabel: 'Kanan', sku: 'N', quantity: 1, price: 150000, subtotal: 150000 },
      ],
      totalPrice: 1340000, discountAmount: 134000, voucherCode: 'INZ-CONTOH', finalPrice: 1206000,
    },
  })));
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, '/api/orders');
  assert.deepStrictEqual(calls[0].body, {
    items: [
      { productSlug: 'side-bag-contoh', variationId: 'v-kiri', quantity: 1 },
      { productSlug: 'side-bag-contoh', variationId: 'v-kanan', quantity: 1 },
      { productSlug: 'tail-bag-contoh', variationId: null, quantity: 2 },
    ],
    voucherCode: 'INZ-CONTOH', affiliateId: 'aff-contoh', buyerUID: null, utm,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.orderId, 'ORD-CONTOH');
  assert.strictEqual(r.value, 1206000);
  assert.ok(r.href.startsWith('https://wa.me/'));
  const text = decodeURIComponent(r.href.split('?text=')[1]);
  for (const part of ['Order ID: #ORD-CONTOH', 'Side bag (contoh): Sepasang (kiri + kanan), 1 pasang', 'Tail bag (contoh)', 'Side bag (contoh) — Kiri', 'Side bag (contoh) — Kanan', 'Voucher: INZ-CONTOH', 'Total Bayar']) {
    assert.ok(text.includes(part), `WhatsApp text misses "${part}"`);
  }
});

check('U-7 checkout hand-off: server errors pass through; no lines never calls the server', async () => {
  const lines = C.checkoutLines(C.reconcileCart(add(C.emptyCart(), simple()).state, CATALOG));
  const calls = [];
  const r = await checkoutCart({ lines, voucher: null, buyerUID: 'uid-contoh', utm: null }, orderFetch(calls, () => ({ status: 400, body: { code: 'INSUFFICIENT_STOCK', message: 'Stok produk "Tail bag (contoh)" tidak mencukupi' } })));
  assert.deepStrictEqual(r, { ok: false, message: 'Gagal membuat pesanan: Stok produk "Tail bag (contoh)" tidak mencukupi' });
  assert.strictEqual(calls[0].body.buyerUID, 'uid-contoh');
  assert.strictEqual(calls[0].body.voucherCode, null);
  const none = [];
  const empty = await checkoutCart({ lines: [], voucher: null, buyerUID: null, utm: null }, orderFetch(none, () => ({ status: 201, body: {} })));
  assert.strictEqual(empty.ok, false);
  assert.strictEqual(none.length, 0);
});

check('U-8 existing order and voucher code is unchanged against origin/staging', () => {
  let base;
  try {
    base = execSync('git merge-base HEAD origin/staging', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    console.log('INFO  U-8 skipped: no git history or origin/staging in this checkout');
    return;
  }
  const files = ['components/v2/product/useOrder.ts', 'components/v2/product/order-core.ts', 'app/api/orders/route.ts', 'lib/utils.ts', 'app/api/vouchers'];
  const diff = execSync(`git diff ${base} -- ${files.join(' ')}`, { cwd: ROOT }).toString();
  assert.strictEqual(diff, '', 'order/voucher files changed:\n' + diff.slice(0, 400));
});

Promise.all(pending).then(() => {
  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(r => r[0] === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
