// F-002: UTM first-touch sanitation/storage, tracking gates and IDs, and UTM persistence in POST /api/orders.
// Runs the real modules with an in-memory Firestore and stubbed modules, like tests/f001-content.cjs.
// Usage: npm run test:tracking  (or: node tests/f002-tracking.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const sets = []; // [collection, id, value] for every set()

function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => ({ exists: docs.has(key), id, data: () => docs.get(key) }),
    set: async (value, opts) => {
      sets.push([col, id, value]);
      docs.set(key, opts && opts.merge ? { ...(docs.get(key) || {}), ...value } : value);
    },
  };
}
const fakeDb = { collection: (col) => ({ doc: (id) => docRef(col, id) }) };
const stubs = {
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => ({}), hasAdminCredentials: () => true },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) {
    const abs = path.resolve(path.dirname(parent.filename), request);
    if (stubs[abs]) return abs;
  }
  if (stubs[request]) return request;
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const resolved = request.startsWith('@/') ? path.join(ROOT, request.slice(2)) : request;
  if (stubs[resolved]) return stubs[resolved];
  if (resolved.startsWith('.') && parent) {
    const abs = path.resolve(path.dirname(parent.filename), resolved);
    if (stubs[abs]) return stubs[abs];
  }
  return origLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const utm = require(path.join(ROOT, 'lib/utm.ts'));
const tracking = require(path.join(ROOT, 'lib/tracking.ts'));
const orders = require(path.join(ROOT, 'app/api/orders/route.ts'));

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
const req = (body) => new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const quiet = async (fn) => { const w = console.warn, e = console.error; console.warn = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.error = e; } };

function memStorage({ throwOnSet = false } = {}) {
  const m = new Map();
  return {
    map: m,
    writes: 0,
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { if (throwOnSet) throw new Error('QuotaExceededError'); this.writes++; m.set(k, String(v)); },
  };
}
const params = (qs) => new URLSearchParams(qs);
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-10-01T00:00:00.000Z');

function seed() {
  docs.clear();
  sets.length = 0;
  docs.set('products/tas-simple', { name: 'Tas Simple', productType: 'simple', isActive: true, price: 150000, stock: 5, images: ['https://img/x.jpg'] });
  docs.set('vouchers/HEMAT10', { isActive: true, type: 'percentage', value: 10 });
}
const orderBody = (extra) => ({ items: [{ productSlug: 'tas-simple', quantity: 1 }], ...extra });
const orderSets = () => sets.filter(([c]) => c === 'orders');

