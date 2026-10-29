// F-016 S2 Katalog: filter, sort, and query logic (components/v2/catalog/filter.ts) and the /produk route contract
// (ISR, client-only query, a failed read throws). Requirements S2.1.1, S2.2.2–S2.2.5, S2.2.8, S2.3, S2.4.1–S2.4.3,
// S2.5, S2.7.1–S2.7.3.
// Usage: npm run test:catalog  (or: node tests/f016-catalog.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

// Modules replaced in the route test below (absolute path without extension → exports).
const STUBS = new Map();

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.endsWith('.css')) return 'stub:css';
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  else if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  if (STUBS.has(request)) return 'stub:' + request;
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent, ...rest);
  if (resolved === 'stub:css') return {};
  if (resolved.startsWith('stub:')) return STUBS.get(resolved.slice(5));
  return origLoad.call(this, request, parent, ...rest);
};
const compile = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  });
  m._compile(out.outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const F = require(path.join(ROOT, 'components/v2/catalog/filter.ts'));

const results = [];
const pending = [];
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(() => results.push(['PASS', name]), e => results.push(['FAIL', name + ': ' + e.message])));
      return;
    }
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ': ' + e.message]);
  }
}

const simple = (slug, name, price, compareAtPrice = null, extra = {}) =>
  ({ productType: 'simple', slug, name, price, compareAtPrice, images: [`https://res.cloudinary.com/x/${slug}.jpg`], isActive: true, ...extra });

// Names, prices, and badges as stored on inzta.id (fixture); dates and categories are test values.
const P = [
  simple('tankbag-tk-5', 'Tankbag TK 5', 400000, 455000, { badge: 'BEST SELLER', createdAt: 5000 }),
  simple('side-bag-inzta-xsr-155', 'Side bag Inzta XSR 155', 150000, 175000, { badge: 'BEST SELLER', createdAt: 4000, kategoriMotor: ['retro'] }),
  simple('tankbag-tunnelbag-matic', 'Tankbag Tunnelbag Matic', 370000, 420000, { badge: 'NEW', createdAt: 9000, kategoriMotor: ['matic'] }),
  simple('tankbag-and-tailbag-wanderpack-10l', 'Tankbag and Tailbag wanderpack 10L', 390000, 450000, { createdAt: 3000 }),
  simple('sidebag-foldpack-z20', 'Sidebag Foldpack Z20', 790000, 850000, { createdAt: null }),
  simple('acc-pounch-inzta-travel-pack', 'Acc Pounch Inzta Travel pack', 100000, null, { createdAt: 2000 }),
  simple('inzta-waistbag-rc-1', 'Inzta Waistbag RC 1', 200000, null, { createdAt: 1000, kategoriMotor: ['matic', 'adventure', 'retro', 'trail'] }),
  simple('extend-bag-inzta-wheelbox-10l', 'Extend bag Inzta Wheelbox 10L', 500000, 340000, { createdAt: 8000 }),
  simple('costum-image-prodak', 'Costum image prodak', 0, null, { createdAt: 7000 }),
];
const ITEMS = P.map(F.toCatalogItem);
const slugs = list => list.map(i => i.card.slug);
const q = s => F.parseQuery(new URLSearchParams(s));
const st = over => ({ ...F.DEFAULT_STATE, ...over });

check('toCatalogItem: positions (incl. the second position of Wanderpack), labels, discount, category', () => {
  const by = Object.fromEntries(ITEMS.map(i => [i.card.slug, i]));
  assert.deepStrictEqual(by['tankbag-and-tailbag-wanderpack-10l'].positions, ['tank', 'tail']);
  assert.deepStrictEqual(by['acc-pounch-inzta-travel-pack'].positions, ['aksesori']);
  assert.deepStrictEqual(by['inzta-waistbag-rc-1'].positions, ['harian']);
  assert.deepStrictEqual(by['extend-bag-inzta-wheelbox-10l'].positions, ['extend']);
  assert.strictEqual(by['tankbag-tk-5'].best, true);
  assert.strictEqual(by['tankbag-tk-5'].baru, false);
  assert.strictEqual(by['tankbag-tunnelbag-matic'].baru, true);
  assert.strictEqual(by['tankbag-tk-5'].discounted, true);
  assert.strictEqual(by['extend-bag-inzta-wheelbox-10l'].discounted, false, 'compare-at below price is no discount');
  assert.strictEqual(by['acc-pounch-inzta-travel-pack'].discounted, false);
  assert.deepStrictEqual(by['side-bag-inzta-xsr-155'].kategori, ['retro']);
  assert.deepStrictEqual(by['tankbag-tk-5'].kategori, []);
  assert.strictEqual(by['sidebag-foldpack-z20'].createdAt, null);
});

