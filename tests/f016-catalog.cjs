// F-016 S2 Katalog: filter, sort, and query logic (components/v2/catalog/filter.ts), the catalogue components, and
// the /produk route contract (ISR, client-only query, a failed read throws). Requirements S2.2.2–S2.2.4, S2.2.8, S2.3,
// S2.4.1–S2.4.3, S2.5, S2.7.1–S2.7.3, plus the large-catalogue filter design (heading and one count, per-tick apply,
// live option counts, empty-state recovery, ?tampil=, 500-product scale check).
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

// Large-catalogue design (filter UX for production): heading and one count, per-tick reducer, one-pass option
// counts, empty-state recovery, ?tampil=, slug fallback for positions, and a 500-product scale check.
const label = c => c[0].toUpperCase() + c.slice(1);

check('catalogHeading: "Semua" only without filters; positions, motor, and the neutral fallback', () => {
  assert.strictEqual(F.catalogHeading(F.DEFAULT_STATE, label), 'Semua tas motor INZTA');
  assert.strictEqual(F.catalogHeading(st({ urut: 'terbaru' }), label), 'Semua tas motor INZTA', 'sort is not a filter');
  assert.strictEqual(F.catalogHeading(st({ posisi: ['tank'] }), label), 'Tank bag');
  assert.strictEqual(F.catalogHeading(st({ posisi: ['side', 'tank'] }), label), 'Tank bag dan Side bag');
  assert.strictEqual(F.catalogHeading(st({ posisi: ['tank', 'side', 'tail'] }), label), 'Tas motor INZTA');
  assert.strictEqual(F.catalogHeading(st({ motor: 'retro' }), label), 'Tas untuk motor Retro');
  assert.strictEqual(F.catalogHeading(st({ posisi: ['tank'], motor: 'retro' }), label), 'Tank bag untuk motor Retro');
  assert.strictEqual(F.catalogHeading(st({ harga: 'bawah-200rb' }), label), 'Tas motor INZTA');
  assert.strictEqual(F.catalogHeading(st({ posisi: ['tank'], label: ['diskon'] }), label), 'Tas motor INZTA');
});

check('catalogLead: one count; the green-mark sentence only with a chosen motor category', () => {
  assert.strictEqual(F.catalogLead(5, false), '5 produk.');
  assert.strictEqual(F.catalogLead(5, true), '5 produk. Tas yang dibuat untuk motor Anda ditandai hijau.');
  assert.strictEqual(F.positionPhrase(st({ posisi: ['aksesori'] })), 'aksesori touring');
  assert.strictEqual(F.positionPhrase(st({ posisi: ['tank', 'side'] })), 'tas');
  assert.strictEqual(F.positionPhrase(F.DEFAULT_STATE), 'tas');
});

check('reduceFilter: toggle keeps display order, "Semua harga" sets null, clearGroup, clearAll keeps sort and ?aff=', () => {
  let s = F.reduceFilter(F.DEFAULT_STATE, { type: 'toggle', group: 'posisi', value: 'side' });
  s = F.reduceFilter(s, { type: 'toggle', group: 'posisi', value: 'tank' });
  assert.deepStrictEqual(s.posisi, ['tank', 'side']);
  s = F.reduceFilter(s, { type: 'set', group: 'harga', value: 'atas-500rb' });
  assert.strictEqual(s.harga, 'atas-500rb');
  assert.strictEqual(F.reduceFilter(s, { type: 'set', group: 'harga', value: null }).harga, null);
  assert.deepStrictEqual(F.reduceFilter(s, { type: 'clearGroup', group: 'posisi' }).posisi, []);
  s = F.reduceFilter(s, { type: 'urut', value: 'terbaru' });
  const cleared = F.reduceFilter({ ...s, motor: 'retro', label: ['diskon'] }, { type: 'clearAll' });
  assert.deepStrictEqual(cleared, st({ urut: 'terbaru' }));
  assert.strictEqual(F.writeQuery('aff=ABC&posisi=tank&tampil=24', cleared), 'aff=ABC&urut=terbaru');
  assert.strictEqual(F.reduceFilter(s, { type: 'toggle', group: 'motor', value: 'retro' }).motor, 'retro');
  assert.strictEqual(F.reduceFilter({ ...s, motor: 'retro' }, { type: 'toggle', group: 'motor', value: 'retro' }).motor, null);
  assert.deepStrictEqual(F.reduceFilter(st({ label: ['baru', 'diskon'] }), { type: 'remove', group: 'label', value: 'baru' }).label, ['diskon']);
});

check('reduceFilter: unknown values and no-op changes return the same object (no URL write, no re-render)', () => {
  const s = st({ posisi: ['tank'] });
  assert.strictEqual(F.reduceFilter(s, { type: 'toggle', group: 'posisi', value: 'helm' }), s);
  assert.strictEqual(F.reduceFilter(s, { type: 'set', group: 'harga', value: 'murah' }), s);
  assert.strictEqual(F.reduceFilter(s, { type: 'toggle', group: 'motor', value: 'vespa' }), s);
  assert.strictEqual(F.reduceFilter(s, { type: 'urut', value: 'acak' }), s);
  assert.strictEqual(F.reduceFilter(s, { type: 'clearGroup', group: 'label' }), s);
  assert.strictEqual(F.reduceFilter(s, { type: 'replace', state: st({ posisi: ['tank'] }) }), s);
});

check('reduceFilter: two quick ticks applied one after the other both survive (race regression)', () => {
  // The old code built each next state from the rendered prop, so the second tick dropped the first.
  const ticks = [
    { type: 'toggle', group: 'posisi', value: 'tank' },
    { type: 'toggle', group: 'label', value: 'diskon' },
    { type: 'toggle', group: 'posisi', value: 'tail' },
  ];
  const s = ticks.reduce(F.reduceFilter, F.DEFAULT_STATE);
  assert.deepStrictEqual(s, st({ posisi: ['tank', 'tail'], label: ['diskon'] }));
  const stale = ticks.map(t => F.reduceFilter(F.DEFAULT_STATE, t)).pop();
  assert.notDeepStrictEqual(stale, s, 'reference: starting each tick from the same old state loses changes');
});

