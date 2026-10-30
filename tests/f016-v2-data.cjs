// F-016 task A3: data fields and pure helpers of website v2. Requirements D2, D3, S1.9, S4.1-S4.3, S4.6.2-S4.6.9,
// S5.3, S5.5, S5.8.4, S6.7.2, S6.8.1-S6.8.4, S6.8.7, S7.2, S7.6, design.md §3-§4. The product and article API
// cases run the real route handlers against an in-memory Firestore with stubbed Next.js APIs (as f012-articles).
// Usage: npm run test:v2-data  (or: node tests/f016-v2-data.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const jar = new Map();
const counters = { reads: 0, writes: 0 };
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => { counters.reads++; return { exists: docs.has(key), id, data: () => docs.get(key), updateTime: docs.has(key) ? { v: 1 } : undefined }; },
    create: async (value) => {
      if (docs.has(key)) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; }
      assertNoUndefined(value, key); counters.writes++; docs.set(key, value);
    },
    // Full overwrite without merge, like the product PUT route (S4.6.6).
    set: async (value, opts) => {
      assert.strictEqual(opts, undefined, 'product PUT must not merge');
      assertNoUndefined(value, key); counters.writes++; docs.set(key, value);
    },
    update: async (value) => {
      if (!docs.has(key)) { const e = new Error('5 NOT_FOUND'); e.code = 5; throw e; }
      assertNoUndefined(value, key); counters.writes++; docs.set(key, { ...docs.get(key), ...value });
    },
    delete: async () => { counters.writes++; docs.delete(key); },
  };
}
// The Admin SDK has no ignoreUndefinedProperties here, so an undefined value would throw in production (S4.6.6).
function assertNoUndefined(v, where) {
  if (v === undefined) throw new Error(`undefined value written at ${where}`);
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) assertNoUndefined(x, `${where}.${k}`);
}
const fakeDb = {
  getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    get: async () => ({ docs: [...docs.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v })) }),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }),
  }),
};
const sessions = { 'cookie-admin': { uid: 'u-admin', email: 'admin@inzta.id', email_verified: true } };
const fakeAuth = { verifySessionCookie: async (c) => { if (!sessions[c]) throw new Error('invalid'); return sessions[c]; } };
const stubs = {
  react: { cache: (fn) => fn },
  'next/headers': { cookies: () => ({ get: (n) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: () => {}, delete: () => {} }) },
  'next/cache': { revalidatePath: () => {}, revalidateTag: () => {} },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => fakeAuth, hasAdminCredentials: () => true },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request);
    if (stubs[abs]) return abs;
    request = abs;
  }
  if (stubs[request]) return request;
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
  return origLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const M = require(path.join(ROOT, 'lib/v2/motor-category.ts'));