check('parseQuery: known values only, deduped, display order; unknown values ignored (S2.2.2)', () => {
  assert.deepStrictEqual(q(''), F.DEFAULT_STATE);
  assert.deepStrictEqual(q('posisi=side,tank,side,helm&motor=retro&harga=200rb-500rb&label=diskon,best-seller,x&urut=terbaru'), {
    posisi: ['tank', 'side'], motor: 'retro', harga: '200rb-500rb', label: ['best-seller', 'diskon'], urut: 'terbaru',
  });
  assert.deepStrictEqual(q('posisi=helm&motor=vespa&harga=murah&label=promo&urut=acak'), F.DEFAULT_STATE);
  assert.deepStrictEqual(q('urut=sesuai'), F.DEFAULT_STATE);
  assert.deepStrictEqual(q('posisi=SIDE').posisi, ['side']);
});

check('writeQuery: canonical keys, default sort omitted, other parameters kept (S2.2.2, ?aff=)', () => {
  assert.strictEqual(F.writeQuery('', F.DEFAULT_STATE), '');
  assert.strictEqual(
    F.writeQuery('', st({ posisi: ['tank', 'side'], motor: 'retro', harga: 'atas-500rb', label: ['baru'], urut: 'harga-terendah' })),
    'posisi=tank,side&motor=retro&harga=atas-500rb&label=baru&urut=harga-terendah',
  );
  assert.strictEqual(F.writeQuery('aff=ABC&posisi=tail', st({ posisi: ['side'] })), 'aff=ABC&posisi=side');
  assert.strictEqual(F.writeQuery('aff=ABC&posisi=tail&urut=terbaru', F.DEFAULT_STATE), 'aff=ABC');
  const s = st({ posisi: ['tail', 'extend'], label: ['diskon'], urut: 'terbaru' });
  assert.deepStrictEqual(q(F.writeQuery('', s)), s, 'round trip');
});

check('matches: OR within a group, AND across groups; second position matches (S2.2.3)', () => {
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ posisi: ['tail'] })))), ['tankbag-and-tailbag-wanderpack-10l']);
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ posisi: ['tank'] })))).sort(), ['tankbag-and-tailbag-wanderpack-10l', 'tankbag-tk-5', 'tankbag-tunnelbag-matic']);
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ posisi: ['tank', 'side'] })))).length, 5);
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ posisi: ['tank'], label: ['best-seller', 'baru'] })))).sort(), ['tankbag-tk-5', 'tankbag-tunnelbag-matic']);
});

check('matches: price bands on the effective price, bounds inclusive in the middle band, price 0 never matches', () => {
  const band = h => slugs(ITEMS.filter(i => F.matches(i, st({ harga: h })))).sort();
  assert.deepStrictEqual(band('bawah-200rb'), ['acc-pounch-inzta-travel-pack', 'side-bag-inzta-xsr-155']);
  assert.deepStrictEqual(band('200rb-500rb'), ['extend-bag-inzta-wheelbox-10l', 'inzta-waistbag-rc-1', 'tankbag-and-tailbag-wanderpack-10l', 'tankbag-tk-5', 'tankbag-tunnelbag-matic']);
  assert.deepStrictEqual(band('atas-500rb'), ['sidebag-foldpack-z20']);
});