// Every combination the fixture filters can make: posisi subsets of size 0 to 2, every harga, label subsets, motor.
function* allStates() {
  const pos = F.POSISI_OPTIONS.map(o => o.value);
  const posSets = [[]];
  for (let i = 0; i < pos.length; i++) {
    posSets.push([pos[i]]);
    for (let j = i + 1; j < pos.length; j++) posSets.push([pos[i], pos[j]]);
  }
  const labels = F.LABEL_OPTIONS.map(o => o.value);
  const labelSets = [[]];
  for (let m = 1; m < 1 << labels.length; m++) labelSets.push(labels.filter((_, i) => m & (1 << i)));
  for (const posisi of posSets)
    for (const harga of [null, ...F.HARGA_OPTIONS.map(o => o.value)])
      for (const lab of labelSets)
        for (const motor of [null, 'matic', 'adventure', 'retro', 'trail']) yield st({ posisi, harga, label: lab, motor });
}

function assertFacetsMatchBruteForce(items, state) {
  const f = F.facetCounts(items, state);
  assert.strictEqual(f.total, F.applyCatalog(items, state).length, `total ${F.stateKey(state)}`);
  for (const o of F.POSISI_OPTIONS) assert.strictEqual(f.posisi[o.value], F.optionCount(items, state, 'posisi', o.value), `posisi ${o.value} @ ${F.stateKey(state)}`);
  for (const o of F.HARGA_OPTIONS) assert.strictEqual(f.harga[o.value], F.optionCount(items, state, 'harga', o.value), `harga ${o.value} @ ${F.stateKey(state)}`);
  for (const o of F.LABEL_OPTIONS) assert.strictEqual(f.label[o.value], F.optionCount(items, state, 'label', o.value), `label ${o.value} @ ${F.stateKey(state)}`);
  for (const c of ['matic', 'adventure', 'retro', 'trail']) assert.strictEqual(f.motor[c], F.optionCount(items, state, 'motor', c), `motor ${c} @ ${F.stateKey(state)}`);
  assert.strictEqual(f.hargaAll, F.applyCatalog(items, { ...state, harga: null }).length, `hargaAll ${F.stateKey(state)}`);
}

check('facetCounts (one pass) equals optionCount (brute force) for every option in every fixture state', () => {
  let n = 0;
  for (const s of allStates()) {
    assertFacetsMatchBruteForce(ITEMS, s);
    n++;
  }
  assert.ok(n > 2000, `${n} states`);
});

// A product without any position keyword: no posisi option, still listed unfiltered and by price.
const NO_POS = F.toCatalogItem(simple('helm-cover-x', 'Helm cover X', 150000, null, { createdAt: 6000 }));

check('a product with no position is in every unfiltered and non-posisi result, never under a posisi option', () => {
  const items = [...ITEMS, NO_POS];
  assert.deepStrictEqual(NO_POS.positions, []);
  assert.ok(slugs(F.applyCatalog(items, F.DEFAULT_STATE)).includes('helm-cover-x'));
  assert.ok(slugs(F.applyCatalog(items, st({ harga: 'bawah-200rb' }))).includes('helm-cover-x'));
  const f = F.facetCounts(items, F.DEFAULT_STATE);
  const base = F.facetCounts(ITEMS, F.DEFAULT_STATE);
  assert.deepStrictEqual(f.posisi, base.posisi);
  assert.strictEqual(f.harga['bawah-200rb'], base.harga['bawah-200rb'] + 1);
  assert.strictEqual(f.total, base.total + 1);
});

check('availability: options no product has are hidden unless selected; a group without options is hidden', () => {
  const noLabels = ITEMS.filter(i => !i.best && !i.baru && !i.discounted);
  const avail = F.availability(noLabels);
  assert.strictEqual(F.isOptionVisible('label', 'diskon', avail, F.DEFAULT_STATE), false);
  assert.strictEqual(F.isGroupVisible('label', avail, F.DEFAULT_STATE), false);
  // An old ad link with ?label=diskon keeps the option, checked, so it can be turned off.
  assert.strictEqual(F.isOptionVisible('label', 'diskon', avail, st({ label: ['diskon'] })), true);
  assert.strictEqual(F.isGroupVisible('label', avail, st({ label: ['diskon'] })), true);
  const full = F.availability(ITEMS);
  assert.strictEqual(F.isOptionVisible('posisi', 'tail', full, F.DEFAULT_STATE), true);
  // Contextually 0 (tail + best seller) is still visible: hiding depends on the catalogue, not the state.
  assert.strictEqual(F.optionCount(ITEMS, st({ posisi: ['tail'] }), 'label', 'best-seller'), 0);
  assert.strictEqual(F.isOptionVisible('label', 'best-seller', full, st({ posisi: ['tail'] })), true);
});

check('kept selection: an option shown only because it was selected stays after it is unticked (no unmount under focus)', () => {
  const noLabels = ITEMS.filter(i => !i.best && !i.baru && !i.discounted);
  const avail = F.availability(noLabels);
  assert.deepStrictEqual(F.selectionKeys(st({ posisi: ['tank'], motor: 'retro', harga: 'atas-500rb', label: ['diskon'] })), ['posisi:tank', 'label:diskon', 'motor:retro', 'harga:atas-500rb']);
  // ?label=diskon was applied, then unticked: the current state no longer has it, the kept set does.
  const kept = new Set(F.selectionKeys(st({ label: ['diskon'] })));
  assert.strictEqual(F.isOptionVisible('label', 'diskon', avail, F.DEFAULT_STATE), false, 'reference: the current state alone would drop the row');
  assert.strictEqual(F.isOptionVisible('label', 'diskon', avail, kept), true);
  assert.strictEqual(F.isGroupVisible('label', avail, kept), true);
  assert.strictEqual(F.isOptionVisible('label', 'baru', avail, kept), false, 'never-selected empty options stay hidden');
  const untagged = ITEMS.filter(i => !i.kategori.includes('trail'));
  assert.strictEqual(F.isOptionVisible('motor', 'trail', F.availability(untagged), new Set(['motor:trail'])), true);
});

