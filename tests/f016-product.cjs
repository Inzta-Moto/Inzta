// F-016 tasks B3/B4: product page v2 and side picker. Requirements S3.1-S3.10, S4.1-S4.6. Pure helpers, the order and
// voucher flow with a mocked fetch (no request leaves the process: global fetch throws), a comparison with the
// DetailClient.tsx payload on every fixture product, server-rendered markup of the page components, the admin side
// preset rules, and the admin order transactions against an in-memory Firestore (S4.3.6).
// Usage: npm run test:product  (or: node tests/f016-product.cjs <repo-root> [--fixture <public fixture json>])
const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');
const assert = require('assert');

const args = process.argv.slice(2);
const ROOT = path.resolve(args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--fixture') || path.join(__dirname, '..'));
const FIXTURE_ARG = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const ts = require(path.join(ROOT, 'node_modules/typescript'));

// No network in this suite: every order, voucher, or other request must go through an injected mock.
global.fetch = async (url) => { throw new Error(`real fetch called: ${url}`); };

// In-memory Firestore with transactions (reads first, writes applied at commit), enough for the admin order route.
const docs = new Map();
const revalidated = [];
const inc = n => ({ __inc: n });
function applyUpdate(key, value) {
  const cur = { ...(docs.get(key) || {}) };
  for (const [k, v] of Object.entries(value)) cur[k] = v && v.__inc !== undefined ? (cur[k] ?? 0) + v.__inc : v;
  docs.set(key, cur);
}
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    key, id,
    get: async () => ({ exists: docs.has(key), id, data: () => docs.get(key) }),
    update: async (v) => applyUpdate(key, v),
    set: async (v) => docs.set(key, v),
    delete: async () => docs.delete(key),
  };
}
const fakeDb = {
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
  }),
  batch: () => { const ops = []; return { delete: r => ops.push(() => docs.delete(r.key)), commit: async () => ops.forEach(f => f()) }; },
  runTransaction: async (fn) => {
    const writes = [];
    const tx = {
      get: async (ref) => {
        if (writes.length) throw new Error('read after write in transaction');
        return ref.get();
      },
      update: (ref, v) => writes.push(() => applyUpdate(ref.key, v)),
      set: (ref, v) => writes.push(() => docs.set(ref.key, v)),
      delete: (ref) => writes.push(() => docs.delete(ref.key)),
    };
    const r = await fn(tx);
    tx.writes = writes.length;
    writes.forEach(w => w());
    fakeDb.lastWrites = writes.length;
    return r;
  },
};

const Link = ({ href, children, ...rest }) => require('react').createElement('a', { href, ...rest }, children);
const NextImage = ({ src, alt, width, height, sizes }) => require('react').createElement('img', { src, alt, width, height, sizes });
const realReact = require(path.join(ROOT, 'node_modules/react'));
const stubs = {
  // React 18.3 has no cache() outside the server build; one read per call is enough here.
  react: Object.assign({}, realReact, { cache: (fn) => fn }),
  'next/link': { __esModule: true, default: Link },
  'next/image': { __esModule: true, default: NextImage },
  'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND'); } },
  'next/cache': { revalidatePath: (p, t) => revalidated.push(t ? `${p} ${t}` : p), revalidateTag: () => {} },
  'firebase-admin': { firestore: { FieldValue: { increment: inc, serverTimestamp: () => 'serverTimestamp' } } },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => ({}), hasAdminCredentials: () => true },
  [path.join(ROOT, 'lib/auth')]: { verifyAdminSession: async () => ({ uid: 'u-admin' }) },
  [path.join(ROOT, 'components/v2/fonts')]: { fontDisplay: { variable: 'fd' }, fontSans: { variable: 'fs' } },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  if (stubs[request]) return request;
  if (request.endsWith('.css')) return request;
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  let resolved = request.startsWith('@/') ? path.join(ROOT, request.slice(2)) : request;
  if (resolved.startsWith('.') && parent) resolved = path.resolve(path.dirname(parent.filename), resolved);
  if (stubs[resolved]) return stubs[resolved];
  if (resolved.endsWith('.css')) return {};
  return origLoad.call(this, request, parent, isMain);
};
const compile = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  m._compile(out.outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const V = require(path.join(ROOT, 'components/v2/product/product-view.ts'));
const O = require(path.join(ROOT, 'components/v2/product/order-core.ts'));
const S = require(path.join(ROOT, 'components/v2/product/side.ts'));
const U = require(path.join(ROOT, 'lib/utils.ts'));
const PU = require(path.join(ROOT, 'lib/product-utils.ts'));
const F2 = require(path.join(ROOT, 'app/admin/(panel)/produk/_v2/form-v2.ts'));

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + (e && e.message)]); }
}
const skip = (name, why) => results.push(['SKIP', `${name} (${why})`]);

// Fixture products: the public fixture when given (all 32 products), else a small built-in set.
const variant = (id, attrs, extra = {}) => ({ variationId: id, sku: id, attributes: attrs, price: 150000, compareAtPrice: 175000, stock: 5, images: [], isActive: true, ...extra });
const BUILTIN = [
  { slug: 'tail-bag-inzta-tourmax-30', name: 'Tail bag Inzta Tourmax 30', productType: 'simple', price: 520000, compareAtPrice: 590000, stock: 7, images: ['a.png', 'b.jpg'], features: [], badge: 'BEST SELLER', isActive: true, description: 'x' },
  { slug: 'tankbag-tk-5', name: 'Tankbag TK 5', productType: 'simple', price: 400000, compareAtPrice: null, stock: 0, images: [], features: [], badge: 'NEW', isActive: true, description: '' },
  { slug: 'side-bag-inzta-universal-motor', name: 'Side bag inzta universal motor', productType: 'variable', priceFrom: 140000, priceTo: 270000, images: ['m.png'], features: ['1 pcs bisa kiri dan kanan'], badge: 'BEST SELLER', isActive: true, description: '',
    attributes: [{ id: 'a', name: 'Depan', values: ['Kiri', 'Kanan', 'Kiri - Kanan'] }],
    variants: [variant('v1', { Depan: 'Kiri' }, { price: 140000, compareAtPrice: 170000, images: ['k.jpg'] }), variant('v2', { Depan: 'Kanan' }, { price: 140000, images: ['n.jpg'] }), variant('v3', { Depan: 'Kiri - Kanan' }, { price: 270000, compareAtPrice: 380000 }), variant('v4', { Depan: 'Sepasang Kiri' }, { price: 0, stock: 0, isActive: false, images: ['old.jpg'] })] },
];
const fixturePath = FIXTURE_ARG || (process.env.F016_FIXTURE && fs.existsSync(process.env.F016_FIXTURE) ? process.env.F016_FIXTURE : null);
const RAW = fixturePath ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')).products : BUILTIN;
const PRODUCTS = RAW.map(p => ({ ...PU.normalizeProduct(p.slug, p), slug: p.slug }));
const bySlug = s => PRODUCTS.find(p => p.slug === s);
const sideProduct = (extra = {}, kiri = {}, kanan = {}) => ({
  productType: 'variable', slug: 'demo-side', name: 'Side bag Inzta XSR 155', isActive: true, images: ['p1.jpg'], features: [], description: '',
  attributes: [{ id: 'a1', name: 'Sisi', values: ['Kiri', 'Kanan'] }],
  variants: [variant('v-kiri', { Sisi: 'Kiri' }, { images: ['kiri.jpg'], ...kiri }), variant('v-kanan', { Sisi: 'Kanan' }, kanan)],
  priceFrom: 150000, priceTo: 150000, ...extra,
});