check('matches: motor filter reads the stored kategoriMotor (D2), universal products included', () => {
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ motor: 'retro' })))).sort(), ['inzta-waistbag-rc-1', 'side-bag-inzta-xsr-155']);
  assert.deepStrictEqual(slugs(ITEMS.filter(i => F.matches(i, st({ motor: 'trail' })))), ['inzta-waistbag-rc-1']);
});

check('sort "Paling sesuai": chosen category first, then best sellers, then newest, missing dates last (S2.4.1)', () => {
  assert.deepStrictEqual(slugs(F.sortItems(ITEMS, F.DEFAULT_STATE)), [
    'tankbag-tk-5', 'side-bag-inzta-xsr-155',
    'tankbag-tunnelbag-matic', 'extend-bag-inzta-wheelbox-10l', 'costum-image-prodak', 'tankbag-and-tailbag-wanderpack-10l',
    'acc-pounch-inzta-travel-pack', 'inzta-waistbag-rc-1', 'sidebag-foldpack-z20',
  ]);
  assert.deepStrictEqual(slugs(F.sortItems(ITEMS, st({ motor: 'matic' }))).slice(0, 3), ['tankbag-tunnelbag-matic', 'inzta-waistbag-rc-1', 'tankbag-tk-5']);
});

check('sort by price (ties newest first, no price last) and "Terbaru" (S2.4.2)', () => {
  const low = slugs(F.sortItems(ITEMS, st({ urut: 'harga-terendah' })));
  assert.deepStrictEqual(low.slice(0, 3), ['acc-pounch-inzta-travel-pack', 'side-bag-inzta-xsr-155', 'inzta-waistbag-rc-1']);
  assert.strictEqual(low[low.length - 1], 'costum-image-prodak');
  const high = slugs(F.sortItems(ITEMS, st({ urut: 'harga-tertinggi' })));
  assert.strictEqual(high[0], 'sidebag-foldpack-z20');
  assert.strictEqual(high[high.length - 1], 'costum-image-prodak');
  const tie = [simple('a', 'Tankbag A', 300000, null, { createdAt: 1 }), simple('b', 'Tankbag B', 300000, null, { createdAt: 2 })].map(F.toCatalogItem);
  assert.deepStrictEqual(slugs(F.sortItems(tie, st({ urut: 'harga-terendah' }))), ['b', 'a']);
  const newest = slugs(F.sortItems(ITEMS, st({ urut: 'terbaru' })));
  assert.deepStrictEqual(newest.slice(0, 2), ['tankbag-tunnelbag-matic', 'extend-bag-inzta-wheelbox-10l']);
  assert.strictEqual(newest[newest.length - 1], 'sidebag-foldpack-z20');
});

check('optionCount: counts within the other active groups; drives "(0)" (S2.2.5)', () => {
  const s = st({ posisi: ['tail'] });
  assert.strictEqual(F.optionCount(ITEMS, s, 'label', 'best-seller'), 0);
  assert.strictEqual(F.optionCount(ITEMS, s, 'label', 'diskon'), 1);
  assert.strictEqual(F.optionCount(ITEMS, s, 'harga', 'atas-500rb'), 0);
  assert.strictEqual(F.optionCount(ITEMS, s, 'motor', 'retro'), 0);
  // The group itself is replaced, not added to: with posisi=tail selected, "Side bag" still counts side bags.
  assert.strictEqual(F.optionCount(ITEMS, s, 'posisi', 'side'), 2);
});

check('active chips, removal, "Hapus semua" keeps the sort (S2.3.1)', () => {
  const s = st({ posisi: ['side', 'tank'], motor: 'retro', harga: 'bawah-200rb', label: ['diskon'], urut: 'terbaru' });
  const chips = F.activeChips(s, c => c[0].toUpperCase() + c.slice(1));
  assert.deepStrictEqual(chips.map(c => c.label), ['Retro', 'Tank bag', 'Side bag', 'Di bawah Rp200.000', 'Diskon']);
  assert.deepStrictEqual(F.removeValue(s, 'posisi', 'tank').posisi, ['side']);
  assert.strictEqual(F.removeValue(s, 'motor', 'retro').motor, null);
  assert.strictEqual(F.removeValue(s, 'harga', 'bawah-200rb').harga, null);
  assert.deepStrictEqual(F.clearFilters(s), st({ urut: 'terbaru' }));
  assert.strictEqual(F.totalActive(s), 5);
  assert.strictEqual(F.activeCount(s, 'posisi'), 2);
  assert.deepStrictEqual(F.activeChips(F.DEFAULT_STATE, String), []);
});