check('relaxGroup: the group whose removal restores the most; ties keep posisi longest; null when nothing is active', () => {
  assert.strictEqual(F.relaxGroup(ITEMS, F.DEFAULT_STATE), null);
  assert.strictEqual(F.relaxGroup(ITEMS, st({ urut: 'terbaru' })), null);
  // posisi=tail & best seller: without label 1 product (Wanderpack), without posisi 2 best sellers.
  assert.strictEqual(F.relaxGroup(ITEMS, st({ posisi: ['tail'], label: ['best-seller'] })), 'posisi');
  // extend & above 500k: both removals give 1 product; harga is dropped before posisi.
  assert.strictEqual(F.relaxGroup(ITEMS, st({ posisi: ['extend'], harga: 'atas-500rb' })), 'harga');
  // tank & retro: without motor 3 tank bags, without posisi 2 retro products.
  assert.strictEqual(F.relaxGroup(ITEMS, st({ posisi: ['tank'], motor: 'retro' })), 'motor');
});

check('relaxGroup: null when every single-group removal is still empty, so no button leads to a second empty state', () => {
  // extend & above 500k & best seller: without posisi 0, without harga 0, without label 0 (500.000 is not above).
  const a = st({ posisi: ['extend'], harga: 'atas-500rb', label: ['best-seller'] });
  for (const g of ['posisi', 'harga', 'label']) assert.strictEqual(F.applyCatalog(ITEMS, F.clearGroup(a, g)).length, 0, g);
  assert.strictEqual(F.relaxGroup(ITEMS, a), null);
  // QA repro: tank & above 500k & retro; the tie-break used to pick harga with a restore of 0.
  assert.strictEqual(F.relaxGroup(ITEMS, st({ posisi: ['tank'], harga: 'atas-500rb', motor: 'retro' })), null);
  const copy = F.emptyCopy(a, null, label);
  assert.strictEqual(copy.relaxLabel, null);
  assert.strictEqual(copy.showClearAll, true, '"Hapus semua filter" becomes the primary action');
  assert.strictEqual(copy.title, 'Tidak ada tas yang sesuai filter.');
  // Whenever relaxGroup names a group, removing it brings products back, in every fixture state.
  for (const s of allStates()) {
    if (F.applyCatalog(ITEMS, s).length) continue;
    const g = F.relaxGroup(ITEMS, s);
    if (g) assert.ok(F.applyCatalog(ITEMS, F.clearGroup(s, g)).length > 0, F.stateKey(s));
    else assert.ok(F.totalActive(s) > 1, `a single group always restores the catalogue: ${F.stateKey(s)}`);
  }
});

check('nearestItems: at most 4, without the relax group first, then the same positions, then the whole catalogue', () => {
  const a = F.nearestItems(ITEMS, st({ posisi: ['extend'], harga: 'atas-500rb' }));
  assert.strictEqual(a.kind, 'relax');
  assert.deepStrictEqual(slugs(a.items), ['extend-bag-inzta-wheelbox-10l']);
  assert.strictEqual(a.heading, 'Tanpa filter Harga: 1 produk');
  assert.deepStrictEqual(a.state, st({ posisi: ['extend'] }));
  // Removing any one group still gives 0, so the same position only is next.
  const b = F.nearestItems(ITEMS, st({ posisi: ['extend'], harga: 'atas-500rb', label: ['best-seller'] }));
  assert.strictEqual(b.kind, 'posisi');
  assert.strictEqual(b.heading, 'Extend bag lainnya');
  assert.deepStrictEqual(b.state, st({ posisi: ['extend'] }));
  const d = F.nearestItems(ITEMS, st({ harga: 'atas-500rb', label: ['best-seller'], motor: 'trail' }));
  assert.ok(d.items.length >= 1 && d.items.length <= 4);
  // No daily bag at all and no single removal helps: the whole catalogue in the current sort.
  const noHarian = ITEMS.filter(i => i.positions.length && !i.positions.includes('harian'));
  const all = F.nearestItems(noHarian, st({ posisi: ['harian'], harga: 'atas-500rb', label: ['best-seller'] }));
  assert.strictEqual(all.kind, 'all');
  assert.strictEqual(all.heading, 'Produk lain');
  assert.strictEqual(all.items.length, 4);
});

check('emptyCopy: motor variant names the position and the motor; default names the active filters', () => {
  const m = F.emptyCopy(st({ posisi: ['tank'], motor: 'retro' }), 'motor', label);
  assert.strictEqual(m.title, 'Belum ada tank bag yang ditandai untuk motor Retro.');
  assert.strictEqual(m.text, 'Penandaan motor masih kami lengkapi. Admin bisa bantu cek tas yang cocok.');
  assert.strictEqual(m.relaxLabel, 'Lihat semua tank bag');
  assert.strictEqual(m.showClearAll, true);
  const only = F.emptyCopy(st({ motor: 'trail' }), 'motor', label);
  assert.strictEqual(only.title, 'Belum ada tas yang ditandai untuk motor Trail.');
  assert.strictEqual(only.relaxLabel, 'Lihat semua tas');
  assert.strictEqual(only.showClearAll, false, 'one group: "Hapus semua filter" would do the same');
  assert.strictEqual(F.emptyCopy(st({ posisi: ['tank'], motor: 'retro', harga: 'atas-500rb' }), 'motor', label).relaxLabel, 'Hapus filter Motor saya');
  const d = F.emptyCopy(st({ posisi: ['tank'], harga: 'atas-500rb', label: ['diskon'] }), 'harga', label);
  assert.strictEqual(d.title, 'Tidak ada tas yang sesuai filter.');
  assert.strictEqual(d.text, 'Filter aktif: Tank bag, Di atas Rp500.000, Diskon.');
  assert.strictEqual(d.relaxLabel, 'Hapus filter Di atas Rp500.000');
  assert.strictEqual(F.emptyCopy(st({ label: ['diskon', 'baru'], harga: 'atas-500rb' }), 'label', label).relaxLabel, 'Hapus filter Label');
});