(async () => {
  // ── sanitizeUtm ────────────────────────────────────────────────────────────
  await check('sanitizeUtm: whitelist keys, foreign keys (fbclid/gclid/ip) dropped', () => {
    const out = utm.sanitizeUtm({ source: 'ig', medium: 'social', campaign: 'launch', content: 'reel', term: 'tas', fbclid: 'abc', gclid: 'def', ip: '1.2.3.4' });
    assert.deepStrictEqual(out, { source: 'ig', medium: 'social', campaign: 'launch', content: 'reel', term: 'tas' });
  });
  await check('sanitizeUtm: non-string values dropped', () => {
    const out = utm.sanitizeUtm({ source: 'ig', medium: 5, campaign: { x: 1 }, content: ['a'], term: true });
    assert.deepStrictEqual(out, { source: 'ig' });
  });
  await check('sanitizeUtm: trim + lowercase', () => {
    assert.deepStrictEqual(utm.sanitizeUtm({ source: '  InstaGram  ', medium: 'CPC' }), { source: 'instagram', medium: 'cpc' });
  });
  await check('sanitizeUtm: control chars and < > " \' ` removed', () => {
    const out = utm.sanitizeUtm({ source: '<script>"a\'b`c\u0000\u001f\u007f</script>' });
    assert.strictEqual(out.source, 'scriptabc/script');
    assert.ok(!/[\u0000-\u001f\u007f<>"'`]/.test(out.source));
  });
  await check('sanitizeUtm: values cut at 100 chars', () => {
    const out = utm.sanitizeUtm({ source: 'x'.repeat(10000), campaign: 'y'.repeat(101) });
    assert.strictEqual(out.source.length, 100);
    assert.strictEqual(out.campaign.length, 100);
  });
  await check('sanitizeUtm: landingPath pathname only (query/hash dropped), max 200', () => {
    assert.strictEqual(utm.sanitizeUtm({ source: 'ig', landingPath: '/produk/tas?utm_source=ig&x=1#top' }).landingPath, '/produk/tas');
    assert.strictEqual(utm.sanitizeUtm({ source: 'ig', landingPath: '/a#b?c' }).landingPath, '/a');
    assert.strictEqual(utm.sanitizeUtm({ source: 'ig', landingPath: '/' + 'p'.repeat(500) }).landingPath.length, 200);
    assert.strictEqual(utm.sanitizeUtm({ source: 'ig', landingPath: 42 }).landingPath, undefined);
  });
  await check('sanitizeUtm: capturedAt valid ISO kept (normalized), invalid dropped', () => {
    assert.strictEqual(utm.sanitizeUtm({ source: 'ig', capturedAt: '2026-10-01T00:00:00Z' }).capturedAt, '2026-10-01T00:00:00.000Z');
    for (const bad of ['bukan tanggal', '', 12345, null, '2026-10-01T00:00:00.000Z' + ' '.repeat(40)]) {
      assert.ok(!('capturedAt' in utm.sanitizeUtm({ source: 'ig', capturedAt: bad })), 'kept ' + JSON.stringify(bad));
    }
  });
  await check('sanitizeUtm: null when source/medium/campaign all empty', () => {
    assert.strictEqual(utm.sanitizeUtm({}), null);
    assert.strictEqual(utm.sanitizeUtm({ content: 'a', term: 'b', landingPath: '/x', capturedAt: '2026-10-01T00:00:00Z' }), null);
    assert.strictEqual(utm.sanitizeUtm({ source: '   ', medium: '<>', campaign: '' }), null);
  });
  await check('sanitizeUtm: null for non-object / array / null input', () => {
    for (const v of [null, undefined, 'utm_source=ig', 42, true, [], [{ source: 'ig' }]]) assert.strictEqual(utm.sanitizeUtm(v), null, JSON.stringify(v));
  });

  // ── first-touch storage ───────────────────────────────────────────────────
  await check('captureFirstTouchUtm: writes when URL has UTM', () => {
    const s = memStorage();
    utm.captureFirstTouchUtm(params('utm_source=IG&utm_medium=social&utm_campaign=launch&fbclid=zz'), '/produk/tas', s, T0);
    assert.strictEqual(s.writes, 1);
    assert.deepStrictEqual(JSON.parse(s.map.get(utm.FIRST_UTM_KEY)), { source: 'ig', medium: 'social', campaign: 'launch', landingPath: '/produk/tas', capturedAt: new Date(T0).toISOString() });
    assert.deepStrictEqual(utm.readFirstTouchUtm(s, T0 + 1000).source, 'ig');
  });
  await check('captureFirstTouchUtm: first touch kept, second UTM visit does not overwrite', () => {
    const s = memStorage();
    utm.captureFirstTouchUtm(params('utm_source=ig'), '/', s, T0);
    utm.captureFirstTouchUtm(params('utm_source=google&utm_medium=cpc'), '/produk/x', s, T0 + 5 * DAY);
    assert.strictEqual(s.writes, 1);
    assert.strictEqual(utm.readFirstTouchUtm(s, T0 + 5 * DAY).source, 'ig');
  });
  await check('first touch: expired after 31 days, next UTM visit replaces it', () => {
    const s = memStorage();
    utm.captureFirstTouchUtm(params('utm_source=ig'), '/', s, T0);
    assert.strictEqual(utm.readFirstTouchUtm(s, T0 + 31 * DAY), null);
    utm.captureFirstTouchUtm(params('utm_source=google'), '/b', s, T0 + 31 * DAY);
    assert.strictEqual(s.writes, 2);
    const now = utm.readFirstTouchUtm(s, T0 + 31 * DAY);
    assert.strictEqual(now.source, 'google');
    assert.strictEqual(now.landingPath, '/b');
  });
  await check('first touch: corrupt JSON record ignored and replaced', () => {
    const s = memStorage();
    s.map.set(utm.FIRST_UTM_KEY, '{not json');
    assert.strictEqual(utm.readFirstTouchUtm(s, T0), null);
    utm.captureFirstTouchUtm(params('utm_campaign=promo'), '/', s, T0);
    assert.strictEqual(utm.readFirstTouchUtm(s, T0).campaign, 'promo');
  });
  await check('captureFirstTouchUtm: URL without UTM writes nothing', () => {
    const s = memStorage();
    utm.captureFirstTouchUtm(params(''), '/', s, T0);
    utm.captureFirstTouchUtm(params('fbclid=x&gclid=y&utm_content=a&utm_term=b'), '/', s, T0);
    assert.strictEqual(s.writes, 0);
    assert.strictEqual(s.map.size, 0);
  });
  await check('captureFirstTouchUtm: throwing storage and null storage are safe', () => {
    const s = memStorage({ throwOnSet: true });
    assert.doesNotThrow(() => utm.captureFirstTouchUtm(params('utm_source=ig'), '/', s, T0));
    assert.doesNotThrow(() => utm.captureFirstTouchUtm(params('utm_source=ig'), '/', null, T0));
    assert.strictEqual(utm.readFirstTouchUtm(null, T0), null);
    const throwingGet = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('SecurityError'); } };
    assert.doesNotThrow(() => utm.captureFirstTouchUtm(params('utm_source=ig'), '/', throwingGet, T0));
    assert.strictEqual(utm.readFirstTouchUtm(throwingGet, T0), null);
  });

  // ── tracking gates and IDs ────────────────────────────────────────────────
  await check('isTrackedPath: public pages tracked, /admin and /affiliate subtrees not', () => {
    for (const p of ['/', '/produk/x', '/administrasi']) assert.strictEqual(tracking.isTrackedPath(p), true, p);
    for (const p of ['/admin', '/admin/orders', '/affiliate', '/affiliate/login']) assert.strictEqual(tracking.isTrackedPath(p), false, p);
  });
  await check('validId: GA4 and Pixel ID patterns', () => {
    const { validId, GA_ID_PATTERN: GA, PIXEL_ID_PATTERN: PX } = tracking;
    assert.strictEqual(validId('G-LF9KDQVV33', GA), 'G-LF9KDQVV33');
    assert.strictEqual(validId('  G-LF9KDQVV33 ', GA), 'G-LF9KDQVV33');
    for (const bad of ['G-x', 'UA-123', "G-ABC';alert(1)//"]) assert.strictEqual(validId(bad, GA), null, bad);
    assert.strictEqual(validId('123456789012345', PX), '123456789012345');
    for (const bad of ['12ab', '123']) assert.strictEqual(validId(bad, PX), null, bad);
    assert.strictEqual(validId(undefined, GA), null);
    assert.strictEqual(validId(undefined, PX), null);
  });

  // ── trackLead: Contact (eventID = orderId) + generate_lead, sinkron ────────
  const lead = { orderId: 'ORD-TEST01', value: 150000, slugs: ['gokill'] };
  function fakeWindow(pathname, withGtag) {
    const calls = [];
    global.window = {
      location: { pathname },
      fbq: (...a) => calls.push(['fbq', ...a]),
      gtag: withGtag ? (...a) => calls.push(['gtag', ...a]) : undefined,
    };
    return calls;
  }
  await check('trackLead: Contact with eventID = orderId and generate_lead with lead_source', () => {
    const calls = fakeWindow('/produk/gokill', true);
    tracking.trackLead(lead, 'product_list');
    const contact = calls.filter((c) => c[0] === 'fbq' && c[2] === 'Contact');
    assert.strictEqual(contact.length, 1);
    assert.deepStrictEqual(contact[0][3], { content_ids: ['gokill'], content_type: 'product', value: 150000, currency: 'IDR' });
    assert.deepStrictEqual(contact[0][4], { eventID: 'ORD-TEST01' });
    const ga = calls.filter((c) => c[0] === 'gtag');
    assert.strictEqual(ga.length, 1);
    assert.deepStrictEqual(ga[0].slice(1), ['event', 'generate_lead', { currency: 'IDR', value: 150000, lead_source: 'product_list' }]);
  });
  await check('trackLead: vendor missing or throwing never throws to the order flow', () => {
    fakeWindow('/produk/gokill', false);
    tracking.trackLead(lead, 'product');
    global.window.fbq = () => { throw new Error('blocked'); };
    global.window.gtag = () => { throw new Error('blocked'); };
    tracking.trackLead(lead, 'product');
  });
  await check('trackLead: untracked path -> no vendor call', () => {
    const calls = fakeWindow('/admin/orders', true);
    tracking.trackLead(lead, 'product');
    assert.strictEqual(calls.length, 0);
    delete global.window;
  });

  // ── POST /api/orders ──────────────────────────────────────────────────────
  let baselineKeys;
  seed();
  await check('POST /api/orders without utm: 201, one orders set(), utm: null', async () => {
    const res = await orders.POST(req(orderBody()));
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    baselineKeys = Object.keys(json).sort();
    assert.ok(/^ORD-[A-Z0-9]{6}$/.test(json.orderId));
    assert.strictEqual(orderSets().length, 1);
    const [, id, doc] = orderSets()[0];
    assert.strictEqual(id, json.orderId);
    assert.strictEqual(doc.utm, null);
    assert.ok(!('utm' in json), 'utm leaked into response');
  });

  seed();
  await check('POST /api/orders with valid utm: 201, one orders set(), sanitized utm stored', async () => {
    const res = await orders.POST(req(orderBody({
      voucherCode: 'hemat10',
      utm: { source: ' IG ', medium: 'Social', campaign: 'Launch<1>', fbclid: 'zz', landingPath: '/produk/tas?utm_source=ig', capturedAt: '2026-10-01T00:00:00Z' },
    })));
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.deepStrictEqual(Object.keys(json).sort(), baselineKeys);
    assert.strictEqual(json.discountAmount, 15000);
    assert.strictEqual(orderSets().length, 1);
    const doc = orderSets()[0][2];
    assert.deepStrictEqual(doc.utm, { source: 'ig', medium: 'social', campaign: 'launch1', landingPath: '/produk/tas', capturedAt: '2026-10-01T00:00:00.000Z' });
    assert.strictEqual(doc.voucherCode, 'HEMAT10');
    assert.strictEqual(doc.finalPrice, 135000);
  });

  const badUtms = [
    ['string', 'utm_source=ig', null],
    ['array', [{ source: 'ig' }], null],
    ['number', 12345, null],
    ['object without source/medium/campaign', { content: 'x', fbclid: 'y' }, null],
    ['oversized source (10k chars)', { source: 's'.repeat(10000) }, { source: 's'.repeat(100) }],
  ];
  for (const [label, bad, expected] of badUtms) {
    seed();
    await check(`POST /api/orders with bad utm (${label}): still 201, same response keys, utm ${expected ? 'truncated' : 'null'}`, async () => {
      const res = await quiet(() => orders.POST(req(orderBody({ utm: bad }))));
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.deepStrictEqual(Object.keys(json).sort(), baselineKeys);
      assert.strictEqual(orderSets().length, 1);
      assert.deepStrictEqual(orderSets()[0][2].utm, expected);
    });
  }

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