const H = require(path.join(ROOT, 'lib/v2/home-data.ts'));
const A = require(path.join(ROOT, 'lib/v2/article-v2.ts'));
const R = require(path.join(ROOT, 'lib/v2/reviews.ts'));
const S = require(path.join(ROOT, 'components/v2/product/side.ts'));
const F = require(path.join(ROOT, 'lib/article-format.ts'));
const P = require(path.join(ROOT, 'app/api/products/_helpers.ts'));
const products = require(path.join(ROOT, 'app/api/products/route.ts'));
const product = require(path.join(ROOT, 'app/api/products/[slug]/route.ts'));
const articles = require(path.join(ROOT, 'app/api/articles/route.ts'));
const article = require(path.join(ROOT, 'app/api/articles/[slug]/route.ts'));

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
const req = (body, method = 'POST') => new Request('http://localhost/api', method === 'GET' ? { method } : { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const p = (slug) => ({ params: { slug } });
const asAdmin = () => { jar.clear(); jar.set('admin_session', 'cookie-admin'); };
const withoutUpdatedAt = (d) => { const { updatedAt, ...rest } = d; return rest; };

const simple = (slug, name, extra = {}) => ({ productType: 'simple', slug, name, price: 100000, compareAtPrice: null, images: [], isActive: true, ...extra });
const variant = (id, attrs, extra = {}) => ({ variationId: id, sku: id, attributes: attrs, price: 150000, compareAtPrice: 175000, stock: 5, images: [], isActive: true, ...extra });
const sideProduct = (extra = {}, kiri = {}, kanan = {}) => ({
  productType: 'variable', slug: 'side-bag-inzta-xsr-155', name: 'Side bag Inzta XSR 155', isActive: true,
  attributes: [{ id: 'a1', name: 'Sisi', values: ['Kiri', 'Kanan'] }],
  variants: [variant('v-kiri', { Sisi: 'Kiri' }, kiri), variant('v-kanan', { Sisi: 'Kanan' }, kanan)],
  ...extra,
});

(async () => {
  process.env.ADMIN_EMAILS = 'admin@inzta.id';

  // Motor categories (D2, S5.3, S5.5, S5.8.4)
  await check('D2/S5.3: normalizeKategoriMotor keeps D1 slugs once, in D1 order; anything else reads as []', () => {
    assert.deepStrictEqual(M.normalizeKategoriMotor(['retro', 'matic', 'retro', 'vespa', 7]), ['matic', 'retro']);
    for (const v of [undefined, null, 'retro', {}, 3]) assert.deepStrictEqual(M.normalizeKategoriMotor(v), [], String(v));
    assert.deepStrictEqual(M.CATEGORY_SLUGS, ['matic', 'adventure', 'retro', 'trail']);
    assert.strictEqual(M.isMotorCategory('trail'), true);
    assert.strictEqual(M.isMotorCategory('Retro'), false);
    assert.strictEqual(M.isMotorCategory(null), false);
  });
  const catalog = [
    simple('xsr', 'Side bag Inzta XSR 155', { kategoriMotor: ['retro'] }),
    simple('tk5', 'Tankbag TK 5', { kategoriMotor: ['retro', 'adventure'] }),
    simple('strap', 'Tail bag Tourmax 30', { kategoriMotor: ['trail', 'retro', 'matic', 'adventure'] }),
    simple('legacy', 'Side bag Inzta XSR Srcrambag'),
    simple('junk', 'Botol bag Inzta Xmax', { kategoriMotor: 'matic' }),
  ];
  await check('D2/S5.3: productsForCategory reads kategoriMotor only (no name rule), excludes all-four products, keeps order', () => {
    assert.deepStrictEqual(M.productsForCategory(catalog, 'retro').map(x => x.slug), ['xsr', 'tk5']);
    assert.deepStrictEqual(M.productsForCategory(catalog, 'adventure').map(x => x.slug), ['tk5']);
    assert.deepStrictEqual(M.productsForCategory(catalog, 'matic').map(x => x.slug), [], 'a non-array value and a name with "Xmax" place nothing');
    assert.deepStrictEqual(M.productsForCategory([], 'trail'), []);
  });
  await check('S5.5: universalProducts = tagged with all four categories (duplicates and order do not matter)', () => {
    assert.deepStrictEqual(M.universalProducts(catalog).map(x => x.slug), ['strap']);
    assert.strictEqual(M.isUniversalProduct({ kategoriMotor: ['matic', 'adventure', 'retro', 'retro'] }), false);
  });
  await check('S5.8.4: INDEXABLE_CATEGORIES is empty at launch, so no category is indexable even with products and a lead', () => {
    assert.deepStrictEqual(M.INDEXABLE_CATEGORIES, []);
    const many = [simple('a', 'A', { kategoriMotor: ['retro'] }), simple('b', 'B', { kategoriMotor: ['retro'] }), simple('c', 'C', { kategoriMotor: ['retro'] })];
    for (const c of M.CATEGORY_SLUGS) {
      assert.strictEqual(M.isCategoryIndexable(c, many, true), false, c);
      assert.strictEqual(M.isCategoryIndexable(c, [], false), false, c);
    }
  });
  await check('design.md §3.2: draft proposal from names (XSR -> retro, NMAX/XMAX/PCX/Matic -> matic, Adventure/Versys/CB150X -> adventure, universal -> all four)', () => {
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Side bag Inzta XSR 155' }), ['retro']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Botol bag Inzta Xmax' }), ['matic']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Tas PCX 160' }), ['matic']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Sidebag Versys 250' }), ['adventure']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Crashbar bag CB150X' }), ['adventure']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Side bag inzta universal motor' }), ['matic', 'adventure', 'retro', 'trail']);
    assert.deepStrictEqual(M.draftKategoriMotor({ name: 'Tail bag Inzta Tourmax 30' }), []);
  });
  await check('draft script: refuses to run without --dry-run and contains no write call', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/f016-kategori-draft.mjs'), 'utf8');
    assert.ok(src.includes("args.includes('--dry-run')"));
    for (const w of ['firebase', "method: 'POST'", "method: 'PUT'", 'writeFile', '.set(', '.update(']) assert.ok(!src.includes(w), w);
  });

  // Positions (design.md §4)
  await check('design.md §4: positionOf adds extend and harian; side bag wins over "daily"; Beranda keys unchanged', () => {
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Extend bag Inzta untuk top box' }), 'extend');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Chestbag Inzta Ride' }), 'harian');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Waist bag Inzta' }), 'harian');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Slingbag Inzta' }), 'harian');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Handbag Inzta' }), 'harian');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Inzta Daily Pouch' }), 'harian');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Side bag Daily Ride XSR 155' }), 'side');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Tankbag TK 5' }), 'tank');
    assert.strictEqual(H.positionOf({ slug: 'x', name: 'Acc Medikit Ride' }), 'aksesori');
    assert.strictEqual(H.positionOf({ slug: 'xbags-tas-bagasi-xmax', name: 'Xbags, tas bagasi xmax' }), null);
    assert.strictEqual(H.isBagPosition('extend'), false);
    assert.strictEqual(H.isBagPosition('tail'), true);
    assert.strictEqual(H.isBagPosition(null), false);
  });
  await check('S0.9: cards show all six position chips; menu prices keep the four tile positions (design.md §4)', () => {
    const card = H.toCard(simple('chest', 'Chestbag Inzta Ride'));
    assert.strictEqual(card.position, 'harian');
    assert.strictEqual(card.positionLabel, 'Tas harian');
    assert.deepStrictEqual(H.positionsOf({ slug: 'tankbag-and-tailbag-wanderpack-10l', name: 'Tankbag and Tailbag wanderpack 10L' }), ['tank', 'tail']);
    assert.strictEqual(H.toCard(simple('tankbag-and-tailbag-wanderpack-10l', 'Tankbag and Tailbag wanderpack 10L')).positionLabel, 'Tank bag / tail bag');
    assert.strictEqual(H.badgeOf('Best Seller New'), 'best');
    assert.strictEqual(H.badgeOf('Baru'), 'baru');
    assert.strictEqual(H.badgeOf(null), null);
    assert.deepStrictEqual(H.minPriceByPosition([simple('e', 'Extend bag', { price: 1000 })]), { tank: null, side: null, tail: null, aksesori: null });
  });

  // Articles (D3, S6.7.2, S7.2, S7.6)
  const art = (slug, extra = {}) => ({ slug, title: slug, excerpt: ' Ringkasan ', content: 'satu dua tiga', images: [], createdAt: 1, updatedAt: 1, publishedAt: null, ...extra });
  await check('D3/S6.2: topicLabel maps the four topics; empty, unknown, or missing -> null (S6.8.4)', () => {
    assert.deepStrictEqual(A.ARTICLE_TOPICS, ['memilih-tas', 'per-motor', 'touring', 'adventure', 'motocamp', 'komunitas']);
    assert.deepStrictEqual(A.ARTICLE_TOPICS.map(A.topicLabel), ['Memilih tas', 'Per motor', 'Touring', 'Adventure', 'Motocamp', 'Komunitas']);
    for (const v of ['', undefined, null, 'Touring', 'review', 3]) assert.strictEqual(A.topicLabel(v), null, String(v));
    assert.strictEqual(A.normalizeTopik('per-motor'), 'per-motor');
    assert.strictEqual(A.normalizeTopik('x'), null);
  });
  await check('S6.8.3/S6.8.4: articleCategories only for per-motor, normalized', () => {
    assert.deepStrictEqual(A.articleCategories({ topik: 'per-motor', kategoriMotor: ['retro', 'retro', 'vespa'] }), ['retro']);
    assert.deepStrictEqual(A.articleCategories({ topik: 'touring', kategoriMotor: ['retro'] }), []);
    assert.deepStrictEqual(A.articleCategories({}), []);
  });
  await check('F-017: motorArticles lists tagged published others, newest first, capped', () => {
    const all = [
      art('cur', { topik: 'touring', kategoriMotor: ['retro'], publishedAt: 50 }),
      art('old', { topik: 'per-motor', kategoriMotor: ['retro'], publishedAt: 10 }),
      art('new', { topik: 'motocamp', kategoriMotor: ['matic', 'retro'], publishedAt: 90 }),
      art('untagged', { topik: 'touring', publishedAt: 99 }),
      art('draft', { topik: 'touring', kategoriMotor: ['retro'], publishedAt: 98, status: 'draft' }),
    ];
    const out = A.motorArticles({ slug: 'cur' }, all);
    assert.deepStrictEqual(out.map(x => [x.card.slug, x.tags]), [['new', ['matic', 'retro']], ['old', ['retro']]]);
    assert.ok(!('content' in out[0].card));
    assert.strictEqual(A.motorArticles({ slug: 'cur' }, all, 1).length, 1);
  });
  await check('F-017: articleMotorTags for any topic, none without a topic', () => {
    assert.deepStrictEqual(A.articleMotorTags({ topik: 'touring', kategoriMotor: ['retro', 'vespa', 'matic'] }), ['matic', 'retro']);
    assert.deepStrictEqual(A.articleMotorTags({ topik: 'komunitas', kategoriMotor: 'retro' }), []);
    assert.deepStrictEqual(A.articleMotorTags({ topik: '', kategoriMotor: ['retro'] }), []);
  });
  await check('S6.7.2: articleCardV2 has exactly the card fields (no content); photo, author, date, topic fallbacks', () => {
    const c = A.articleCardV2(art('a', { coverImage: 'https://c/cover.jpg', images: ['https://c/g.jpg'], coverCaption: '  Dok. Gasber 16 ', author: ' Om Fahrul ', publishedAt: 5, topik: 'komunitas', showCover: false }));
    assert.deepStrictEqual(Object.keys(c).sort(), ['author', 'coverCaption', 'date', 'excerpt', 'photo', 'slug', 'title', 'topik']);
    assert.deepStrictEqual(c, { slug: 'a', title: 'a', excerpt: 'Ringkasan', photo: 'https://c/cover.jpg', coverCaption: 'Dok. Gasber 16', author: 'Om Fahrul', date: 5, topik: 'komunitas' });
    const legacy = A.articleCardV2(art('b', { imageUrl: 'https://c/legacy.jpg', author: '  ', coverCaption: '', topik: 'unknown' }));
    assert.deepStrictEqual([legacy.photo, legacy.author, legacy.coverCaption, legacy.date, legacy.topik], ['https://c/legacy.jpg', 'Tim INZTA', null, 1, null]);
    assert.strictEqual(A.articleCardV2(art('c', { createdAt: null })).photo, null);
    assert.strictEqual(A.articleCardV2(art('c', { createdAt: null })).date, null);
  });
  await check('S7.2: reading time reuses the F-012 helpers (same value as readingMinutes(countWords()))', () => {
    const long = Array.from({ length: 450 }, (_, i) => `kata${i}`).join(' ');
    assert.strictEqual(A.articleReadingMinutes(long), F.readingMinutes(F.countWords(long)));
    assert.strictEqual(A.articleReadingMinutes(long), 2);
    assert.strictEqual(A.articleReadingMinutes(''), 1);
    assert.strictEqual(A.articleReadingMinutes(undefined), 1);
  });
  await check('S7.6.1: otherArticles excludes the current one, same topic first (newest), then newest others, max 2, published only', () => {
    const all = [
      art('cur', { topik: 'touring', publishedAt: 50 }),
      art('t-old', { topik: 'touring', publishedAt: 10 }),
      art('m-new', { topik: 'memilih-tas', publishedAt: 90 }),
      art('t-new', { topik: 'touring', publishedAt: 40 }),
      art('draft', { topik: 'touring', publishedAt: 99, status: 'draft' }),
      art('none', { publishedAt: 80 }),
    ];
    assert.deepStrictEqual(A.otherArticles(all[0], all).map(c => c.slug), ['t-new', 't-old']);
    assert.deepStrictEqual(A.otherArticles({ slug: 'm-new', topik: 'memilih-tas' }, all).map(c => c.slug), ['none', 'cur']);
    assert.deepStrictEqual(A.otherArticles({ slug: 'x', topik: '' }, all).map(c => c.slug), ['m-new', 'none'], 'no topic: newest others');
    assert.deepStrictEqual(A.otherArticles({ slug: 'cur', topik: 'touring' }, [all[0]]), [], 'none remain -> section hidden');
    assert.ok(A.otherArticles(all[0], all).every(c => !('content' in c)), 'cards carry no content (S7.6.3)');
    assert.deepStrictEqual(A.otherArticles(all[0], all, 2, ['t-new']).map(c => c.slug), ['t-old', 'm-new'], 'F-017: a "Baca juga" article is passed over');
  });

  // Reviews (D4, S1.9)
  await check('S1.9: eight reviews in snapshot order with source URL and access date; no rating or count fields', () => {
    assert.strictEqual(R.TOKOPEDIA_REVIEWS.length, 8);
    assert.strictEqual(R.TOKOPEDIA_REVIEWS_URL, 'https://www.tokopedia.com/lentoratoko/review');
    assert.strictEqual(R.REVIEWS_ACCESSED, '2026-10-29');
    assert.deepStrictEqual(R.TOKOPEDIA_REVIEWS.map(r => r.name), ['S***o', 'H***f', 'B***f', 'A***n', 'V***b', 'D***n', 'T***o', 'B***g']);
    for (const r of R.TOKOPEDIA_REVIEWS) {
      assert.deepStrictEqual(Object.keys(r).sort(), ['month', 'name', 'productName', 'productSlug', 'quote', 'variant']);
      assert.match(r.name, /^.\*\*\*.$/, 'masked Tokopedia form');
      assert.ok(!/\[tertutup\]/.test(r.quote));
    }
  });
  await check('S1.9.3: "[tertutup]" in review 2 renders as "..."', () => {
    assert.ok(R.TOKOPEDIA_REVIEWS[1].quote.includes('di posisi yg ... dekat dengan mesin'));
    assert.strictEqual(R.displayQuote('a [tertutup] b'), 'a ... b');
  });
  // Optional fidelity check against the inzta-hq snapshot when it is checked out next to this repo.
  const snapshotFile = process.env.F016_REVIEW_SNAPSHOT || path.join(ROOT, '..', 'inzta-hq', 'research', '2026-10-29-ulasan-tokopedia-inzta.md');
  if (fs.existsSync(snapshotFile)) {
    await check('S1.9.1: every quote is verbatim from the snapshot table (after the S1.9.3 marker)', () => {
      const md = fs.readFileSync(snapshotFile, 'utf8');
      const rows = [...md.matchAll(/^\| (\d) \| [^|]+ \| [^|]+ \| [^|]+ \| ([^|]+) \| "(.*)" \|$/gm)].map(m => ({ n: Number(m[1]), name: m[2].trim(), quote: R.displayQuote(m[3]) }));
      assert.strictEqual(rows.length, 8);
      rows.forEach((row, i) => {
        assert.strictEqual(R.TOKOPEDIA_REVIEWS[i].quote, row.quote, `review ${row.n}`);
        assert.strictEqual(R.TOKOPEDIA_REVIEWS[i].name, row.name, `review ${row.n}`);
      });
    });
  } else {
    results.push(['SKIP', `S1.9.1 snapshot comparison (${snapshotFile} not found)`]);
  }
  await check('S1.9.1: dates read "sekitar <Bulan YYYY>" in the meta line', () => {
    assert.strictEqual(R.reviewMonthLabel('2026-08'), 'sekitar Agustus 2026');
    assert.strictEqual(R.reviewMonthLabel('2026-07'), 'sekitar Juli 2026');
    assert.strictEqual(R.reviewMonthLabel('2026-13'), '');
    assert.strictEqual(R.reviewMetaLine(R.TOKOPEDIA_REVIEWS[0]), 'Ulasan di Tokopedia, sekitar Agustus 2026');
    assert.strictEqual(R.reviewMetaLine({ month: '' }), 'Ulasan di Tokopedia');
  });
  await check('S1.9.4: featured + largest even wall in order (8 -> 1 + 6, review 8 hidden); empty list -> nothing', () => {
    const { featured, wall } = R.splitReviews(R.TOKOPEDIA_REVIEWS);
    assert.strictEqual(featured.name, 'S***o');
    assert.deepStrictEqual(wall.map(r => r.name), ['H***f', 'B***f', 'A***n', 'V***b', 'D***n', 'T***o']);
    for (let n = 1; n <= 8; n++) assert.strictEqual(R.splitReviews(R.TOKOPEDIA_REVIEWS.slice(0, n)).wall.length % 2, 0, String(n));
    assert.deepStrictEqual(R.splitReviews([]), { featured: null, wall: [] });
  });
  await check('S1.9.5/S1.9.6/S1.9.8: chip = website name + " · Varian", photo of the active product, crop-top; unmapped or inactive -> snapshot name, no photo', () => {
    const list = [
      { slug: 'side-bage-motor-inzta-oke', name: 'Side Bag Motor Inzta Foldpack Z10 Vol 10L', images: ['https://c/z10.jpg'], isActive: true },
      { slug: 'side-bag-inzta-xsr-155', name: 'Side bag Inzta XSR 155', images: [], imageUrl: 'https://c/xsr.jpg', isActive: true },
      { slug: 'botol-bag-inzta-nmax', name: 'Botol bag inzta Nmax', images: ['https://c/n.jpg'], isActive: false },
    ];
    assert.deepStrictEqual(R.reviewChip(R.TOKOPEDIA_REVIEWS[0], list), { label: 'Side Bag Motor Inzta Foldpack Z10 Vol 10L · Sepasang', image: 'https://c/z10.jpg', cropTop: true });
    assert.deepStrictEqual(R.reviewChip(R.TOKOPEDIA_REVIEWS[1], list), { label: 'Side bag Inzta XSR 155 · Kiri', image: 'https://c/xsr.jpg', cropTop: false });
    assert.deepStrictEqual(R.reviewChip(R.TOKOPEDIA_REVIEWS[4], list), { label: 'Tas botol NMAX', image: null, cropTop: false });
    assert.deepStrictEqual(R.reviewChip(R.TOKOPEDIA_REVIEWS[5], list), { label: 'Sidebag XSR Daily Ride · Sepasang', image: null, cropTop: false });
  });

  // Side picker (S4.1-S4.3)
  await check('S4.1.1: legacy Kiri/Kanan product qualifies without jualPerSisi; case and spaces ignored', () => {
    assert.strictEqual(S.isSideProduct(sideProduct()), true);
    const loose = sideProduct({ attributes: [{ id: 'a', name: 'Posisi', values: [' kiri ', 'KANAN'] }], variants: [variant('k', { Posisi: 'KIRI' }), variant('n', { Posisi: ' kanan' })] });
    assert.strictEqual(S.isSideProduct(loose), true);
    assert.strictEqual(S.sideStructure(loose).variants.kanan.variationId, 'n');
  });
  await check('S4.1.1: jualPerSisi alone is not sufficient; other structures use the generic picker', () => {
    const cases = {
      simple: simple('s', 'S', { jualPerSisi: true }),
      twoAttributes: sideProduct({ attributes: [{ id: 'a', name: 'Sisi', values: ['Kiri', 'Kanan'] }, { id: 'b', name: 'Warna', values: ['Hitam'] }] }),
      threeValues: sideProduct({ attributes: [{ id: 'a', name: 'Sisi', values: ['Kiri', 'Kanan', 'Tengah'] }] }),
      otherValues: sideProduct({ attributes: [{ id: 'a', name: 'Warna', values: ['Hitam', 'Abu'] }], jualPerSisi: true }),
      twoKiri: sideProduct({ variants: [variant('a', { Sisi: 'Kiri' }), variant('b', { Sisi: 'Kiri' }), variant('c', { Sisi: 'Kanan' })] }),
      noKanan: sideProduct({ variants: [variant('a', { Sisi: 'Kiri' })] }),
    };
    for (const [name, prod] of Object.entries(cases)) {
      assert.strictEqual(S.isSideProduct(prod), false, name);
      assert.strictEqual(S.sidePicker(prod), null, name);
    }
    const leftover = sideProduct({ variants: [variant('v-kiri', { Sisi: 'Kiri' }), variant('v-kanan', { Sisi: 'Kanan' }), variant('old', { Warna: 'Merah' }, { isActive: false })] });
    assert.strictEqual(S.isSideProduct(leftover), true, 'inactive leftovers of an older structure are ignored (S4.6.2)');
  });
  await check('S4.2/S4.2.4: options Kiri, Kanan, Sepasang with prices; Sepasang = Kiri + Kanan, stock = pairs', () => {
    const d = S.sidePicker(sideProduct({}, { stock: 3 }, { stock: 7 }));
    assert.deepStrictEqual(d.options.map(o => [o.choice, o.label, o.price, o.stock, o.disabled, o.reason]), [
      ['kiri', 'Kiri', 150000, 3, false, null],
      ['kanan', 'Kanan', 150000, 7, false, null],
      ['sepasang', 'Sepasang', 300000, 3, false, null],
    ]);
    assert.strictEqual(d.note, null);
    assert.strictEqual(d.equalPrices, true);
  });
  await check('S4.2.2: one side sold out -> card "Habis", Sepasang "<Sisi> habis", note names the side', () => {
    const d = S.sidePicker(sideProduct({}, {}, { stock: 0 }));
    assert.deepStrictEqual(d.options.map(o => [o.choice, o.disabled, o.reason]), [['kiri', false, null], ['kanan', true, 'Habis'], ['sepasang', true, 'Kanan habis']]);
    assert.strictEqual(d.note, 'Sisi kanan sedang habis. Tanya admin kapan tersedia lagi.');
    const k = S.sidePicker(sideProduct({}, { stock: 0 }));
    assert.strictEqual(k.options[2].reason, 'Kiri habis');
    assert.strictEqual(k.note, 'Sisi kiri sedang habis. Tanya admin kapan tersedia lagi.');
  });
  await check('S4.2.3/S4.1.2: both sold out (or inactive) -> all "Habis", the both-sides note', () => {
    const d = S.sidePicker(sideProduct({}, { stock: 0 }, { isActive: false, stock: 9 }));
    assert.deepStrictEqual(d.options.map(o => [o.disabled, o.reason, o.stock]), [[true, 'Habis', 0], [true, 'Habis', 0], [true, 'Habis', 0]]);
    assert.strictEqual(d.allSoldOut, true);
    assert.strictEqual(d.note, 'Kiri dan kanan sedang habis. Tanya admin kapan tersedia lagi.');
  });
  await check('S4.1.3: bisaSepasang false -> two options; missing or true -> three', () => {
    assert.deepStrictEqual(S.sidePicker(sideProduct({ bisaSepasang: false })).options.map(o => o.choice), ['kiri', 'kanan']);
    assert.strictEqual(S.sidePicker(sideProduct({ bisaSepasang: true })).options.length, 3);
    assert.strictEqual(S.sidePicker(sideProduct()).options.length, 3);
  });
  await check('S4.3.1/S3.3.4: max quantity per option and clamping to 1..max', () => {
    const d = S.sidePicker(sideProduct({}, { stock: 2 }, { stock: 6 }));
    assert.deepStrictEqual([S.maxQuantity(d, 'kiri'), S.maxQuantity(d, 'kanan'), S.maxQuantity(d, 'sepasang')], [2, 6, 2]);
    assert.strictEqual(S.clampQuantity(d, 'sepasang', 5), 2);
    assert.strictEqual(S.clampQuantity(d, 'kanan', 0), 1);
    const out = S.sidePicker(sideProduct({}, { stock: 0 }));
    assert.strictEqual(S.maxQuantity(out, 'sepasang'), 0);
    assert.strictEqual(S.clampQuantity(out, 'kiri', 3), 1);
  });
  await check('S4.3.2/S4.3.3: payload for Sepasang = one Kiri + one Kanan item of n each, in that order; subtotal = option total', () => {
    const d = S.sidePicker(sideProduct());
    assert.deepStrictEqual(S.buildSideItems('side-bag-inzta-xsr-155', d, 'sepasang', 2), [
      { productSlug: 'side-bag-inzta-xsr-155', variationId: 'v-kiri', quantity: 2 },
      { productSlug: 'side-bag-inzta-xsr-155', variationId: 'v-kanan', quantity: 2 },
    ]);
    assert.deepStrictEqual(S.buildSideItems('s', d, 'kanan', 1), [{ productSlug: 's', variationId: 'v-kanan', quantity: 1 }]);
    assert.strictEqual(S.optionTotal(d, 'sepasang', 2), 600000);
    assert.strictEqual(S.optionTotal(d, 'kiri', 3), 450000);
  });
  await check('S4.2.4: price row = chosen side (Kiri for none/Sepasang); legacy unequal prices -> range until a side is chosen', () => {
    const d = S.sidePicker(sideProduct());
    assert.deepStrictEqual(S.sidePriceRow(d, null), { kind: 'single', price: 150000, compareAt: 175000 });
    assert.deepStrictEqual(S.sidePriceRow(d, 'sepasang'), { kind: 'single', price: 150000, compareAt: 175000 });
    const u = S.sidePicker(sideProduct({}, { price: 140000, compareAtPrice: null }, { price: 160000 }));
    assert.strictEqual(u.equalPrices, false);
    assert.deepStrictEqual(S.sidePriceRow(u, null), { kind: 'range', low: 140000, high: 160000 });
    assert.deepStrictEqual(S.sidePriceRow(u, 'kanan'), { kind: 'single', price: 160000, compareAt: 175000 });
    assert.deepStrictEqual(S.sidePriceRow(u, 'kiri'), { kind: 'single', price: 140000, compareAt: null });
  });
  await check('S4.3.4: WhatsApp line for Sepasang', () => {
    assert.strictEqual(S.sepasangWaLine(2), 'Pilihan: Sepasang (kiri + kanan), 2 pasang');
  });

  // Product API (S4.6.2-S4.6.9), builders in memory
  const legacySimple = P.buildSimplePayload({ name: 'Tankbag TK 5', slug: 'tankbag-tk-5', description: 'd', category: 'tank', images: ['https://c/a.jpg'], imageUrl: 'https://c/a.jpg', features: ['x'], badge: 'Best Seller', badgeType: 'best', isActive: true, price: 400000, compareAtPrice: 455000, stock: 3, sku: null, createdAt: '2026-01-01T00:00:00.000Z' });
  const legacyVariable = P.buildVariablePayload({ ...sideProduct(), description: '', category: '', images: [], features: [], badge: null, createdAt: '2026-02-01T00:00:00.000Z' });
  await check('S4.6.5/S4.6.6: legacy simple and variable round trip (stored doc as body) is byte-identical except updatedAt; no new key', () => {
    for (const stored of [legacySimple, legacyVariable]) {
      const build = stored.productType === 'simple' ? P.buildSimplePayload : P.buildVariablePayload;
      const again = build({ ...stored }, stored);
      assert.strictEqual(JSON.stringify(withoutUpdatedAt(again)), JSON.stringify(withoutUpdatedAt(stored)), stored.slug);
      for (const k of ['kategoriMotor', 'jualPerSisi', 'bisaSepasang']) assert.ok(!(k in again), `${stored.slug} gained ${k}`);
    }
  });
  await check('S4.6.6: a body without the new fields keeps the stored values (and createdAt) instead of erasing them', () => {
    const stored = { ...legacyVariable, kategoriMotor: ['retro'], jualPerSisi: true, bisaSepasang: false };
    const { kategoriMotor, jualPerSisi, bisaSepasang, createdAt, ...formBody } = stored;
    const out = P.buildVariablePayload(formBody, stored);
    assert.deepStrictEqual([out.kategoriMotor, out.jualPerSisi, out.bisaSepasang, out.createdAt], [['retro'], true, false, '2026-02-01T00:00:00.000Z']);
    const simpleOut = P.buildSimplePayload({ ...legacySimple }, { ...legacySimple, kategoriMotor: ['matic', 'retro'] });
    assert.deepStrictEqual(simpleOut.kategoriMotor, ['matic', 'retro']);
  });
  await check('S4.6.6: body values win over stored; [] clears categories; buildSimplePayload never writes the side flags', () => {
    const stored = { ...legacyVariable, kategoriMotor: ['retro'], bisaSepasang: true };
    const out = P.buildVariablePayload({ ...stored, kategoriMotor: [], bisaSepasang: false }, stored);
    assert.deepStrictEqual([out.kategoriMotor, out.bisaSepasang], [[], false]);
    const s = P.buildSimplePayload({ ...legacySimple, jualPerSisi: false, bisaSepasang: true }, { jualPerSisi: true });
    assert.ok(!('jualPerSisi' in s) && !('bisaSepasang' in s));
  });
  await check('S4.6.6: a stored jualPerSisi true is not carried onto a structure that no longer meets S4.1.1; invalid stored values are left out', () => {
    const stored = { ...legacyVariable, jualPerSisi: true, kategoriMotor: ['vespa'], bisaSepasang: 'ya' };
    const body = { ...legacyVariable, attributes: [{ id: 'w', name: 'Warna', values: ['Hitam'] }], variants: [variant('h', { Warna: 'Hitam' })] };
    delete body.jualPerSisi;
    const out = P.buildVariablePayload(body, stored);
    for (const k of ['jualPerSisi', 'kategoriMotor', 'bisaSepasang']) assert.ok(!(k in out), k);
    assert.strictEqual(P.buildVariablePayload({ ...legacyVariable }, stored).jualPerSisi, true, 'still side-sold -> carried');
  });
  await check('S4.6.7: validation codes and messages (kategori, flags, side structure); legacy bodies still valid', () => {
    const bad = (data) => (data.productType === 'simple' ? P.validateSimpleProduct(data) : P.validateVariableProduct(data));
    const KAT = { code: 'INVALID_KATEGORI_MOTOR', message: 'Kategori motor tidak dikenal.' };
    const FLAG = { code: 'INVALID_SIDE_FLAG', message: 'Nilai sisi harus true atau false.' };
    const SIDE = { code: 'INVALID_SIDE_VARIANTS', message: 'Produk per sisi harus punya varian Kiri dan Kanan.' };
    for (const k of [['vespa'], ['retro', 'retro'], 'retro', null, ['matic', 'adventure', 'retro', 'trail', 'matic'], ['Retro']])
      assert.deepStrictEqual(bad({ ...legacySimple, kategoriMotor: k }), KAT, JSON.stringify(k));
    assert.strictEqual(bad({ ...legacySimple, kategoriMotor: [] }), null);
    assert.strictEqual(bad({ ...legacySimple, kategoriMotor: ['trail', 'matic'] }), null);
    for (const v of ['true', 1, null]) {
      assert.deepStrictEqual(bad({ ...legacyVariable, jualPerSisi: v }), FLAG, `jualPerSisi ${v}`);
      assert.deepStrictEqual(bad({ ...legacyVariable, bisaSepasang: v }), FLAG, `bisaSepasang ${v}`);
    }
    assert.deepStrictEqual(bad({ ...legacySimple, jualPerSisi: true }), SIDE, 'simple product');
    assert.deepStrictEqual(bad({ ...legacyVariable, jualPerSisi: true, attributes: [{ id: 'w', name: 'Warna', values: ['Hitam', 'Abu'] }], variants: [variant('h', { Warna: 'Hitam' }), variant('a', { Warna: 'Abu' })] }), SIDE, 'other structure');
    assert.deepStrictEqual(bad({ ...legacyVariable, jualPerSisi: true, variants: [variant('k', { Sisi: 'Kiri' }), variant('n', { Sisi: 'Kanan' }, { isActive: false })] }), SIDE, 'inactive side');
    assert.strictEqual(bad({ ...legacyVariable, jualPerSisi: true, bisaSepasang: false }), null);
    assert.strictEqual(bad({ ...legacyVariable, jualPerSisi: false }), null);
    assert.strictEqual(bad(legacySimple), null);
    assert.strictEqual(bad(legacyVariable), null);
    assert.deepStrictEqual(bad({ ...legacySimple, price: 0, kategoriMotor: ['x'] }).code, 'INVALID_PRICE', 'existing rules keep precedence');
  });

  // Product API through the real route handlers
  await check('S4.6.9: POST per side saves the S4.6.2 shape with jualPerSisi, bisaSepasang, kategoriMotor; GET -> PUT round trip unchanged except updatedAt', async () => {
    asAdmin(); docs.clear();
    const body = { ...sideProduct(), description: '', category: 'softcase', images: [], features: [], badge: null, jualPerSisi: true, bisaSepasang: true, kategoriMotor: ['retro'] };
    const r = await products.POST(req(body));
    assert.strictEqual(r.status, 201);
    const saved = docs.get('products/side-bag-inzta-xsr-155');
    assert.deepStrictEqual([saved.jualPerSisi, saved.bisaSepasang, saved.kategoriMotor, saved.productType], [true, true, ['retro'], 'variable']);
    assert.deepStrictEqual(saved.variants.map(v => [v.variationId, v.attributes.Sisi, v.isActive]), [['v-kiri', 'Kiri', true], ['v-kanan', 'Kanan', true]]);
    const { product: loaded } = await (await product.GET(req(null, 'GET'), p('side-bag-inzta-xsr-155'))).json();
    assert.strictEqual((await product.PUT(req(loaded, 'PUT'), p('side-bag-inzta-xsr-155'))).status, 200);
    assert.strictEqual(JSON.stringify(withoutUpdatedAt(docs.get('products/side-bag-inzta-xsr-155'))), JSON.stringify(withoutUpdatedAt(saved)));
  });
  await check('S4.6.5/S4.6.8: legacy product GET -> PUT round trip writes no new field and is unchanged except updatedAt', async () => {
    asAdmin(); docs.clear();
    docs.set('products/tankbag-tk-5', legacySimple);
    const { product: loaded } = await (await product.GET(req(null, 'GET'), p('tankbag-tk-5'))).json();
    assert.strictEqual((await product.PUT(req(loaded, 'PUT'), p('tankbag-tk-5'))).status, 200);
    assert.strictEqual(JSON.stringify(withoutUpdatedAt(docs.get('products/tankbag-tk-5'))), JSON.stringify(withoutUpdatedAt(legacySimple)));
  });
  await check('S4.6.7/S4.6.9: invalid kategori and jualPerSisi with a wrong structure -> 400 with code, no write (POST and PUT)', async () => {
    asAdmin(); docs.clear();
    docs.set('products/tankbag-tk-5', legacySimple);
    const w = counters.writes;
    let r = await products.POST(req({ ...legacySimple, slug: 'baru-1', kategoriMotor: ['vespa'] }));
    assert.strictEqual(r.status, 400);
    assert.strictEqual((await r.json()).code, 'INVALID_KATEGORI_MOTOR');
    r = await product.PUT(req({ ...legacySimple, jualPerSisi: true }, 'PUT'), p('tankbag-tk-5'));
    assert.strictEqual(r.status, 400);
    assert.deepStrictEqual(await r.json(), { code: 'INVALID_SIDE_VARIANTS', message: 'Produk per sisi harus punya varian Kiri dan Kanan.' });
    r = await product.PUT(req({ ...legacySimple, bisaSepasang: 'ya' }, 'PUT'), p('tankbag-tk-5'));
    assert.strictEqual((await r.json()).code, 'INVALID_SIDE_FLAG');
    assert.strictEqual(counters.writes, w);
    assert.strictEqual(docs.get('products/tankbag-tk-5'), legacySimple);
  });
  await check('S4.6.9: rename (POST new slug + DELETE old) keeps kategoriMotor and the side flags from the body', async () => {
    asAdmin(); docs.clear();
    const old = { ...legacyVariable, kategoriMotor: ['retro'], jualPerSisi: true, bisaSepasang: false };
    docs.set('products/side-bag-inzta-xsr-155', old);
    const { product: loaded } = await (await product.GET(req(null, 'GET'), p('side-bag-inzta-xsr-155'))).json();
    assert.strictEqual((await products.POST(req({ ...loaded, slug: 'side-bag-xsr-155-baru' }))).status, 201);
    assert.strictEqual((await product.DELETE(req(null, 'DELETE'), p('side-bag-inzta-xsr-155'))).status, 200);
    const moved = docs.get('products/side-bag-xsr-155-baru');
    assert.deepStrictEqual([moved.kategoriMotor, moved.jualPerSisi, moved.bisaSepasang], [['retro'], true, false]);
    assert.ok(!docs.has('products/side-bag-inzta-xsr-155'));
  });

  // Article API (S6.8.1-S6.8.3, S6.8.7)
  const draft = (slug, extra = {}) => ({ title: 'Judul', slug, ...extra });
  const stored = (slug) => docs.get('articles/' + slug);
  await check('S6.8.7: each valid topik is stored and returned', async () => {
    asAdmin(); docs.clear();
    for (const topik of ['memilih-tas', 'per-motor', 'touring', 'adventure', 'motocamp', 'komunitas']) {
      const r = await articles.POST(req(draft(`t-${topik}`, { topik })));
      assert.strictEqual(r.status, 201, topik);
      assert.strictEqual(stored(`t-${topik}`).topik, topik);
      assert.strictEqual((await r.json()).item.topik, topik);
    }
  });
  await check('S6.8.1/S6.8.7: invalid topik -> 400 starting "topik:", no write', async () => {
    asAdmin(); docs.clear();
    for (const topik of ['review', 'Touring', 3, ['touring'], {}]) {
      const w = counters.writes;
      const r = await articles.POST(req(draft('x-bad', { topik })));
      assert.strictEqual(r.status, 400, JSON.stringify(topik));
      assert.strictEqual((await r.json()).error, 'topik: pilih salah satu topik yang tersedia');
      assert.strictEqual(counters.writes, w);
    }
  });
  await check('S6.8.1/S6.8.7: null or "" -> stored as "" with kategoriMotor []', async () => {
    asAdmin(); docs.clear();
    await articles.POST(req(draft('n-null', { topik: null, kategoriMotor: ['retro'] })));
    await articles.POST(req(draft('n-empty', { topik: '' })));
    assert.deepStrictEqual([stored('n-null').topik, stored('n-null').kategoriMotor], ['', []]);
    assert.deepStrictEqual([stored('n-empty').topik, stored('n-empty').kategoriMotor], ['', []]);
  });
  await check('S6.8.2: no topik key -> neither field stored on POST; PUT without the key keeps the stored values', async () => {
    asAdmin(); docs.clear();
    await articles.POST(req(draft('keep')));
    assert.ok(!('topik' in stored('keep')) && !('kategoriMotor' in stored('keep')));
    assert.strictEqual((await article.PUT(req({ title: 'Judul', topik: 'per-motor', kategoriMotor: ['retro'] }, 'PUT'), p('keep'))).status, 200);
    assert.strictEqual((await article.PUT(req({ title: 'Judul baru', kategoriMotor: ['matic'] }, 'PUT'), p('keep'))).status, 200);
    assert.deepStrictEqual([stored('keep').title, stored('keep').topik, stored('keep').kategoriMotor], ['Judul baru', 'per-motor', ['retro']]);
  });
  await check('S6.8.3/S6.8.7: per-motor with categories (deduplicated, D1 order); missing list -> []', async () => {
    asAdmin(); docs.clear();
    await articles.POST(req(draft('pm', { topik: 'per-motor', kategoriMotor: ['retro', 'matic', 'retro'] })));
    assert.deepStrictEqual(stored('pm').kategoriMotor, ['matic', 'retro']);
    await articles.POST(req(draft('pm-none', { topik: 'per-motor' })));
    assert.deepStrictEqual(stored('pm-none').kategoriMotor, []);
  });
  await check('S6.8.3/S6.8.7: unknown category or a non-array -> 400 starting "kategoriMotor:", no write', async () => {
    asAdmin(); docs.clear();
    for (const kategoriMotor of [['vespa'], 'retro', [1], { retro: true }]) {
      const w = counters.writes;
      const r = await articles.POST(req(draft('pm-bad', { topik: 'per-motor', kategoriMotor })));
      assert.strictEqual(r.status, 400, JSON.stringify(kategoriMotor));
      assert.strictEqual((await r.json()).error, 'kategoriMotor: pilih dari Matic, Adventure, Retro, Trail');
      assert.strictEqual(counters.writes, w);
    }
  });
  await check('F-017: kategoriMotor kept for any topic; no topic -> stored as []', async () => {
    asAdmin(); docs.clear();
    await articles.POST(req(draft('away', { topik: 'per-motor', kategoriMotor: ['trail'] })));
    assert.strictEqual((await article.PUT(req({ title: 'Judul', topik: 'touring', kategoriMotor: ['trail', 'adventure'] }, 'PUT'), p('away'))).status, 200);
    assert.deepStrictEqual([stored('away').topik, stored('away').kategoriMotor], ['touring', ['adventure', 'trail']]);
    assert.strictEqual((await article.PUT(req({ title: 'Judul', topik: '', kategoriMotor: ['trail'] }, 'PUT'), p('away'))).status, 200);
    assert.deepStrictEqual([stored('away').topik, stored('away').kategoriMotor], ['', []]);
    await articles.POST(req(draft('mc', { topik: 'motocamp', kategoriMotor: ['matic'] })));
    assert.deepStrictEqual([stored('mc').topik, stored('mc').kategoriMotor], ['motocamp', ['matic']]);
  });
  await check('S6.8.7: unknown fields are still dropped alongside topik', async () => {
    asAdmin(); docs.clear();
    await articles.POST(req(draft('drop', { topik: 'touring', hacker: 1, status: 'published' })));
    assert.deepStrictEqual(['hacker' in stored('drop'), stored('drop').status, stored('drop').topik], [false, 'draft', 'touring']);
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