check('toggleList keeps display order; urut labels', () => {
  assert.deepStrictEqual(F.toggleList(['side'], 'tank', F.POSISI_OPTIONS), ['tank', 'side']);
  assert.deepStrictEqual(F.toggleList(['tank', 'side'], 'tank', F.POSISI_OPTIONS), ['side']);
  assert.strictEqual(F.urutLabel('sesuai'), 'Paling sesuai');
  assert.strictEqual(F.urutLabel('harga-tertinggi'), 'Harga tertinggi');
});

check('help card after the 8th card, or the last one when fewer, none when empty (S2.4.3); pages of 12 (S2.5)', () => {
  assert.strictEqual(F.helpCardIndex(32), 7);
  assert.strictEqual(F.helpCardIndex(12), 7);
  assert.strictEqual(F.helpCardIndex(8), 7);
  assert.strictEqual(F.helpCardIndex(3), 2);
  assert.strictEqual(F.helpCardIndex(0), -1);
  assert.strictEqual(F.PAGE_SIZE, 12);
});

check('stateKey ignores value order and default sort', () => {
  assert.strictEqual(F.stateKey(st({ posisi: ['tank', 'side'] })), F.stateKey(q('posisi=side,tank&urut=sesuai')));
  assert.ok(F.sameState(F.DEFAULT_STATE, q('motor=vespa')));
});

// Server render of the catalog components (react-dom/server) with next/link, next/image, and the closing panel
// stubbed, so the empty and fallback states are checked without a dev server.
const React = require(path.join(ROOT, 'node_modules/react'));
const { renderToStaticMarkup } = require(path.join(ROOT, 'node_modules/react-dom/server'));
STUBS.set('next/link', { __esModule: true, default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) });
STUBS.set('next/image', { __esModule: true, default: ({ fill, priority, ...rest }) => React.createElement('img', rest) });
STUBS.set(path.join(ROOT, 'components/v2/Closing'), { __esModule: true, default: () => React.createElement('div', { className: 'iz-wrap' }, 'closing') });
const CatalogPage = require(path.join(ROOT, 'components/v2/catalog/CatalogPage.tsx')).default;
const CatalogBody = require(path.join(ROOT, 'components/v2/catalog/CatalogBody.tsx')).default;
const WA = 'https://wa.me/6289513482410';
const html = el => renderToStaticMarkup(el);