check('parseShown: whole pages of 12 only, clamped to the result; writeQuery writes and drops ?tampil=', () => {
  assert.strictEqual(F.parseShown('24'), 24);
  assert.strictEqual(F.parseShown('24', 30), 24);
  assert.strictEqual(F.parseShown('48', 30), 36);
  for (const bad of ['25', '-12', 'abc', '9999', '', null, '0', '12.0', '1e3']) assert.strictEqual(F.parseShown(bad, 400), 12, String(bad));
  assert.strictEqual(F.writeQuery('aff=X', st({ posisi: ['tank'] }), 24), 'aff=X&posisi=tank&tampil=24');
  assert.strictEqual(F.writeQuery('aff=X&tampil=24', st({ posisi: ['tank'] }), 12), 'aff=X&posisi=tank', 'first page is never written');
  assert.strictEqual(F.writeQuery('aff=X&tampil=24', st({ posisi: ['side'] })), 'aff=X&posisi=side', 'a filter change drops it');
  assert.strictEqual(F.stateKey(F.parseQuery(new URLSearchParams('posisi=tank&tampil=24'))), 'posisi=tank');
});

check('positionsOf: slug fallback for names without a keyword; the slug override still wins', () => {
  const H = require(path.join(ROOT, 'lib/v2/home-data.ts'));
  assert.deepStrictEqual(H.positionsOf({ slug: 'tankbag-x', name: 'Tas Tangki X' }), ['tank']);
  assert.deepStrictEqual(H.positionsOf({ slug: 'tas-samping-sidebag-y', name: 'Tas Samping Y' }), ['side']);
  assert.deepStrictEqual(H.positionsOf({ slug: 'xbags-tas-bagasi-xmax', name: 'Xbags, tas bagasi xmax' }), []);
  // Single words are read from the name only; in a slug they are too loose.
  assert.deepStrictEqual(H.positionsOf({ slug: 'daily', name: 'Tas harian Boba' }), []);
  assert.deepStrictEqual(H.positionsOf({ slug: 'acc-x', name: 'Kantong X' }), []);
  assert.deepStrictEqual(H.positionsOf({ slug: 'side-bag-z', name: 'Tankbag Z' }), ['tank'], 'the name wins over the slug');
});