// DetailClient.tsx (origin/main @ 649ae3d) rules copied verbatim in shape, for the comparison (B3 "Done when").
function oldDetailClient(product, selectedAttributes, quantity, voucherData, buyerUID) {
  const selectedVariant = product.productType !== 'variable' ? null : PU.matchVariant(product.variants, selectedAttributes, product.attributes);
  const resolvedPrice = product.productType === 'simple' ? product.price : selectedVariant?.price ?? product.priceFrom ?? 0;
  const resolvedStock = product.productType === 'simple' ? product.stock : selectedVariant ? selectedVariant.stock ?? 0 : product.stock ?? 0;
  const selectionComplete = product.productType !== 'variable' ? true : PU.isSelectionComplete(product.attributes, selectedAttributes);
  const variantExists = product.productType !== 'variable' || !selectionComplete || selectedVariant !== null;
  const isVariable = product.productType === 'variable';
  const canOrder = selectionComplete && (isVariable ? variantExists && resolvedStock > 0 : resolvedStock > 0);
  const maxQuantity = selectionComplete && (!isVariable || variantExists) ? resolvedStock : 0;
  const body = { items: [{ productSlug: product.slug, variationId: selectedVariant?.variationId ?? null, quantity }], voucherCode: voucherData?.code ?? null, affiliateId: voucherData?.affiliateId ?? null, buyerUID, utm: null }; // F-002: DetailClient adds the first-touch UTM (null without one)
  return { resolvedPrice, canOrder, maxQuantity, body };
}
const oldRecalc = (v, base) => { let d = v.type === 'percentage' ? (base * v.value) / 100 : v.value; if (v.type === 'percentage' && v.maxDiscount && d > v.maxDiscount) d = v.maxDiscount; return Math.round(Math.min(d, base)); };
// lib/utils.ts buildWaLink before the S4.3.4 parameter.
function oldBuildWaLink(orderId, items, totals) {
  const fp = n => 'Rp ' + n.toLocaleString('id-ID');
  let msg = `PESANAN PRODUK\nOrder ID: #${orderId}\n\n`;
  for (const item of items) {
    msg += `${item.productName}`;
    if (item.selectedVariantLabel) msg += ` — ${item.selectedVariantLabel}`;
    if (item.sku) msg += ` (SKU: ${item.sku})`;
    msg += `\n`;
    msg += `Jumlah: ${item.quantity} × ${fp(item.price)} = ${fp(item.subtotal)}\n\n`;
  }
  if (totals.discountAmount > 0) {
    msg += `Subtotal: ${fp(totals.totalPrice)}\n`;
    if (totals.voucherCode) msg += `Voucher: ${totals.voucherCode}\n`;
    msg += `Diskon: -${fp(totals.discountAmount)}\n`;
  }
  msg += `Total Bayar: ${fp(totals.finalPrice)}\n\n`;
  msg += `Data Pemesan:\nNama: \nNo. HP: \nAlamat: \n\nTerima kasih!`;
  return `https://wa.me/${require(path.join(ROOT, 'lib/constants.ts')).WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// Mock fetch: records every call and answers from a table; anything unknown fails the test.
function mockFetch(table) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    const key = Object.keys(table).find(k => url.startsWith(k));
    if (!key) throw new Error(`unexpected request ${url}`);
    const a = table[key];
    if (a === 'network') throw new TypeError('Failed to fetch');
    return { ok: a.status >= 200 && a.status < 300, status: a.status, json: async () => a.body };
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  // S3.10 product read
  await check('S3.10.1/S3.10.2/S3.10.3: getProduct reads the fixture by slug, null for an unknown slug, throws on a read error', async () => {
    const tmp = path.join(os.tmpdir(), `f016-product-${process.pid}.json`);
    fs.writeFileSync(tmp, JSON.stringify({ products: BUILTIN, articles: [] }));
    const env = { ...process.env };
    process.env.NODE_ENV = 'development';
    process.env.F016_FIXTURE = tmp;
    try {
      const R = require(path.join(ROOT, 'lib/v2/product-read.ts'));
      assert.strictEqual((await R.getProduct('tail-bag-inzta-tourmax-30')).name, 'Tail bag Inzta Tourmax 30');
      assert.strictEqual(await R.getProduct('tidak-ada'), null);
      process.env.F016_STATE = 'error';
      await assert.rejects(() => R.getProduct('tail-bag-inzta-tourmax-30'), /forced error/);
    } finally {
      for (const k of ['NODE_ENV', 'F016_FIXTURE', 'F016_STATE']) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
      fs.unlinkSync(tmp);
    }
  });
  await check('S3.10.2/S3.10.3: the page calls notFound() for null and has no try/catch around the product read; ISR 3600, no prebuilt slugs', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/produk/[slug]/page.tsx'), 'utf8');
    assert.match(src, /export const revalidate = 3600;/);
    assert.match(src, /generateStaticParams\(\) \{\s*return \[\];/);
    assert.match(src, /if \(!product\) notFound\(\);/);
    assert.ok(!/export const dynamic/.test(src));
    const body = src.slice(src.indexOf('export default async function DetailPage'));
    assert.ok(!/try\s*\{/.test(body), 'no try/catch in the page body');
    assert.match(src, /generateMetadata/);
  });

  // S3.1-S3.8 helpers
  await check('S3.1: breadcrumb position = first position with /produk?posisi=<key>; none -> no step', () => {
    assert.deepStrictEqual(V.crumbPosition({ slug: 'x', name: 'Tail bag Inzta Tourmax 30' }), { label: 'Tail bag', href: '/produk?posisi=tail' });
    assert.deepStrictEqual(V.crumbPosition({ slug: 'tankbag-and-tailbag-wanderpack-10l', name: 'Tankbag and Tailbag Wanderpack 10L' }), { label: 'Tank bag', href: '/produk?posisi=tank' });
    assert.strictEqual(V.crumbPosition({ slug: 'y', name: 'Costum image' }), null);
  });
  await check('S3.2: gallery = product images, then images of active variants, deduplicated; side products skip variant images', () => {
    const p = { ...BUILTIN[2], images: ['m.png', 'k.jpg'] };
    assert.deepStrictEqual(V.galleryImages(p), ['m.png', 'k.jpg', 'n.jpg']);
    assert.deepStrictEqual(V.galleryImages({ productType: 'simple', images: [], imageUrl: 'only.png' }), ['only.png']);
    assert.deepStrictEqual(V.galleryImages(sideProduct(), false), ['p1.jpg']);
  });
  await check('S3.5: "Label: nilai" splits on the first colon; other entries keep an empty label; blanks dropped', () => {
    assert.deepStrictEqual(V.specRows(['Kapasitas: 30 liter', 'Ukuran: 37 x 28: 23', 'XSR', ' ', 'Kosong:']), [
      { label: 'Kapasitas', value: '30 liter' }, { label: 'Ukuran', value: '37 x 28: 23' }, { label: '', value: 'XSR' }, { label: '', value: 'Kosong:' },
    ]);
    assert.deepStrictEqual(V.specRows(undefined), []);
  });
  await check('S3.6: description as plain text paragraphs; single line breaks stay in the paragraph; no HTML parsing', () => {
    assert.deepStrictEqual(V.descriptionParagraphs('A\nB\n\n<b>C</b>\r\n\r\n\n'), [['A', 'B'], ['<b>C</b>']]);
    assert.deepStrictEqual(V.descriptionParagraphs(''), []);
  });
  await check('S3.7: Q1 tail-bag answer vs generic; Q2 prefixed only with a "Bahan luar" row; Q3 placeholder', () => {
    const tail = V.faqItems({ slug: 't', name: 'Tail bag X' }, []);
    assert.strictEqual(tail[0].a, 'Kirim foto jok belakang motor Anda ke admin. Kami cek ukurannya sebelum Anda memesan.');
    const side = V.faqItems({ slug: 's', name: 'Side bag X' }, [{ label: 'Bahan luar', value: 'Cordura D600' }]);
    assert.strictEqual(side[0].a, 'Kirim foto motor Anda ke admin. Kami cek ukurannya sebelum Anda memesan.');
    assert.strictEqual(side[1].a, 'Bahan luarnya Cordura D600. Untuk perjalanan hujan, tanyakan ke admin cara menyimpan barang elektronik.');
    assert.strictEqual(tail[1].a, 'Untuk perjalanan hujan, tanyakan ke admin cara menyimpan barang elektronik.');
    assert.deepStrictEqual(tail.map(f => f.q), ['Apakah bisa dipasang di motor saya?', 'Apakah tahan hujan?', 'Berapa lama pengiriman?']);
    assert.strictEqual(tail[2].a, 'Tanyakan perkiraan waktu kirim ke admin INZTA di WhatsApp. Admin juga mengonfirmasi ongkir ke kota Anda.');
  });
  await check('S3.8: related = other positions (no position counts as different), best sellers first, newest next, max 4, never itself', () => {
    const mk = (slug, name, badge, createdAt) => ({ slug, name, badge, createdAt, productType: 'simple', isActive: true, images: [] });
    const me = mk('me', 'Tail bag A', null, 5);
    const all = [me, mk('t2', 'Tail bag B', 'BEST SELLER', 9), mk('k1', 'Tankbag K', null, 8), mk('k2', 'Tankbag L', 'BEST SELLER', 1), mk('x', 'Costum', null, 7), mk('s1', 'Side bag S', null, 6), mk('s2', 'Side bag T', null, 4)];
    assert.deepStrictEqual(V.selectRelated(me, all).map(p => p.slug), ['k2', 'k1', 'x', 's1']);
    assert.deepStrictEqual(V.selectRelated(me, [me]), []);
  });
  await check('S3.10.4: JSON-LD of a variable product uses priceFrom and InStock from active variants; simple unchanged; "<" escaped; no rating', () => {
    const ld = V.productJsonLd(BUILTIN[2], 'https://inzta.id');
    assert.strictEqual(ld.offers.price, 140000);
    assert.strictEqual(ld.offers.availability, 'https://schema.org/InStock');
    const sold = V.productJsonLd({ ...BUILTIN[2], variants: BUILTIN[2].variants.map(v => ({ ...v, stock: 0 })) }, 'https://inzta.id');
    assert.strictEqual(sold.offers.availability, 'https://schema.org/OutOfStock');
    const simple = V.productJsonLd(BUILTIN[0], 'https://inzta.id');
    assert.deepStrictEqual([simple.offers.price, simple.offers.availability, simple.sku, simple.brand.name], [520000, 'https://schema.org/InStock', 'tail-bag-inzta-tourmax-30', 'INZTA Moto']);
    // REV-04: the page serializes through F-005 serializeJsonLd (components/JsonLd.tsx).
    const s = require(path.join(ROOT, 'lib/seo.ts')).serializeJsonLd(V.productJsonLd({ ...BUILTIN[0], name: '</script><script>x' }, 'https://inzta.id'));
    assert.ok(!s.includes('<') && !s.includes('>') && s.includes('\\u003c/script\\u003e'));
    assert.ok(!/aggregateRating|review/i.test(JSON.stringify(ld)));
  });
  await check('S3.3.8: plain WhatsApp link text and sold-out-at-render rule', () => {
    assert.match(V.plainOrderHref('Tail bag Inzta Tourmax 30'), /^https:\/\/wa\.me\/\d+\?text=Halo%20INZTA%2C%20saya%20ingin%20pesan%20Tail%20bag%20Inzta%20Tourmax%2030$/);
    assert.strictEqual(V.soldOutAtRender(BUILTIN[1]), true);
    assert.strictEqual(V.soldOutAtRender(BUILTIN[0]), false);
    assert.strictEqual(V.soldOutAtRender({ ...BUILTIN[2], variants: BUILTIN[2].variants.map(v => ({ ...v, stock: 0 })) }), true);
  });

  // Order flow: comparison with DetailClient on fixture products (B3 "Done when")
  await check(`E2/S3.3.5: payload, unit price, can-order, and max quantity equal DetailClient on every fixture product and selection (${PRODUCTS.length} products${fixturePath ? ', public fixture' : ', built-in set'})`, () => {
    let compared = 0;
    const voucher = { code: 'AFF1', affiliateId: 'aff-1' };
    for (const p of PRODUCTS) {
      const selections = [{}];
      if (p.productType === 'variable') for (const a of p.attributes || []) for (const v of a.values) selections.push({ [a.name]: v });
      for (const sel of selections) {
        for (const q of [1, 2]) {
          for (const vd of [null, voucher]) {
            const old = oldDetailClient(p, sel, q, vd, vd ? 'uid-1' : null);
            const g = O.genericState(p, sel);
            const body = O.buildOrderBody([{ productSlug: p.slug, variationId: g.selected?.variationId ?? null, quantity: q }], vd, vd ? 'uid-1' : null);
            assert.deepStrictEqual(body, old.body, `${p.slug} ${JSON.stringify(sel)}`);
            assert.strictEqual(g.unitPrice, old.resolvedPrice, `${p.slug} price`);
            assert.strictEqual(g.canOrder, old.canOrder, `${p.slug} canOrder`);
            assert.strictEqual(g.maxQuantity, old.maxQuantity, `${p.slug} max`);
            compared++;
          }
        }
      }
    }
    assert.ok(compared >= PRODUCTS.length * 4);
  });
  await check('S3.3.1: voucher discount equals DetailClient recalcDiscount (fixed, percentage, capped, above subtotal)', () => {
    for (const v of [{ type: 'fixed', value: 20000 }, { type: 'percentage', value: 10, maxDiscount: 0 }, { type: 'percentage', value: 50, maxDiscount: 30000 }, { type: 'fixed', value: 999999 }])
      for (const base of [0, 100000, 520000]) assert.strictEqual(O.voucherDiscount(v, base), oldRecalc(v, base));
  });
  await check('S3.3.1: checkVoucher uppercases and URL-encodes the code; API error text; fallback text; network text; min purchase', async () => {
    const ok = mockFetch({ '/api/vouchers/validate': { status: 200, body: { voucher: { code: 'A B', type: 'percentage', value: 10, maxDiscount: 5000, minPurchase: 0 } } } });
    const r = await O.checkVoucher(' a b ', 100000, ok);
    assert.deepStrictEqual([ok.calls[0].url, r.ok, r.discount], ['/api/vouchers/validate?code=A%20B', true, 5000]);
    assert.deepStrictEqual(await O.checkVoucher('X', 1, mockFetch({ '/api/vouchers/validate': { status: 400, body: { error: 'Voucher sudah mencapai batas' } } })), { ok: false, message: 'Voucher sudah mencapai batas' });
    assert.deepStrictEqual(await O.checkVoucher('X', 1, mockFetch({ '/api/vouchers/validate': { status: 404, body: {} } })), { ok: false, message: 'Voucher tidak ditemukan.' });
    assert.deepStrictEqual(await O.checkVoucher('X', 1, mockFetch({ '/api/vouchers/validate': 'network' })), { ok: false, message: 'Gagal memvalidasi voucher.' });
    const min = mockFetch({ '/api/vouchers/validate': { status: 200, body: { voucher: { code: 'M', type: 'fixed', value: 1, minPurchase: 500000 } } } });
    assert.deepStrictEqual(await O.checkVoucher('M', 300000, min), { ok: false, message: 'Minimal pembelian Rp500.000 tidak terpenuhi.' });
  });
  await check('S3.3.1: affiliate auto-apply keeps the resolve request; every failure is silent (null)', async () => {
    const f = mockFetch({ '/api/vouchers/resolve': { status: 200, body: { voucher: { code: 'AFF', type: 'fixed', value: 20000, minPurchase: 0, affiliateId: 'aff-1' } } } });
    const r = await O.resolveAffiliateVoucher('aff-1', 100000, f);
    assert.deepStrictEqual([f.calls[0].url, r.voucher.code, r.discount], ['/api/vouchers/resolve?affiliateId=aff-1', 'AFF', 20000]);
    assert.strictEqual(await O.resolveAffiliateVoucher('x', 1, mockFetch({ '/api/vouchers/resolve': { status: 404, body: { error: 'Affiliate not found' } } })), null);
    assert.strictEqual(await O.resolveAffiliateVoucher('x', 1, mockFetch({ '/api/vouchers/resolve': 'network' })), null);
    assert.strictEqual(await O.resolveAffiliateVoucher('x', 1, mockFetch({ '/api/vouchers/resolve': { status: 200, body: { voucher: { code: 'A', type: 'fixed', value: 1, minPurchase: 9e9 } } } })), null);
  });
  await check('S3.3.1: released below minPurchase with the canvas text; otherwise recomputed', () => {
    assert.deepStrictEqual(O.recalcVoucher({ type: 'fixed', value: 1000, minPurchase: 500000 }, 300000), { released: true, message: 'Voucher dilepas. Minimal pembelian Rp500.000.' });
    assert.deepStrictEqual(O.recalcVoucher({ type: 'percentage', value: 10, maxDiscount: 0, minPurchase: 0 }, 300000), { released: false, discount: 30000 });
  });
  await check('S3.3.5/S3.3.6: submitOrder POSTs the same body to the mock and builds the WhatsApp link from the response (= old buildWaLink)', async () => {
    const resp = { orderId: 'ORD-ABC123', items: [{ productName: 'Tail bag', selectedVariantLabel: null, sku: null, quantity: 2, price: 520000, subtotal: 1040000 }], totalPrice: 1040000, discountAmount: 20000, voucherCode: 'AFF', finalPrice: 1020000 };
    const f = mockFetch({ '/api/orders': { status: 201, body: resp } });
    const body = O.buildOrderBody([{ productSlug: 'tail-bag-inzta-tourmax-30', variationId: null, quantity: 2 }], { code: 'AFF', affiliateId: 'aff-1' }, null);
    const r = await O.submitOrder(body, f);
    assert.deepStrictEqual([f.calls.length, f.calls[0].method, f.calls[0].body], [1, 'POST', body]);
    assert.strictEqual(r.href, oldBuildWaLink(resp.orderId, resp.items, resp));
  });
  await check('S3.3.5/S4.3.5: errors read "Gagal membuat pesanan: <message | error>" (API message, API error, network)', async () => {
    const b = O.buildOrderBody([], null, null);
    assert.deepStrictEqual(await O.submitOrder(b, mockFetch({ '/api/orders': { status: 400, body: { code: 'INSUFFICIENT_STOCK', message: 'Stok variasi tidak mencukupi' } } })), { ok: false, message: 'Gagal membuat pesanan: Stok variasi tidak mencukupi' });
    assert.deepStrictEqual(await O.submitOrder(b, mockFetch({ '/api/orders': { status: 400, body: { error: 'Gagal menggunakan voucher: Voucher kadaluarsa' } } })), { ok: false, message: 'Gagal membuat pesanan: Gagal menggunakan voucher: Voucher kadaluarsa' });
    assert.deepStrictEqual(await O.submitOrder(b, mockFetch({ '/api/orders': 'network' })), { ok: false, message: 'Gagal membuat pesanan: Failed to fetch' });
  });
  await check('S3.3.2/S3.3.3: generic button states and the price row (incomplete: priceFrom + highest compare, no Hemat)', () => {
    const v = bySlug('side-bag-inzta-universal-motor') || PU.normalizeProduct('x', BUILTIN[2]);
    const none = O.genericState(v, {});
    assert.deepStrictEqual([O.genericButton(none, false), none.unitPrice, none.compareAt, none.showSaving], ['incomplete', 140000, 380000, false]);
    const kiri = O.genericState(v, { Depan: 'Kiri' });
    assert.deepStrictEqual([O.genericButton(kiri, false), kiri.unitPrice, kiri.compareAt, kiri.showSaving], ['ready', 140000, 170000, true]);
    assert.strictEqual(O.genericButton(O.genericState(v, { Depan: 'Sepasang Kiri' }), false), 'missing');
    assert.strictEqual(O.genericButton(O.genericState(PU.normalizeProduct('t', BUILTIN[1]), {}), false), 'soldout');
    assert.strictEqual(O.genericButton(kiri, true), 'processing');
    assert.deepStrictEqual(O.BUTTON_TEXT, { ready: 'Pesan via WhatsApp', processing: 'Memproses...', missing: 'Varian tidak tersedia', soldout: 'Stok Habis' });
  });
  await check('S4.3.4: buildWaLink without the new parameter is byte-identical to before; the Sepasang line follows the order ID', () => {
    const items = [{ productName: 'Side bag', selectedVariantLabel: 'Kiri', sku: 'S-K', quantity: 2, price: 150000, subtotal: 300000 }, { productName: 'Side bag', selectedVariantLabel: 'Kanan', sku: null, quantity: 2, price: 150000, subtotal: 300000 }];
    for (const t of [{ totalPrice: 600000, discountAmount: 0, voucherCode: null, finalPrice: 600000 }, { totalPrice: 600000, discountAmount: 50000, voucherCode: 'V', finalPrice: 550000 }])
      assert.strictEqual(U.buildWaLink('ORD-1', items, t), oldBuildWaLink('ORD-1', items, t));
    const msg = decodeURIComponent(U.buildWaLink('ORD-1', items, { totalPrice: 600000, discountAmount: 0, voucherCode: null, finalPrice: 600000 }, S.sepasangWaLine(2)).split('?text=')[1]);
    assert.ok(msg.startsWith('PESANAN PRODUK\nOrder ID: #ORD-1\nPilihan: Sepasang (kiri + kanan), 2 pasang\n\nSide bag — Kiri (SKU: S-K)\n'));
  });
  await check('S4.3: summary rows and quantity label per choice', () => {
    assert.deepStrictEqual(S.sideSummary('kiri', 1), { pilihan: 'Kiri', isi: '1 kiri' });
    assert.deepStrictEqual(S.sideSummary('kanan', 3), { pilihan: 'Kanan', isi: '3 kanan' });
    assert.deepStrictEqual(S.sideSummary('sepasang', 2), { pilihan: 'Sepasang (kiri + kanan)', isi: '2 kiri + 2 kanan' });
    assert.deepStrictEqual([S.quantityLabel(null), S.quantityLabel('kiri'), S.quantityLabel('sepasang')], ['Jumlah', 'Jumlah', 'Jumlah pasang']);
  });
  await check('S4.3.2/S4.3.5: Sepasang through the order flow = one Kiri and one Kanan item of n each; Kiri/Kanan one item', async () => {
    const data = S.sidePicker(sideProduct());
    const f = mockFetch({ '/api/orders': { status: 201, body: { orderId: 'O', items: [], totalPrice: 0, discountAmount: 0, voucherCode: null, finalPrice: 0 } } });
    await O.submitOrder(O.buildOrderBody(S.buildSideItems('demo-side', data, 'sepasang', 3), null, null), f, S.sepasangWaLine(3));
    assert.deepStrictEqual(f.calls[0].body.items, [{ productSlug: 'demo-side', variationId: 'v-kiri', quantity: 3 }, { productSlug: 'demo-side', variationId: 'v-kanan', quantity: 3 }]);
    assert.deepStrictEqual(S.buildSideItems('demo-side', data, 'kanan', 1), [{ productSlug: 'demo-side', variationId: 'v-kanan', quantity: 1 }]);
  });

  // Server-rendered markup (SSR = what Google and no-JS visitors get)
  const ProductDetail = require(path.join(ROOT, 'components/v2/product/ProductDetail.tsx')).default;
  const render = (p, related = []) => renderToStaticMarkup(React.createElement(ProductDetail, { product: PU.normalizeProduct(p.slug, p), related }));
  await check('S3.1-S3.7/S3.3.8: simple product markup: one h1, breadcrumb, thumbnails, plain WhatsApp link (new tab), noscript hides stepper/voucher/share, info strip, FAQ <details>', () => {
    const html = render(BUILTIN[0], [PU.normalizeProduct('tankbag-tk-5', BUILTIN[1])]);
    assert.strictEqual((html.match(/<h1/g) || []).length, 1);
    assert.match(html, /<span aria-current="page">Tail bag Inzta Tourmax 30<\/span>/);
    assert.match(html, /href="\/produk\?posisi=tail">Tail bag<\/a>/);
    assert.match(html, /aria-label="Foto 1 dari 2" aria-current="true" tabindex="0"/);
    assert.match(html, /aria-label="Foto 2 dari 2" tabindex="-1"/);
    assert.match(html, /<a class="iz-btn iz-btn--primary iz-btn--wa" href="https:\/\/wa\.me\/\d+\?text=Halo%20INZTA%2C%20saya%20ingin%20pesan%20Tail%20bag%20Inzta%20Tourmax%2030" target="_blank" rel="noopener noreferrer">/);
    assert.match(html, /<noscript><style>\.iz-js-only \{ display: none !important; \}<\/style><\/noscript>/);
    assert.ok(/class="iz-qty iz-js-only"/.test(html) && /class="iz-voucher iz-js-only"/.test(html) && /class="iz-link iz-js-only"/.test(html));
    assert.match(html, /Rp520\.000<\/b><s>Rp590\.000<\/s><span class="iz-save">Hemat Rp70\.000<\/span>/);
    assert.ok(html.includes('Dibalas admin INZTA') && html.includes('Garansi: tanya admin') && html.includes('Ongkir dikonfirmasi admin'));
    assert.match(html, /<details open=""><summary>Apakah bisa dipasang di motor saya\?/);
    assert.strictEqual((html.match(/<details/g) || []).length, 3);
    assert.match(html, /<h2 class="t-h2-shop iz-pdp-h2">Lengkapi perjalanan Anda<\/h2>/);
    assert.match(html, /<h3 class="iz-pcard__name">Tankbag TK 5<\/h3>/);
    assert.match(html, /Belum yakin tas mana yang pas untuk motor Anda\?/);
  });
  await check('S3.3.10/S3.4.1/G-C2/G-C5: none of the old trust items, stock line, discount badge, lightbox, or rating text', () => {
    const html = render(BUILTIN[0]);
    for (const banned of ['Pengiriman Cepat', 'Garansi Resmi', 'Easy Return', 'Support 24/7', 'Sisa ', 'Tersedia', 'Klik untuk zoom', '-12%', 'original', 'rating', '★'])
      assert.ok(!html.includes(banned), banned);
    assert.ok(!html.includes('iz-mbar'), 'mobile bar is client-only (S3.9 ST-NOJS)');
  });
  await check('S3.3.8: sold out at render shows "Stok Habis" as a disabled link without href, even without JavaScript', () => {
    const html = render(BUILTIN[1]);
    assert.match(html, /<a class="iz-btn iz-btn--primary iz-btn--wa" role="link" aria-disabled="true">.*<span>Stok Habis<\/span><\/a>/);
    assert.match(html, /Foto belum tersedia/);
    assert.ok(!html.includes('class="iz-thumbs"'), '0 photos -> no thumbnail row');
  });
  await check('S3.5/S3.6: no features -> no Spesifikasi; description paragraphs; no description -> no Deskripsi', () => {
    const a = render({ ...BUILTIN[0], features: [], description: 'Satu\nDua\n\nTiga' });
    assert.ok(!a.includes('Spesifikasi') && a.includes('Deskripsi'));
    assert.match(a, /<p class="t-body iz-muted iz-pdp-para"><span>Satu<\/span><span><br\/>Dua<\/span><\/p><p class="t-body iz-muted iz-pdp-para"><span>Tiga<\/span><\/p>/);
    const b = render({ ...BUILTIN[0], features: ['Bahan luar: Cordura D600', 'XSR'], description: '' });
    assert.ok(b.includes('Spesifikasi') && !b.includes('Deskripsi'));
    assert.match(b, /<dl class="iz-spec"><div><dt>Bahan luar<\/dt><dd>Cordura D600<\/dd><\/div><div><dt><\/dt><dd>XSR<\/dd><\/div><\/dl>/);
    assert.match(b, /Bahan luarnya Cordura D600\./);
  });
  await check('Detail layout: Spesifikasi then Deskripsi in the first column, questions in the second; questions alone without either text', () => {
    const a = render({ ...BUILTIN[0], features: ['Bahan luar: Cordura D600'], description: 'Satu' });
    assert.match(a, /<section class="iz-pdp-details iz-wrap iz-pdp-block" id="spesifikasi"><div class="iz-pdp-info"><div><h2 class="t-h2-shop iz-pdp-h2">Spesifikasi<\/h2>.*<div class="iz-pdp-desc"><h2 class="t-h2-shop iz-pdp-h2">Deskripsi<\/h2>.*<\/div><\/div><div><h2 class="t-h2-shop iz-pdp-h2">Pertanyaan sebelum memesan<\/h2>/);
    assert.ok(!/style="margin/.test(a.slice(a.indexOf('iz-pdp-details'))), 'no inline heading margins left');
    const b = render({ ...BUILTIN[0], features: [], description: '' });
    assert.match(b, /<section class="iz-pdp-details iz-wrap iz-pdp-block" id="spesifikasi"><div><h2 class="t-h2-shop iz-pdp-h2">Pertanyaan sebelum memesan<\/h2>/);
    assert.ok(!b.includes('iz-pdp-info'));
  });
  await check('"Lihat selengkapnya": a long description starts folded with the full text in the HTML; a short one has no button', () => {
    const long = Array.from({ length: 8 }, (_, i) => `Paragraf ${i + 1}: ${'kata '.repeat(30).trim()}`).join('\n\n');
    const a = render({ ...BUILTIN[0], description: long });
    assert.match(a, /<div id="deskripsi-produk" class="iz-more__body iz-more__body--folded" style="--iz-more-fold:264px">/);
    assert.match(a, /<button type="button" class="iz-more__btn" aria-expanded="false" aria-controls="deskripsi-produk">Lihat selengkapnya/);
    assert.ok(a.includes('Paragraf 8:'), 'the folded text is still server-rendered');
    assert.match(a, /<noscript><style>\.iz-more__body \{ max-height: none !important;/);
    const b = render({ ...BUILTIN[0], description: 'Satu\nDua\n\nTiga' });
    assert.ok(b.includes('class="iz-more__body"') && !b.includes('class="iz-more__btn"'));
    assert.strictEqual(V.descriptionFolds([['x'.repeat(55)]]), false);
    assert.strictEqual(V.descriptionFolds(Array.from({ length: 9 }, () => ['x'.repeat(100)])), true);
  });
  await check('S3.3.9: generic picker = one fieldset per attribute, native radios, unavailable values disabled, no SKU line', () => {
    const html = render(BUILTIN[2]);
    assert.match(html, /<fieldset class="iz-vpick__set"><legend class="iz-field-label">Depan<\/legend>/);
    assert.strictEqual((html.match(/type="radio" name="varian-0"/g) || []).length, 3);
    assert.ok(!html.includes('SKU'));
    assert.ok(!html.includes('class="iz-side"'));
  });
  await check('S4.2/S4.4: side product markup: picker with three cards, no preselection, hint, side tiles and placeholders, "/ sisi"', () => {
    const html = render(sideProduct());
    assert.match(html, /<fieldset class="iz-side"><legend class="iz-side__head"><span class="iz-field-label">Pilih sisi<\/span>/);
    assert.ok(html.includes('Dilihat dari posisi duduk pengendara'));
    assert.strictEqual((html.match(/type="radio" name="main"/g) || []).length, 3);
    assert.ok(!/name="main"[^>]*checked/.test(html));
    assert.match(html, /<span class="iz-sideopt__tag">2 tas<\/span>/);
    assert.match(html, /aria-label="Foto kiri" tabindex="-1"/);
    assert.match(html, /role="img" aria-label="Foto kanan belum tersedia"/);
    assert.match(html, /role="img" aria-label="Foto sepasang belum tersedia"/);
    assert.match(html, /<b>Rp150\.000<\/b><span class="iz-per">\/ sisi<\/span><s>Rp175\.000<\/s><span class="iz-save">Hemat Rp25\.000<\/span>/);
    assert.match(html, /<span class="iz-fit">Dibuat untuk Yamaha XSR 155<\/span>/);
    // ST-NOJS: ordering through the plain link, side told in chat.
    assert.match(html, /<span>Pesan via WhatsApp<\/span><\/a>/);
  });
  await check('S4.2.2/S4.2.3/S4.1.3/S4.2.4: Kanan sold out, both sold out, bisaSepasang false, unequal legacy prices', () => {
    const kananOut = render(sideProduct({}, {}, { stock: 0 }));
    assert.match(kananOut, /id="main-kanan"[^>]*disabled=""/);
    assert.match(kananOut, /<span class="iz-sideopt__out">Habis<\/span>/);
    assert.match(kananOut, /<span class="iz-sideopt__out">Kanan habis<\/span>/);
    assert.match(kananOut, /<p class="iz-side__note">Sisi kanan sedang habis. <a href="https:\/\/wa\.me\/\d+" target="_blank" rel="noopener noreferrer">Tanya admin<\/a> kapan tersedia lagi.<\/p>/);
    const both = render(sideProduct({}, { stock: 0 }, { isActive: false }));
    assert.match(both, /Kiri dan kanan sedang habis. <a[^>]*>Tanya admin<\/a> kapan tersedia lagi./);
    assert.match(both, /role="link" aria-disabled="true">.*Stok Habis/);
    const two = render(sideProduct({ bisaSepasang: false }));
    assert.strictEqual((two.match(/type="radio" name="main"/g) || []).length, 2);
    const legacy = render(sideProduct({}, { price: 150000 }, { price: 175000, compareAtPrice: null }));
    assert.match(legacy, /<b>Rp150\.000 – Rp175\.000<\/b><span class="iz-per">\/ sisi<\/span>/);
  });

  // Admin side preset (S4.6) — pure rules and the preview render
  const legacySimple = { productType: 'simple', slug: 'a', price: 100000, stock: 3 };
  const legacyOther = { productType: 'variable', slug: 'side-bag-inzta-universal-motor', attributes: BUILTIN[2].attributes, variants: BUILTIN[2].variants };
  await check('S4.6.1: load mode per structure; switch on when bisaSepasang is missing', () => {
    assert.deepStrictEqual([F2.modeOf(sideProduct()), F2.modeOf(legacyOther), F2.modeOf(legacySimple), F2.modeOf(null)], ['side', 'other', 'none', 'none']);
    assert.strictEqual(F2.initialState(sideProduct()).bisaSepasang, true);
    assert.strictEqual(F2.initialState(sideProduct({ bisaSepasang: false })).bisaSepasang, false);
    const st = F2.initialState(sideProduct());
    assert.deepStrictEqual(st.rows.kiri, { variationId: 'v-kiri', sku: 'v-kiri', price: '150.000', compareAt: '175.000', stock: '5', images: ['kiri.jpg'] });
  });
  await check('S4.6.3: validation blocks price <= 0, compare-at not above price, missing or non-integer stock, unequal Kiri/Kanan prices', () => {
    const row = (o = {}) => ({ variationId: '', sku: '', price: '150.000', compareAt: '175.000', stock: '5', images: [], ...o });
    const v = (k, n) => F2.validateSideRows({ kiri: row(k), kanan: row(n) });
    assert.strictEqual(v({}, {}), null);
    assert.strictEqual(v({ price: '0' }, {}), 'Kiri: harga harus lebih dari 0.');
    assert.strictEqual(v({}, { compareAt: '150.000' }), 'Kanan: harga coret harus lebih besar dari harga jual.');
    assert.strictEqual(v({ stock: '' }, {}), 'Kiri: stok wajib diisi dengan bilangan bulat 0 atau lebih.');
    assert.strictEqual(v({ stock: '1.5' }, {}), 'Kiri: stok wajib diisi dengan bilangan bulat 0 atau lebih.');
    assert.strictEqual(v({}, { price: '160.000', compareAt: '' }), 'Harga dan harga coret kiri dan kanan harus sama.');
    assert.strictEqual(v({ compareAt: '' }, { compareAt: '' }), null);
  });
  await check('S4.6.2: per-side save body (Sisi attribute, two active variants keeping variationIds, SKU auto-fill, others inactive, flags)', () => {
    const p = { ...legacyOther };
    let st = F2.initialState(p);
    st = { ...st, mode: 'side', rows: F2.rowsFromVariants(p.variants) };
    st.rows.kiri.sku = ''; st.rows.kiri.stock = '4'; st.rows.kanan.stock = '6';
    st.rows.kanan.compareAt = '170.000';
    const out = F2.applyToPayload({ name: 'X', slug: 'side-bag-inzta-universal-motor', productType: 'variable', attributes: p.attributes, variants: p.variants }, st, p.variants, () => 'new-id');
    assert.deepStrictEqual(out.attributes, [{ id: 'new-id', name: 'Sisi', values: ['Kiri', 'Kanan'] }]);
    assert.deepStrictEqual(out.variants.slice(0, 2).map(v => [v.variationId, v.sku, v.attributes, v.price, v.compareAtPrice, v.stock, v.isActive]), [
      ['v1', 'side-bag-inzta-universal-motor-kiri', { Sisi: 'Kiri' }, 140000, 170000, 4, true],
      ['v2', 'v2', { Sisi: 'Kanan' }, 140000, 170000, 6, true],
    ]);
    assert.deepStrictEqual(out.variants.slice(2).map(v => [v.variationId, v.isActive]), [['v3', false], ['v4', false]]);
    assert.deepStrictEqual([out.jualPerSisi, out.bisaSepasang, 'kategoriMotor' in out], [true, true, false]);
    const S2 = require(path.join(ROOT, 'components/v2/product/side.ts'));
    assert.ok(S2.hasActiveSidePair(out), 'the API rule INVALID_SIDE_VARIANTS accepts the body');
  });
  await check('S4.6.4: "Tanpa varian" -> per side prefills both rows from the simple price, Stok empty; new rows get an id at save', () => {
    const rows = F2.prefillFromSimple(F2.initialState(legacySimple).rows, '150.000', '175.000');
    assert.deepStrictEqual([rows.kiri.price, rows.kanan.compareAt, rows.kiri.stock, rows.kanan.stock], ['150.000', '175.000', '', '']);
    const st = { ...F2.initialState(legacySimple), mode: 'side', rows: { kiri: { ...rows.kiri, stock: '1' }, kanan: { ...rows.kanan, stock: '1' } } };
    let n = 0;
    const out = F2.applyToPayload({ slug: 'a', productType: 'variable', price: 150000, stock: 3, sku: null, compareAtPrice: null }, st, [], () => `id-${++n}`);
    assert.deepStrictEqual(out.variants.map(v => v.variationId), ['id-2', 'id-3']);
    assert.ok(!('price' in out) && !('stock' in out));
    assert.strictEqual(F2.CONFIRM_MODE_CHANGE, 'Varian yang ada akan diganti. Perubahan baru berlaku setelah klik Simpan.');
  });
  await check('S4.6.5: a legacy product saved without changes gets no new field; kategori only when stored or touched; leaving per side clears the flag', () => {
    const base = { name: 'X', slug: 'a', productType: 'simple', price: 1 };
    assert.deepStrictEqual(F2.applyToPayload(base, F2.initialState(legacySimple), [], () => 'x'), base);
    assert.deepStrictEqual(F2.applyToPayload({ ...base, productType: 'variable' }, F2.initialState(legacyOther), [], () => 'x'), { ...base, productType: 'variable' });
    const touched = { ...F2.initialState(legacySimple), kategori: ['retro', 'matic'], kategoriTouched: true };
    assert.deepStrictEqual(F2.applyToPayload(base, touched, [], () => 'x').kategoriMotor, ['matic', 'retro']);
    const stored = F2.initialState({ ...legacySimple, kategoriMotor: [] });
    assert.deepStrictEqual(F2.applyToPayload(base, stored, [], () => 'x').kategoriMotor, []);
    const wasSide = { ...F2.initialState(sideProduct({ jualPerSisi: true, bisaSepasang: false })), mode: 'other' };
    const out = F2.applyToPayload({ ...base, productType: 'variable' }, wasSide, [], () => 'x');
    assert.deepStrictEqual([out.jualPerSisi, out.bisaSepasang], [false, false]);
    for (const v of Object.values(out)) assert.notStrictEqual(v, undefined);
  });
  await check('S4.6 preview: live SidePicker from the form values inside .iz-page, no order button, name not an h1', () => {
    const SidePreview = require(path.join(ROOT, 'app/admin/(panel)/produk/_v2/SidePreview.tsx')).default;
    const st = F2.initialState(sideProduct());
    const html = renderToStaticMarkup(React.createElement(SidePreview, { state: st, name: 'Side bag Inzta XSR 155', slug: 'side-bag-inzta-xsr-155' }));
    assert.match(html, /^<div class="iz-page fd fs" data-theme="light"/);
    assert.ok(html.includes('class="iz-preview"') && html.includes('class="iz-side"') && html.includes('Pratinjau di halaman produk'));
    assert.match(html, /<span class="iz-cat-chip">Side bag<\/span><span class="iz-fit">Dibuat untuk Yamaha XSR 155<\/span>/);
    assert.ok(!html.includes('<h1') && !html.includes('iz-btn'));
    const empty = renderToStaticMarkup(React.createElement(SidePreview, { state: { ...st, rows: { ...st.rows, kanan: { ...st.rows.kanan, stock: '' } } }, name: 'X', slug: 'x' }));
    assert.match(empty, /Sisi kanan sedang habis/);
  });
  await check('S4.6: the admin page imports one block from ./_v2, the old "Tipe Produk" toggle is gone, the generic editor stays for "Varian lain"', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/admin/(panel)/produk/page.tsx'), 'utf8');
    assert.strictEqual((src.match(/from '\.\/_v2\//g) || []).length, 1);
    assert.ok(!src.includes('Tipe Produk'));
    assert.ok(src.includes('Atribut Variasi') && src.includes('Generate Variasi'));
    assert.match(src, /data = v2\.apply\(data\);/);
  });

  // S4.3.6 admin order transactions
  const route = require(path.join(ROOT, 'app/api/admin/orders/[orderId]/route.ts'));
  const seed = () => {
    docs.clear();
    docs.set('products/demo-side', { productType: 'variable', name: 'Side', variants: [variant('v-kiri', { Sisi: 'Kiri' }, { stock: 5 }), variant('v-kanan', { Sisi: 'Kanan' }, { stock: 7 })], totalStock: 12 });
    docs.set('products/simple-a', { productType: 'simple', name: 'A', stock: 10 });
    const item = (variationId, quantity) => ({ productSlug: 'demo-side', productType: 'variable', variationId, quantity, price: 150000, productName: 'Side' });
    docs.set('orders/ORD-1', { orderId: 'ORD-1', status: 'pending', items: [item('v-kiri', 2), item('v-kanan', 2), { productSlug: 'simple-a', productType: 'simple', variationId: null, quantity: 1, price: 1 }], finalPrice: 600000, voucherCode: null, affiliateId: null });
  };
  const stock = () => { const p = docs.get('products/demo-side'); return [p.variants[0].stock, p.variants[1].stock, p.totalStock, docs.get('products/simple-a').stock]; };
  const patch = (status) => route.PATCH(new Request('http://x', { method: 'PATCH', body: JSON.stringify({ status }) }), { params: { orderId: 'ORD-1' } });
  await check('S4.3.6: completing a Sepasang order lowers both sides by n, snapshot lists both, one product write; revalidateProductPaths still runs', async () => {
    seed();
    revalidated.length = 0;
    const res = await patch('completed');
    assert.strictEqual(res.status, 200, JSON.stringify(await res.clone().json()));
    assert.deepStrictEqual(stock(), [3, 5, 8, 9]);
    assert.deepStrictEqual(docs.get('orders/ORD-1').inventorySnapshot.items.map(i => [i.variationId, i.stockBefore, i.stockAfter]), [['v-kiri', 5, 3], ['v-kanan', 7, 5], [null, 10, 9]]);
    assert.ok(revalidated.includes('/produk/[slug] page'), revalidated.join());
  });
  await check('S4.3.6: reverting to pending and cancelling restore both sides by n', async () => {
    seed();
    await patch('completed');
    assert.strictEqual((await patch('pending')).status, 200);
    assert.deepStrictEqual(stock(), [5, 7, 12, 10]);
    await patch('completed');
    assert.strictEqual((await patch('cancelled')).status, 200);
    assert.deepStrictEqual(stock(), [5, 7, 12, 10]);
    assert.strictEqual(docs.get('orders/ORD-1').status, 'cancelled');
  });
  await check('S4.3.6: deleting a completed Sepasang order restores both sides', async () => {
    seed();
    await patch('completed');
    const res = await route.DELETE(new Request('http://x', { method: 'DELETE' }), { params: { orderId: 'ORD-1' } });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(stock(), [5, 7, 12, 10]);
    assert.ok(!docs.has('orders/ORD-1'));
  });
  await check('S4.3.6: the same variant twice in one order is checked against the running stock (no oversell)', async () => {
    seed();
    const o = docs.get('orders/ORD-1');
    docs.set('orders/ORD-1', { ...o, items: [o.items[0], { ...o.items[0], quantity: 4 }] });
    const quiet = console.error;
    console.error = () => {};
    const res = await patch('completed').finally(() => { console.error = quiet; });
    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(stock(), [5, 7, 12, 10]);
  });

  let failed = 0;
  for (const [s, n] of results) {
    if (s === 'FAIL') failed++;
    console.log(`${s}  ${n}`);
  }
  const ran = results.filter(([s]) => s !== 'SKIP').length;
  console.log(`\n${ran - failed}/${ran} passed`);
  process.exit(failed ? 1 : 0);
})();