check('render: 0 active products shows "Belum ada produk." + Chat admin, no lead, no filter bar (S2.1.2, S2.6.2)', () => {
  const out = html(React.createElement(CatalogPage, { items: [], waHref: WA }));
  assert.match(out, /<h1 class="t-h1-shop">Semua tas motor INZTA<\/h1>/);
  assert.doesNotMatch(out, /t-lead/);
  assert.doesNotMatch(out, /iz-filters/);
  assert.match(out, /iz-empty__title">Belum ada produk\.</);
  assert.match(out, /<a class="iz-btn iz-btn--primary" href="https:\/\/wa\.me\/6289513482410" target="_blank" rel="noopener noreferrer">Chat admin<\/a>/);
});

check('render: Suspense fallback lists every product (h2 names), help card after the 8th, "Muat lagi" hidden (S2.2.8, S2.5.1, S0.9.6)', () => {
  const many = Array.from({ length: 14 }, (_, i) => simple(`tankbag-${i}`, `Tankbag Nomor ${i}`, 100000 + i, null, { createdAt: i }));
  const items = many.map(F.toCatalogItem);
  const out = html(React.createElement(CatalogBody, { items, waHref: WA }));
  const names = [...out.matchAll(/<h2 class="iz-pcard__name">([^<]*)<\/h2>/g)].map(m => m[1]);
  assert.strictEqual(names.length, 14);
  const grid = out.slice(out.indexOf('iz-catalog__grid'));
  assert.ok(grid.indexOf('Tankbag Nomor 6') < grid.indexOf('iz-helpcard') && grid.indexOf('iz-helpcard') < grid.indexOf('Tankbag Nomor 5'), 'help card after the 8th card (newest first)');
  assert.match(out, /<div class="iz-catalog__more" hidden="">/);
  assert.match(out, /Menampilkan 14 dari 14 produk/);
  assert.match(out, /<div class="iz-row" style="gap:10px" hidden="">/);
});

check('render: filters that match nothing show the filtered EmptyState with "Hapus semua filter" and Chat admin (S2.6.1)', () => {
  const out = html(React.createElement(CatalogBody, { items: ITEMS, waHref: WA, state: st({ posisi: ['extend'], harga: 'atas-500rb', urut: 'terbaru' }), search: 'posisi=extend&harga=atas-500rb&urut=terbaru' }));
  assert.match(out, /iz-empty__title">Tidak ada tas yang sesuai filter\.</);
  assert.match(out, /href="\/produk\?urut=terbaru"[^>]*>Hapus semua filter<\/a>/);
  assert.match(out, /Chat admin<\/a>/);
  assert.doesNotMatch(out, /iz-catalog__grid/);
  assert.match(out, /Menampilkan 0 dari 0 produk/);
});

const src = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

check('route contract: ISR 3600, no force-dynamic, no server searchParams, no catch that renders an empty list (S2.7, S2.2.8)', () => {
  // Comments may name what the route no longer does, so only code is checked.
  const page = src('app/produk/(katalog)/page.tsx').replace(/^\s*\/\/.*$/gm, '');
  assert.match(page, /export const revalidate = 3600;/);
  assert.doesNotMatch(page, /force-dynamic|searchParams|catch\s*\(/);
  assert.match(page, /getActiveProducts\(\)/);
  assert.match(page, /canonical: canonicalUrl\('produk'\)/); // F-005: absolute canonical, query never part of it
  assert.match(page, /title: 'Semua tas motor INZTA'/);
  const shell = src('components/v2/catalog/CatalogPage.tsx');
  assert.match(shell, /<Suspense fallback={<CatalogBody /);
  assert.match(src('components/v2/catalog/CatalogQuery.tsx'), /useSearchParams\(\)/);
  assert.doesNotMatch(src('components/v2/catalog/CatalogBody.tsx'), /useSearchParams/);
  assert.ok(fs.existsSync(path.join(ROOT, 'app/produk/(katalog)/loading.tsx')));
  assert.match(src('app/produk/error.tsx'), /current="produk"/);
});

check('route: a failed product read rejects the page render instead of rendering an empty list (S2.7.2)', async () => {
  const stub = (rel, exports) => STUBS.set(path.join(ROOT, rel), exports);
  const boom = new Error('firestore unavailable');
  stub('lib/public-content', { getActiveProducts: async () => { throw boom; } });
  stub('components/v2/V2Layout', { __esModule: true, default: () => null });
  stub('components/v2/catalog/CatalogPage', { __esModule: true, default: () => null });
  const page = require(path.join(ROOT, 'app/produk/(katalog)/page.tsx'));
  await assert.rejects(() => page.default(), e => e === boom);
  assert.strictEqual(page.revalidate, 3600);
});

check('route: the dev fixture switch F016_STATE=error throws through getActiveProducts (local error state)', () => {
  const D = require(path.join(ROOT, 'lib/v2/dev-fixture.ts'));
  const env = { NODE_ENV: 'development', F016_FIXTURE: __filename, F016_STATE: 'error' };
  assert.throws(() => D.fixtureProducts(env), /forced error/);
  assert.deepStrictEqual(D.fixtureProducts({ ...env, F016_STATE: 'empty' }), []);
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
