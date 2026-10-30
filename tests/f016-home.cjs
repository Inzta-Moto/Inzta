// F-016: pure helpers of the v2 Beranda (lib/v2/home-data.ts) and the review helpers it renders (lib/v2/reviews.ts).
// Requirements S0.9, S1.3, S1.5, S1.6, S1.8, S1.9, S1.11.
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
const R = require(path.join(ROOT, 'lib/v2/reviews.ts'));

const results = [];
const pending = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
function checkAsync(name, fn) {
  pending.push(fn().then(() => results.push(['PASS', name]), e => results.push(['FAIL', name + ': ' + e.message])));
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

check('selectGuides: published only, newest first by publishedAt ?? createdAt, cap 3, author default, cover fallback (S1.8)', () => {
  const art = (slug, extra = {}) => ({ slug, title: slug, createdAt: 1, publishedAt: 2, images: [], ...extra });
  const g = H.selectGuides([
    art('old', { publishedAt: 5 }),
    art('gasber-16-indonesia-ride-adventure', { publishedAt: 30, topik: 'komunitas', coverImage: 'https://x/c.png', coverAlt: 'Alt', coverCaption: 'Dok. Gasber 16 / Indonesia Ride Adventure', author: 'Tim INZTA' }),
    art('lain', { author: '  ', publishedAt: null, createdAt: 20 }),
    art('draft', { publishedAt: 40, status: 'draft' }),
    art('undated', { publishedAt: null, createdAt: null }),
  ]);
  assert.deepStrictEqual(g.map(x => x.slug), ['gasber-16-indonesia-ride-adventure', 'lain', 'old']);
  assert.strictEqual(g[0].credit, 'Dok. Gasber 16 / Indonesia Ride Adventure');
  assert.strictEqual(g[1].author, 'Tim INZTA');
  assert.strictEqual(g[1].date, 20);
  assert.strictEqual(g[1].image, null);
});

check('selectGuides: chip from topik through topicLabel; none without topik or for an unknown value (D3, S1.8.3)', () => {
  const art = (slug, topik) => ({ slug, title: slug, publishedAt: 1, images: [], topik });
  assert.deepStrictEqual(H.selectGuides([art('a', 'komunitas'), art('b', 'per-motor'), art('c', 'memilih-tas')]).map(x => x.chip), ['Komunitas', 'Per motor', 'Memilih tas']);
  assert.deepStrictEqual(H.selectGuides([art('d', 'touring'), art('e', ''), art('f', 'vespa')]).map(x => x.chip), ['Touring', null, null]);
  // The old slug map is gone: a known slug without topik gets no chip.
  assert.strictEqual(H.selectGuides([art('gasber-16-indonesia-ride-adventure', undefined)])[0].chip, null);
});

check('selectGuides: one-line credit; invalid or missing date reads as null so the meta shows the author only (S1.8.3)', () => {
  const g = H.selectGuides([{ slug: 'x', title: 'x', images: [], publishedAt: NaN, coverCaption: 'Baris satu\nBaris dua' }]);
  assert.strictEqual(g[0].date, null);
  assert.strictEqual(g[0].credit, 'Baris satu');
  assert.strictEqual(H.selectGuides([{ slug: 'y', title: 'y', images: [], coverCaption: '   ' }])[0].credit, null);
});

check('selectGuides: layout counts 0, 1, 2, 3+ follow the list length (S1.8.2)', () => {
  const art = i => ({ slug: `a${i}`, title: `a${i}`, publishedAt: 100 - i, images: [] });
  for (const n of [0, 1, 2, 3, 5]) assert.strictEqual(H.selectGuides(Array.from({ length: n }, (_, i) => art(i))).length, Math.min(n, 3), String(n));
});

check('guideAction: "Baca catatan" only for Komunitas, else "Baca panduan" (S1.8.1)', () => {
  assert.strictEqual(H.guideAction({ chip: 'Komunitas' }), 'Baca catatan');
  assert.strictEqual(H.guideAction({ chip: 'Per motor' }), 'Baca panduan');
  assert.strictEqual(H.guideAction({ chip: null }), 'Baca panduan');
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
  assert.strictEqual(H.buildHomeData(DESIGN, [], flash, before).gasberPublished, false);
});

check('buildHomeData: Tourmax band hidden when the product is missing, inactive, or priced 0 (S1.6.1)', () => {
  const t = DESIGN[0];
  const none = { isActive: false, endsAt: null };
  assert.strictEqual(H.buildHomeData(DESIGN.slice(1), [], none).tourmax, null);
  assert.strictEqual(H.buildHomeData([{ ...t, isActive: false }], [], none).tourmax, null);
  assert.strictEqual(H.buildHomeData([{ ...t, price: 0 }], [], none).tourmax, null);
  assert.strictEqual(H.buildHomeData([{ slug: t.slug, name: t.name, productType: 'variable', variants: [] }], [], none).tourmax, null);
});

checkAsync('readHomeSources: products failure throws; articles and flash failures degrade and log (S1.11.2, S1.8.4, S0.3.6)', async () => {
  const ok = { products: async () => DESIGN, articles: async () => [{ slug: 'a' }], flash: async () => ({ isActive: true, endsAt: 'x' }) };
  const boom = async () => { throw new Error('read failed'); };
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const r = await H.readHomeSources({ ...ok, articles: boom, flash: boom });
    assert.strictEqual(r.products, DESIGN);
    assert.deepStrictEqual(r.articles, []);
    assert.deepStrictEqual(r.flash, { isActive: false, endsAt: null });
    assert.strictEqual(logged.length, 2);
    await assert.rejects(H.readHomeSources({ ...ok, products: boom }), /read failed/);
    assert.strictEqual((await H.readHomeSources(ok)).articles.length, 1);
  } finally {
    console.error = orig;
  }
});