check('fixture coverage: unmapped products are listed as info, not a failure', () => {
  // The fixture lives outside the repo; its path comes from the environment of the shell running the test.
  const file = process.env.F016_FIXTURE;
  if (!file || !fs.existsSync(file)) {
    console.log('INFO  fixture coverage skipped: F016_FIXTURE is not set in this shell');
    return;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.products || [];
  const unmapped = list.filter(p => p && p.slug && p.name && p.isActive !== false).map(F.toCatalogItem).filter(i => !i.positions.length);
  console.log(`INFO  fixture: ${list.length} products, ${unmapped.length} without a position${unmapped.length ? ': ' + unmapped.map(i => i.card.name).join('; ') : ''}`);
});

// Seeded generator, so every run checks the same 500 products.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const rand = rng(16);
const pick = list => list[Math.floor(rand() * list.length)];
const NAMES = ['Tankbag', 'Side bag', 'Tail bag', 'Extend bag', 'Acc Pouch', 'Waist bag', 'Tas Kurir', 'Sling bag', 'Botol holder'];
const BADGES = [null, null, null, 'BEST SELLER', 'NEW', 'Baru'];
const BIG = Array.from({ length: 500 }, (_, i) => {
  const price = rand() < 0.03 ? 0 : 50000 + Math.round(rand() * 60) * 10000;
  const compare = rand() < 0.3 ? price + 50000 : null;
  const cats = ['matic', 'adventure', 'retro', 'trail'].filter(() => rand() < 0.25);
  const name = `${pick(NAMES)} Seri ${i}`;
  return simple(`gen-${i}`, name, price, compare, { badge: pick(BADGES), createdAt: rand() < 0.1 ? null : Math.floor(rand() * 1e6), kategoriMotor: cats });
}).map(F.toCatalogItem);

function randomState() {
  const posisi = F.POSISI_OPTIONS.map(o => o.value).filter(() => rand() < 0.2);
  const label = F.LABEL_OPTIONS.map(o => o.value).filter(() => rand() < 0.15);
  const harga = rand() < 0.4 ? pick(F.HARGA_OPTIONS).value : null;
  const motor = rand() < 0.3 ? pick(['matic', 'adventure', 'retro', 'trail']) : null;
  const urut = pick(F.URUT_OPTIONS).value;
  return st({ posisi, label, harga, motor, urut });
}

check('500 generated products: one-pass counts equal brute force on 300 random states', () => {
  assert.strictEqual(BIG.length, 500);
  for (let i = 0; i < 300; i++) assertFacetsMatchBruteForce(BIG, randomState());
});

check('500 generated products: filter + sort + option counts stay under 20 ms per state change', () => {
  const { performance } = require('perf_hooks');
  // What one tick costs in CatalogBody: facetCounts (urgent) and applyCatalog (deferred), plus the empty-state
  // helpers when the result is empty. availability() runs once per item list, so it is not part of a tick.
  const tick = s => {
    const f = F.facetCounts(BIG, s);
    const list = F.applyCatalog(BIG, s);
    if (!list.length) {
      F.relaxGroup(BIG, s);
      F.nearestItems(BIG, s);
    }
    return f.total + list.length;
  };
  for (let i = 0; i < 50; i++) tick(randomState());
  const times = [];
  for (let i = 0; i < 400; i++) {
    const s = randomState();
    const t0 = performance.now();
    tick(s);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const max = times[times.length - 1];
  console.log(`INFO  500 products, 400 state changes: p50 ${p50.toFixed(2)} ms, p99 ${p99.toFixed(2)} ms, max ${max.toFixed(2)} ms`);
  assert.ok(p99 < 20, `p99 ${p99.toFixed(2)} ms`);
  const t0 = performance.now();
  F.availability(BIG);
  assert.ok(performance.now() - t0 < 20, 'availability');
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
  // The wa.me action carries the WhatsApp glyph like every other WhatsApp button; its text is still "Chat admin".
  assert.match(out, /<a class="iz-btn iz-btn--primary iz-btn--wa" href="https:\/\/wa\.me\/6289513482410" target="_blank" rel="noopener noreferrer"><span class="iz-btn__icon"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg><\/span><span>Chat admin<\/span><\/a>/);
});

const src = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// A client render: CatalogQuery replacing the Suspense fallback, where useSyncExternalStore reads the client
// snapshot. react-dom/server always takes the server snapshot, so the hook is swapped for the length of one render.
function clientHtml(el) {
  const orig = React.useSyncExternalStore;
  React.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();
  try {
    return renderToStaticMarkup(el);
  } finally {
    React.useSyncExternalStore = orig;
  }
}
const cardNames = out => [...out.matchAll(/<h2 class="iz-pcard__name">([^<]*)<\/h2>/g)].map(m => m[1]);
const tankbags = n => Array.from({ length: n }, (_, i) => simple(`tankbag-${i}`, `Tankbag Nomor ${i}`, 100000 + i, null, { createdAt: i })).map(F.toCatalogItem);

check('render: Suspense fallback lists every product (h2 names), help card after the 8th, one count, empty status (S2.2.8, S2.5.1, S0.9.6)', () => {
  const out = html(React.createElement(CatalogBody, { items: tankbags(14), waHref: WA }));
  assert.strictEqual(cardNames(out).length, 14);
  const grid = out.slice(out.indexOf('iz-catalog__grid'));
  assert.ok(grid.indexOf('Tankbag Nomor 6') < grid.indexOf('iz-helpcard') && grid.indexOf('iz-helpcard') < grid.indexOf('Tankbag Nomor 5'), 'help card after the 8th card (newest first)');
  assert.match(out, /<h1 class="t-h1-shop">Semua tas motor INZTA<\/h1><p class="t-lead">14 produk\.<span class="iz-lead-motor"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
  assert.match(out, /<div class="iz-catalog__more" hidden="">/);
  assert.doesNotMatch(out, /Menampilkan/, 'one count only: the lead');
  assert.doesNotMatch(out, /iz-lead-motor--on/, 'no motor category chosen: the sentence stays hidden unless the pre-paint attribute is set');
  assert.match(out, /<p class="iz-sr" role="status" aria-live="polite"><\/p>/, 'nothing announced on load');
  assert.match(out, /<div class="iz-row" style="gap:10px" hidden="">/);
});

check('render (client): first 12 cards, "Menampilkan 12 dari 14 produk" above a real "Muat lagi" link (?tampil=24)', () => {
  const out = clientHtml(React.createElement(CatalogBody, { items: tankbags(14), waHref: WA, onApply: () => true, onMore: () => {} }));
  assert.strictEqual(cardNames(out).length, 12);
  assert.match(out, /<p class="t-lead">14 produk\.<span class="iz-lead-motor"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
  assert.match(out, /<div class="iz-catalog__more"><p class="iz-catalog__progress">Menampilkan 12 dari 14 produk<\/p><a class="iz-btn iz-btn--secondary" href="\/produk\?tampil=24">Muat 12 produk lagi<\/a><\/div>/);
});

check('render (client): ?tampil=24 restores 24 cards; the next link keeps ?aff= and asks for 36', () => {
  const out = clientHtml(React.createElement(CatalogBody, { items: tankbags(30), shown: 24, search: 'aff=X&tampil=24', waHref: WA, onApply: () => true, onMore: () => {} }));
  assert.strictEqual(cardNames(out).length, 24);
  assert.match(out, /href="\/produk\?aff=X&amp;tampil=36"/);
  assert.match(out, /Menampilkan 24 dari 30 produk/);
});

check('render: posisi=tank names the H1 and gives one count, no "Menampilkan" when everything fits', () => {
  const out = clientHtml(React.createElement(CatalogBody, { items: ITEMS, state: st({ posisi: ['tank'] }), waHref: WA, onApply: () => true }));
  assert.match(out, /<h1 class="t-h1-shop">Tank bag<\/h1><p class="t-lead">3 produk\.<span class="iz-lead-motor"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
  assert.strictEqual(cardNames(out).length, 3);
  assert.doesNotMatch(out, /Menampilkan/);
});

check('render: an empty result names the filters, offers the most useful removal, and shows nearby products (S2.6.1)', () => {
  const out = html(React.createElement(CatalogBody, { items: ITEMS, waHref: WA, state: st({ posisi: ['extend'], harga: 'atas-500rb', urut: 'terbaru' }), search: 'posisi=extend&harga=atas-500rb&urut=terbaru' }));
  assert.match(out, /<h2 class="iz-empty__title">Tidak ada tas yang sesuai filter\.<\/h2><p class="iz-empty__text">Filter aktif: Extend bag, Di atas Rp500\.000\.<\/p>/);
  assert.match(out, /<button class="iz-btn iz-btn--primary" type="button">Hapus filter Di atas Rp500\.000<\/button>/);
  assert.match(out, /<button class="iz-btn iz-btn--secondary" type="button">Hapus semua filter<\/button>/);
  assert.match(out, /<a class="iz-link" href="https:\/\/wa\.me\/6289513482410" target="_blank" rel="noopener noreferrer">Chat admin<\/a>/);
  const near = [...out.matchAll(/<h3 class="iz-pcard__name">/g)].length;
  assert.ok(near >= 1 && near <= 4, `${near} nearby cards`);
  assert.match(out, /Tanpa filter Harga: 1 produk/);
  assert.doesNotMatch(out, /iz-catalog__grid/);
  assert.match(out, /<p class="t-lead">0 produk\.<span class="iz-lead-motor"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
  assert.doesNotMatch(out, /Menampilkan/);
});

check('render: when no single removal helps, "Hapus semua filter" is the primary button and the only one', () => {
  const out = html(React.createElement(CatalogBody, { items: ITEMS, waHref: WA, state: st({ posisi: ['tank'], harga: 'atas-500rb', motor: 'retro' }) }));
  assert.match(out, /<div class="iz-row"><button class="iz-btn iz-btn--primary" type="button">Hapus semua filter<\/button><\/div>/);
  const emptyBlock = out.slice(out.indexOf('<div class="iz-empty">'), out.indexOf('iz-catalog__near'));
  assert.doesNotMatch(emptyBlock, /Hapus filter|Lihat semua/);
  assert.match(out, /Tank bag lainnya/, 'the nearby row names what it shows');
});

const FilterFields = require(path.join(ROOT, 'components/v2/catalog/FilterFields.tsx')).default;
const FilterSheet = require(path.join(ROOT, 'components/v2/catalog/FilterSheet.tsx')).default;
const FilterBar = require(path.join(ROOT, 'components/v2/catalog/FilterBar.tsx')).default;
const fields = (group, state, items = ITEMS) =>
  html(React.createElement(FilterFields, { group, state, counts: F.facetCounts(items, state), avail: F.availability(items), kept: new Set(F.selectionKeys(state)), idPrefix: 't', onChange: () => {} }));

check('render FilterFields: live counts, contextual 0 muted but not disabled, "Semua harga" first', () => {
  const pos = fields('posisi', F.DEFAULT_STATE);
  assert.match(pos, /Tank bag<span class="iz-check__count">\(3\)<\/span>/);
  assert.match(pos, /Side bag<span class="iz-check__count">\(2\)<\/span>/);
  const lab = fields('label', st({ posisi: ['tail'] }));
  assert.match(lab, /<label class="iz-check iz-check--zero" for="t-label-best-seller">[^]*?Best seller<span class="iz-check__count">\(0\)<\/span><\/label>/);
  assert.doesNotMatch(lab, /disabled/);
  const harga = fields('harga', st({ harga: 'atas-500rb' }));
  const labels = [...harga.matchAll(/<label[^>]*><input[^>]*\/>([^<]*)</g)].map(m => m[1]);
  assert.deepStrictEqual(labels, ['Semua harga', 'Di bawah Rp200.000', 'Rp200.000 sampai Rp500.000', 'Di atas Rp500.000']);
  assert.match(harga, /Semua harga<span class="iz-check__count">\(9\)<\/span>/, 'every product, including the one without a price');
  assert.doesNotMatch(src('components/v2/catalog/FilterFields.tsx'), /onClick|disabled=/, 'no click-again clearing, nothing disabled');
});

check('render FilterFields: a group hides options no product has, but keeps a selected one at (0)', () => {
  const noLabels = ITEMS.filter(i => !i.best && !i.baru && !i.discounted);
  assert.doesNotMatch(fields('label', F.DEFAULT_STATE, noLabels), /iz-check/);
  assert.match(fields('label', st({ label: ['diskon'] }), noLabels), /checked=""[^>]*\/>Diskon<span class="iz-check__count">\(0\)<\/span>/);
});

check('render FilterSheet: "Tampilkan n produk" from the draft and "Reset"; 0 stays enabled with a note', () => {
  const sheet = state => html(React.createElement(FilterSheet, { items: ITEMS, state, avail: F.availability(ITEMS), kept: new Set(F.selectionKeys(state)), category: null, categoryText: null, startGroup: null, onApply: () => {}, onClose: () => {} }));
  const five = sheet(st({ posisi: ['tank', 'side'] }));
  assert.match(five, /<button class="iz-btn iz-btn--primary" type="button">Tampilkan 5 produk<\/button>/);
  assert.match(five, /<button class="iz-btn iz-btn--secondary" type="button">Reset<\/button>/);
  assert.doesNotMatch(five, /Tidak ada produk untuk pilihan ini/);
  assert.doesNotMatch(five, /Terapkan/);
  const zero = sheet(st({ posisi: ['extend'], harga: 'atas-500rb' }));
  assert.match(zero, /<button class="iz-btn iz-btn--primary" type="button">Tampilkan 0 produk<\/button>/);
  assert.match(zero, /<p class="iz-fsheet__note">Tidak ada produk untuk pilihan ini\.<\/p>/);
  assert.doesNotMatch(zero, /disabled/);
  assert.match(zero, /<p class="iz-sr" role="status" aria-live="polite"><\/p>/, 'quiet until the draft changes');
});

check('render FilterBar: "Motor saya" is a toggle, never disabled, hidden when no product carries the category', () => {
  const bar = (items, state, category) =>
    html(React.createElement(FilterBar, { state, facets: F.facetCounts(items, state), avail: F.availability(items), kept: new Set(F.selectionKeys(state)), category, categoryText: label(category), sheetOpen: false, onChange: () => {}, onOpenSheet: () => {} }));
  // posisi=tail and retro give 0 together, the chip still renders and can be pressed.
  const zero = bar(ITEMS, st({ posisi: ['tail'] }), 'retro');
  assert.match(zero, /<button class="iz-fchip iz-fchip--motor" type="button" aria-pressed="false" data-fchip="motor">/);
  assert.doesNotMatch(zero, /disabled|\(0\)/);
  const untagged = ITEMS.filter(i => !i.kategori.includes('trail'));
  assert.doesNotMatch(bar(untagged, F.DEFAULT_STATE, 'trail'), /data-fchip="motor"/);
  assert.match(bar(untagged, st({ motor: 'trail' }), 'trail'), /aria-pressed="true" data-fchip="motor"/, 'a ?motor= link keeps it, pressed');
  const keptBar = html(React.createElement(FilterBar, { state: F.DEFAULT_STATE, facets: F.facetCounts(untagged, F.DEFAULT_STATE), avail: F.availability(untagged), kept: new Set(['motor:trail']), category: 'trail', categoryText: label('trail'), sheetOpen: false, onChange: () => {}, onOpenSheet: () => {} }));
  assert.match(keptBar, /aria-pressed="false" data-fchip="motor"/, 'turned off, it stays in place instead of unmounting under the pointer');
  const noLabels = ITEMS.filter(i => !i.best && !i.baru && !i.discounted);
  assert.doesNotMatch(bar(noLabels, F.DEFAULT_STATE, 'retro'), /data-fchip="label"/, 'no product has a label: no Label chip');
  assert.match(bar(ITEMS, F.DEFAULT_STATE, 'retro'), /data-fchip="label"/);
});

check('render with a stored motor category: lead adds the green-mark sentence; the motor empty state; a ?motor= chip', () => {
  const bodyPath = path.join(ROOT, 'components/v2/catalog/CatalogBody.tsx');
  const ctxPath = path.join(ROOT, 'components/v2/MotorCategory');
  STUBS.set(ctxPath, { useMotorCategory: () => ({ category: 'retro', setCategory: () => {} }) });
  delete require.cache[bodyPath];
  try {
    const Body = require(bodyPath).default;
    const lead = html(React.createElement(Body, { items: ITEMS, waHref: WA }));
    assert.match(lead, /<p class="t-lead">9 produk\.<span class="iz-lead-motor iz-lead-motor--on"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
    assert.match(lead, /data-fchip="motor"/);
    assert.doesNotMatch(lead, /disabled/);
    const empty = html(React.createElement(Body, { items: ITEMS, state: st({ posisi: ['tank'], motor: 'retro' }), waHref: WA }));
    assert.match(empty, /<h1 class="t-h1-shop">Tank bag untuk motor Retro<\/h1>/);
    assert.match(empty, /<h2 class="iz-empty__title">Belum ada tank bag yang ditandai untuk motor Retro\.<\/h2>/);
    assert.match(empty, /<button class="iz-btn iz-btn--primary" type="button">Lihat semua tank bag<\/button>/);
    const untagged = ITEMS.filter(i => !i.kategori.includes('trail'));
    const chip = html(React.createElement(Body, { items: untagged, state: st({ motor: 'trail' }), waHref: WA }));
    assert.match(chip, /<span class="iz-activechip">Trail<button type="button" aria-label="Hapus filter Trail">/);
    assert.match(chip, /Belum ada tas yang ditandai untuk motor Trail\./);
    assert.match(chip, />Lihat semua tas<\/button>/);
  } finally {
    STUBS.delete(ctxPath);
    delete require.cache[bodyPath];
  }
});

check('render CatalogQuery: the first state comes from the URL (?posisi=tank&tampil=24), other keys kept for links', () => {
  STUBS.set('next/navigation', { useSearchParams: () => new URLSearchParams('aff=X&posisi=tank&tampil=24'), usePathname: () => '/produk' });
  const queryPath = path.join(ROOT, 'components/v2/catalog/CatalogQuery.tsx');
  delete require.cache[queryPath]; // CatalogPage loaded it with the real next/navigation
  try {
    const Query = require(queryPath).default;
    const out = clientHtml(React.createElement(Query, { items: [...ITEMS, ...tankbags(30)], waHref: WA }));
    assert.match(out, /<h1 class="t-h1-shop">Tank bag<\/h1><p class="t-lead">33 produk\.<span class="iz-lead-motor"> Tas yang dibuat untuk motor Anda ditandai hijau\.<\/span><\/p>/);
    assert.strictEqual(cardNames(out).length, 24);
    assert.match(out, /href="\/produk\?aff=X&amp;posisi=tank&amp;tampil=36"/);
  } finally {
    STUBS.delete('next/navigation');
    delete require.cache[queryPath];
  }
});

// Replays CatalogQuery: `write` sets the view and the address bar at once; Next delivers useSearchParams later.
function urlOwner(initial) {
  const o = { url: initial, view: F.readView(new URLSearchParams(initial)) };
  o.apply = change => {
    const next = F.changeView(o.view, change);
    if (!next) return false;
    o.view = next;
    o.url = F.writeQuery(o.url, next.state, next.shown);
    return o.url;
  };
  o.more = shown => {
    o.view = { state: o.view.state, shown };
    o.url = F.writeQuery(o.url, o.view.state, shown);
    return o.url;
  };
  // The effect on a new `search`.
  o.deliver = search => {
    const next = F.syncView(o.view, search, o.url);
    if (next) o.view = next;
    return !!next;
  };
  return o;
}

check('CatalogQuery sync: a late `search` from the first of two quick writes keeps both ticks', () => {
  const o = urlOwner('aff=X');
  const first = o.apply({ type: 'toggle', group: 'posisi', value: 'tank' });
  const second = o.apply({ type: 'toggle', group: 'label', value: 'diskon' });
  assert.strictEqual(first, 'aff=X&posisi=tank');
  assert.strictEqual(second, 'aff=X&posisi=tank&label=diskon');
  assert.strictEqual(o.deliver(first), false, 'stale search ignored');
  assert.deepStrictEqual(o.view.state, st({ posisi: ['tank'], label: ['diskon'] }));
  assert.strictEqual(o.deliver(second), false, 'our own latest write needs no re-sync');
  assert.deepStrictEqual(o.view.state, st({ posisi: ['tank'], label: ['diskon'] }));
  assert.strictEqual(o.apply({ type: 'toggle', group: 'posisi', value: 'zzz' }), false, 'no-op change writes nothing');
});

check('CatalogQuery sync: navbar links and back/forward re-sync; ?tampil= comes back after a product page', () => {
  const o = urlOwner('posisi=tank');
  o.more(24);
  assert.strictEqual(o.url, 'posisi=tank&tampil=24');
  // A navbar link to /produk?posisi=side: the address bar and `search` agree.
  o.url = 'posisi=side';
  assert.strictEqual(o.deliver('posisi=side'), true);
  assert.deepStrictEqual(o.view, { state: st({ posisi: ['side'] }), shown: 12 });
  // Back to the earlier entry (replaceState kept "Muat lagi" in it), or back from a product page.
  o.url = 'posisi=tank&tampil=24';
  assert.strictEqual(o.deliver('posisi=tank&tampil=24'), true);
  assert.deepStrictEqual(o.view, { state: st({ posisi: ['tank'] }), shown: 24 });
  // Parameter order does not count as a change only when the view is the same.
  o.url = 'tampil=24&posisi=tank';
  assert.strictEqual(o.deliver('tampil=24&posisi=tank'), false);
  // A filter change after a restore starts again at 12 and drops ?tampil=.
  assert.strictEqual(o.apply({ type: 'urut', value: 'harga-terendah' }), 'posisi=tank&urut=harga-terendah');
  assert.strictEqual(o.view.shown, 12);
});

check('resultStatus: names the sort when it is not the default, so a sort change is announced', () => {
  assert.strictEqual(F.resultStatus('Tank bag', 5, 'sesuai'), 'Tank bag: 5 produk');
  assert.strictEqual(F.resultStatus('Tank bag', 5, 'harga-terendah'), 'Tank bag: 5 produk, harga terendah');
  assert.notStrictEqual(F.resultStatus('Tank bag', 5, 'terbaru'), F.resultStatus('Tank bag', 5, 'harga-tertinggi'));
  const body = src('components/v2/catalog/CatalogBody.tsx');
  assert.match(body, /announce\(resultStatus\(heading, result\.length, view\.urut\)\)/);
  assert.match(body, /setStatus\(''\);\s*statusFrame\.current = requestAnimationFrame\(\(\) => setStatus\(text\)\)/, 'a repeated text is cleared and set again');
});

check('source: desktop applies per tick (no draft, no "Terapkan"); nothing in the catalogue renders disabled', () => {
  const bar = src('components/v2/catalog/FilterBar.tsx');
  assert.doesNotMatch(bar, /Terapkan/);
  assert.doesNotMatch(bar, /useState<FilterState>/);
  for (const f of ['FilterBar.tsx', 'FilterFields.tsx', 'CatalogBody.tsx', 'CatalogEmpty.tsx']) assert.doesNotMatch(src(`components/v2/catalog/${f}`), /disabled=/, f);
  // The query owner applies changes to a ref of the latest state, not to the rendered prop.
  assert.match(src('components/v2/catalog/CatalogQuery.tsx'), /changeView\(viewRef\.current, change\)/);
  assert.match(src('components/v2/catalog/CatalogQuery.tsx'), /syncView\(viewRef\.current, search, window\.location\.search\)/);
  assert.match(src('components/v2/catalog/filter.ts'), /const state = reduceFilter\(cur\.state, change\);/);
});

check('CSS: phone hit areas (44 px around the chip remove button, tap height for "Hapus semua"); no disabled styles left', () => {
  const css = src('app/(v2)/v2-catalog.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
  assert.match(phone, /\.iz-activechip button::before \{[^}]*inset: -8px/);
  assert.match(phone, /\.iz-filters__meta \.iz-link \{ min-height: var\(--size-tap\); \}/);
  assert.match(css, /\.iz-fsheet__actions \.iz-btn \{ min-height: 48px; \}/);
  assert.doesNotMatch(css, /:disabled/);
});

check('lead: the green-mark sentence is always in the markup and shown by CSS, so a stored category causes no shift', () => {
  const css = src('app/(v2)/v2-catalog.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.iz-lead-motor \{ display: none; \}/);
  assert.match(css, /\.iz-lead-motor--on, html\.iz-v2\[data-iz-motor\] \.iz-lead-motor \{ display: inline; \}/);
  const shell = require(path.join(ROOT, 'components/v2/catalog/CatalogPage.tsx'));
  const M = { setAttribute(k, v) { this[k] = v; } };
  const run = (stored, throws = false) => {
    const el = Object.create(M);
    const ls = { getItem: k => { if (throws) throw new Error('blocked'); return k === 'inzta.motorCategory' ? stored : null; } };
    new Function('localStorage', 'document', shell.MOTOR_ATTR_SCRIPT)(ls, { documentElement: el });
    return el['data-iz-motor'];
  };
  assert.strictEqual(run('retro'), 'retro');
  assert.strictEqual(run('bogus'), undefined);
  assert.strictEqual(run(null), undefined);
  assert.strictEqual(run('retro', true), undefined, 'blocked storage is swallowed');
  // Same key as the provider.
  assert.match(src('components/v2/MotorCategory.tsx'), /MOTOR_CATEGORY_KEY = 'inzta\.motorCategory'/);
  const out = html(React.createElement(CatalogPage, { items: ITEMS, waHref: WA }));
  assert.ok(out.indexOf('data-iz-motor') < out.indexOf('t-lead'), 'the script runs before the lead is parsed');
});

check('CSS and markup: the filter section scrolls with the page; a pressed "Motor saya" chip is dark on light', () => {
  const css = src('app/(v2)/v2-catalog.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Not sticky: a bar that followed the scroll sat on top of the cards (Sehan, 2026-10-30).
  assert.match(css, /\.iz-catalog__filters \{ position: relative; z-index: 20;/);
  assert.doesNotMatch(css, /\.iz-catalog__filters \{[^}]*sticky/);
  assert.match(css, /\.iz-catalog__filters > \.iz-filters \{ position: static; \}/);
  assert.match(css, /\.iz-fchip--motor\.iz-fchip--active \{ background: var\(--c-tinta\); border-color: var\(--c-tinta\); color: var\(--c-kertas\); \}/);
  // The filter section holds only the bar; the active chips and the status line sit at the top of the results.
  const out = html(React.createElement(CatalogBody, { items: ITEMS, waHref: WA }));
  const filters = out.slice(out.indexOf('iz-catalog__filters'), out.indexOf('iz-catalog__results'));
  assert.match(filters, /class="iz-filters"/);
  assert.doesNotMatch(filters, /iz-filters__meta|role="status"/);
  assert.match(out.slice(out.indexOf('iz-catalog__results')), /^iz-catalog__results"><div class="iz-filters__meta"/);
  // The sheet is portaled to .iz-page, above the sticky navbar; the backdrop closes on click, not pointerdown.
  assert.match(src('components/v2/catalog/CatalogBody.tsx'), /createPortal\([\s\S]*closest<HTMLElement>\('\.iz-page'\)/);
  const sheetSrc = src('components/v2/catalog/FilterSheet.tsx');
  assert.match(sheetSrc, /onClick=\{e => \{\s*const close = downOnBackdrop\.current && e\.target === e\.currentTarget;/);
  assert.doesNotMatch(sheetSrc, /onPointerDown=\{e => \{\s*if \(e\.target === e\.currentTarget\) onClose\(\)/);
});


check('route contract: ISR 3600, no force-dynamic, no server searchParams, no catch that renders an empty list (S2.7, S2.2.8)', () => {
  // Comments may name what the route no longer does, so only code is checked.
  const page = src('app/produk/(katalog)/page.tsx').replace(/^\s*\/\/.*$/gm, '');
  assert.match(page, /export const revalidate = 3600;/);
  assert.doesNotMatch(page, /force-dynamic|searchParams|catch\s*\(/);
  assert.match(page, /getActiveProducts\(\)/);
  // F-005 phase 2 owns the metadata (F-016 C-3): sectionMetadata('produk') sets the absolute canonical, never the query.
  assert.match(page, /export const metadata = sectionMetadata\('produk'\);/);
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
