// F-016: pure helpers of the v2 Beranda (lib/v2/home-data.ts). Requirements 7.2, 9.3, 12.2, 12.3, 16.3, 17.1–17.4.
// Usage: npm run test:home  (or: node tests/f016-home.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  else if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const H = require(path.join(ROOT, 'lib/v2/home-data.ts'));
const M = require(path.join(ROOT, 'lib/v2/motor-category.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const simple = (slug, name, price, compareAtPrice = null, extra = {}) =>
  ({ productType: 'simple', slug, name, price, compareAtPrice, images: [`https://res.cloudinary.com/dukddlp0b/image/upload/${slug}.jpg`], ...extra });

// The six best sellers of the design (Main.dc.html) with their names as stored on inzta.id.
const DESIGN = [
  simple('tail-bag-inzta-tourmax-30', 'Tail bag Inzta Tourmax 30', 520000, 590000, { badge: 'Best Seller' }),
  simple('tankbag-tk-5', 'Tankbag TK 5', 400000, 455000, { badge: 'Best Seller' }),
  simple('side-bag-inzta-xsr-155', 'Side bag Inzta XSR 155', 150000, 175000, { badge: 'best seller' }),
  simple('side-bage-motor-inzta-oke', 'Side Bag Motor Inzta Foldpack Z10 Vol 10L', 530000, 600000, { badge: 'BEST SELLER' }),
  simple('sidebag-inzta-adventure-20l-tas-touring-motor', 'Sidebag inzta Adventure 20L', 750000, 855000, { badge: 'Best seller' }),
  simple('botol-bag-inzta-xmax', 'Botol bag Inzta Xmax', 120000, 150000, { badge: 'Best seller' }),
];

check('fitLabel: model named in the product name gets the green chip (17.1 step 1)', () => {
  assert.deepStrictEqual(H.fitLabel(DESIGN[2]), { kind: 'model', text: 'Dibuat untuk Yamaha XSR 155' });
  assert.deepStrictEqual(H.fitLabel(DESIGN[5]), { kind: 'model', text: 'Dibuat untuk Yamaha XMAX' });
  assert.deepStrictEqual(H.fitLabel(simple('botol-bag-inzta-nmax', 'Botol bag inzta Nmax', 100000)), { kind: 'model', text: 'Dibuat untuk Yamaha NMAX' });
  assert.deepStrictEqual(H.fitLabel(simple('xbags', 'Xbags, tas bagasi xmax', 180000)), { kind: 'model', text: 'Dibuat untuk Yamaha XMAX' });
});

check('fitLabel: gate 0 C-7, no universal or "Untuk ..." line while A-012 is open (17.1a)', () => {
  for (const p of [DESIGN[0], DESIGN[1], DESIGN[3], DESIGN[4]]) assert.strictEqual(H.fitLabel(p), null, p.slug);
});

check('fitLabel: names that only look like a model do not match', () => {
  assert.strictEqual(H.fitLabel(simple('tourmax', 'Tail bag Inzta Tourmax 30', 1)), null);
  assert.strictEqual(H.fitLabel(simple('gilimax', 'Tailbag GILiMax', 1)), null);
  assert.strictEqual(H.fitLabel(simple('scram', 'Side bag Inzta XSR Srcrambag', 1)), null);
});

check('hasBannedWord: generated labels never contain banned words (17.3)', () => {
  for (const p of DESIGN) {
    const l = H.fitLabel(p);
    if (l) assert.strictEqual(H.hasBannedWord(l.text), false, l.text);
  }
  assert.strictEqual(H.hasBannedWord('Tas waterproof'), true);
  assert.strictEqual(H.hasBannedWord('100% aman'), true);
  assert.strictEqual(H.hasBannedWord('Untuk paspor'), false);
});

check('positionOf: keyword rule and map overrides (17.2)', () => {
  assert.strictEqual(H.positionOf(DESIGN[0]), 'tail');
  assert.strictEqual(H.positionOf(DESIGN[1]), 'tank');
  assert.strictEqual(H.positionOf(DESIGN[2]), 'side');
  assert.strictEqual(H.positionOf(DESIGN[4]), 'side');
  assert.strictEqual(H.positionOf(DESIGN[5]), 'aksesori');
  assert.strictEqual(H.positionOf(simple('acc-medikit-ride', 'Acc Medikit Ride', 1)), 'aksesori');
  assert.strictEqual(H.positionOf(simple('tankbag-and-tailbag-wanderpack-10l', 'Tankbag and Tailbag wanderpack 10L', 1)), 'tank');
  assert.strictEqual(H.positionOf(simple('xbags-tas-bagasi-xmax', 'Xbags, tas bagasi xmax', 1)), null);
  assert.strictEqual(H.positionOf(simple('daily', 'Tas harian Boba', 1)), null);
});

// Reference: the price logic of components/ProductCard.tsx lines 19-36, restated for the same fixtures.
function productCardPrice(p) {
  const compareAtPrice = p.compareAtPrice ?? p.originalPrice ?? null;
  let price = p.price ?? 0;
  let compare = compareAtPrice;
  if (p.productType === 'variable') {
    price = p.priceFrom ?? 0;
    const variants = p.variants || [];
    const maxCompareAt = variants.length > 0 ? Math.max(...variants.map(v => v.compareAtPrice || 0).filter(v => v > 0)) : 0;
    if (maxCompareAt > price) compare = maxCompareAt;
  }
  return { price, compareAt: compare && compare > price ? compare : null };
}

check('effectivePrice: same result as ProductCard on simple, variable, legacy, and lower compare-at', () => {
  const fixtures = [
    DESIGN[0],
    simple('legacy', 'Legacy', 300000, undefined, { compareAtPrice: undefined, originalPrice: 350000 }),
    simple('lower', 'Lower', 300000, 250000),
    { productType: 'variable', slug: 'v', name: 'Variable', priceFrom: 150000, variants: [{ compareAtPrice: 175000 }, { compareAtPrice: 0 }] },
    { productType: 'variable', slug: 'v2', name: 'Variable no compare', priceFrom: 150000, variants: [] },
    { productType: 'variable', slug: 'v3', name: 'Variable product-level compare', priceFrom: 150000, compareAtPrice: 175000, variants: [{ compareAtPrice: 0 }] },
  ];
  for (const f of fixtures) assert.deepStrictEqual(H.effectivePrice(f), productCardPrice(f), f.slug);
});

check('minPriceByPosition: lowest price per position, empty position null (9.3)', () => {
  const m = H.minPriceByPosition([...DESIGN, simple('tk-11', 'Tankbag TK 11', 360000)]);
  assert.deepStrictEqual(m, { tank: 360000, side: 150000, tail: 520000, aksesori: 120000 });
  assert.deepStrictEqual(H.minPriceByPosition([]), { tank: null, side: null, tail: null, aksesori: null });
});

check('selectBestSellers: badge contains "best", order kept, cap 8, empty list (7.2)', () => {
  const many = Array.from({ length: 10 }, (_, i) => simple(`p${i}`, `Tankbag ${i}`, 1000, null, { badge: 'Best Seller' }));
  assert.strictEqual(H.selectBestSellers(many).length, 8);
  assert.deepStrictEqual(H.selectBestSellers([simple('a', 'A', 1, null, { badge: 'Baru' }), DESIGN[1]]).map(c => c.slug), ['tankbag-tk-5']);
  assert.deepStrictEqual(H.selectBestSellers([]), []);
  const card = H.selectBestSellers([DESIGN[3]])[0];
  assert.strictEqual(card.cropClass, 'iz-crop-top');
  assert.strictEqual(card.position, 'side');
});

check('selectGuides: newest first as given, cap 3, author default, cover fallback, chip map (12.2, 12.3)', () => {
  const art = (slug, extra = {}) => ({ slug, title: slug, createdAt: 1, publishedAt: 2, images: [], ...extra });
  const g = H.selectGuides([
    art('gasber-16-indonesia-ride-adventure', { coverImage: 'https://x/c.png', coverAlt: 'Alt', coverCaption: 'Dok. Gasber 16 / Indonesia Ride Adventure', author: 'Tim INZTA' }),
    art('lain', { author: '  ', publishedAt: null }),
    art('c'),
    art('d'),
  ]);
  assert.strictEqual(g.length, 3);
  assert.strictEqual(g[0].chip, 'Komunitas');
  assert.strictEqual(g[0].credit, 'Dok. Gasber 16 / Indonesia Ride Adventure');
  assert.strictEqual(g[1].author, 'Tim INZTA');
  assert.strictEqual(g[1].date, 1);
  assert.strictEqual(g[1].image, null);
  assert.strictEqual(g[1].chip, null);
});

check('formatRupiah and formatWaDisplay (9.3, 16.3)', () => {
  assert.strictEqual(H.formatRupiah(520000), 'Rp520.000');
  assert.strictEqual(H.formatRupiah(70000), 'Rp70.000');
  assert.strictEqual(H.formatWaDisplay('6289513482410'), '+62 895-1348-2410');
});

check('formatShortDate: Jakarta date as in the design ("26 Okt 2026")', () => {
  assert.strictEqual(H.formatShortDate(Date.parse('2026-10-25T18:30:00Z')), '26 Okt 2026');
  assert.strictEqual(H.formatShortDate(null), '');
});

check('buildHomeData: Tourmax price, Gasber flag, product images, flash active or ended (24.7)', () => {
  const flash = { isActive: true, endsAt: '2026-10-31T16:59:00.000Z' };
  const before = Date.parse('2026-10-29T00:00:00Z');
  const d = H.buildHomeData(DESIGN, [{ slug: 'gasber-16-indonesia-ride-adventure', title: 'x', images: [] }], flash, before);
  assert.deepStrictEqual(d.tourmax, { price: 520000, compareAt: 590000 });
  assert.strictEqual(d.gasberPublished, true);
  assert.ok(d.productImages['tankbag-tk-5']);
  assert.strictEqual(d.flash, flash);
  assert.strictEqual(H.buildHomeData([], [], flash, before).tourmax, null);
  assert.deepStrictEqual(H.buildHomeData([], [], flash, Date.parse('2026-11-01T00:00:00Z')).flash, { isActive: false, endsAt: null });
  assert.deepStrictEqual(H.buildHomeData([], [], { isActive: true, endsAt: '2026-10-03T04:04:32.877Z' }, before).flash, { isActive: false, endsAt: null });
});

check('motor categories: placement only by the model in the product name, universal by name (P2-2)', () => {
  assert.deepStrictEqual(M.categoriesOf({ name: 'Side bag Inzta XSR 155' }), ['retro']);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Side bag Inzta XSR Srcrambag' }), ['retro']);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Botol bag Inzta Xmax' }), ['matic']);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Tankbag Tunnelbag Matic' }), ['matic']);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Sidebag inzta Adventure 20L, tas touring motor' }), ['adventure']);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Tail bag Inzta Tourmax 30' }), []);
  assert.deepStrictEqual(M.categoriesOf({ name: 'Tailbag GILiMax' }), []);
  assert.strictEqual(M.isUniversalByName({ name: 'Side bag inzta universal motor' }), true);
  assert.strictEqual(M.isMotorCategory('retro'), true);
  assert.strictEqual(M.isMotorCategory('vespa'), false);
  assert.strictEqual(M.categoryHref('trail'), '/tas-motor/trail');
});

let failed = 0;
for (const [s, n] of results) {
  if (s === 'FAIL') failed++;
  console.log(`${s}  ${n}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