check('reviews: featured + even wall, "[tertutup]" as "...", Tokopedia meta, chip name, photo, variant (S1.9)', () => {
  const { featured, wall } = R.splitReviews(R.TOKOPEDIA_REVIEWS);
  assert.strictEqual(R.TOKOPEDIA_REVIEWS.length, 8);
  assert.strictEqual(featured, R.TOKOPEDIA_REVIEWS[0]);
  assert.strictEqual(wall.length, 6);
  assert.ok(!wall.includes(R.TOKOPEDIA_REVIEWS[7]));
  assert.deepStrictEqual(R.splitReviews([]), { featured: null, wall: [] });
  assert.strictEqual(R.splitReviews([1, 2, 3, 4]).wall.length, 2);
  assert.ok(!R.TOKOPEDIA_REVIEWS.some(r => r.quote.includes('[tertutup]')));
  assert.ok(R.TOKOPEDIA_REVIEWS[1].quote.includes(' ... '));
  assert.strictEqual(R.reviewMetaLine({ month: '2026-08' }), 'Ulasan di Tokopedia, sekitar Agustus 2026');
  const products = [{ ...DESIGN[3], isActive: true }];
  const c1 = R.reviewChip(R.TOKOPEDIA_REVIEWS[0], products);
  assert.strictEqual(c1.label, 'Side Bag Motor Inzta Foldpack Z10 Vol 10L · Sepasang');
  assert.strictEqual(c1.cropTop, true);
  assert.ok(c1.image);
  const c6 = R.reviewChip(R.TOKOPEDIA_REVIEWS[5], products);
  assert.strictEqual(c6.label, 'Sidebag XSR Daily Ride · Sepasang');
  assert.strictEqual(c6.image, null);
  assert.strictEqual(R.reviewChip(R.TOKOPEDIA_REVIEWS[0], [{ ...DESIGN[3], isActive: false }]).image, null);
  for (const r of R.TOKOPEDIA_REVIEWS) assert.ok(!/rating|bintang|★/i.test(JSON.stringify(r)), r.name);
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

check('static photos: every local photo of the Beranda, category and Tentang content exists, chat photos differ from tiles (S0.12, S5, S8.2)', () => {
  const C = require(path.join(ROOT, 'lib/v2/home-content.ts'));
  const A = require(path.join(ROOT, 'components/v2/about/about-content.ts'));
  const local = [
    ...Object.values(C.HIRES),
    C.CLOSING_CHAT_PHOTO,
    ...A.PROCESS_STEPS.map(s => s.image),
    ...C.MOTOR_CATEGORIES.map(c => c.image),
    ...Object.values(C.CHAT_PHOTOS).filter(Boolean),
    ...C.POSITION_ITEMS.map(p => p.image),
    ...C.FILMSTRIP.map(f => f.src),
    A.HERO_PHOTO.src,
    A.VALUES_PHOTO.src,
    ...Object.values(A.COMMUNITY_PHOTOS).map(p => p.src),
  ].filter(src => src.startsWith('/'));
  assert.ok(local.length >= 20, `only ${local.length} local photos found`);
  for (const src of local) assert.ok(fs.existsSync(path.join(ROOT, 'public', src)), `missing public${src}`);
  for (const c of C.MOTOR_CATEGORIES) {
    assert.ok(!c.image.includes('/contoh/'), `${c.value} still uses an example photo`);
    assert.ok(c.alt.length > 0, `${c.value} has no alt`);
    assert.notStrictEqual(C.CHAT_PHOTOS[c.value], c.image, `${c.value} chat photo repeats the tile`);
  }
  assert.strictEqual(C.CHAT_PHOTOS.trail, null);
});

Promise.all(pending).then(() => {
  let failed = 0;
  for (const [s, n] of results) {
    if (s === 'FAIL') failed++;
    console.log(`${s}  ${n}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
