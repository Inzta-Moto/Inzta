// F-023 (ADR-0030): PATCH /api/automation/products, the token route inzta-hq updates product text through.
// Same harness as tests/f010-automation.cjs: the real route handler with an in-memory Firestore (getAll, batch with
// lastUpdateTime preconditions, all-or-nothing commit) and stubbed Next.js APIs.
// Usage: npm run test:product-automation  (or: node tests/f023-product-automation.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const versions = new Map();
const revalidated = [];
const counters = { reads: 0, writes: 0, commits: 0 };
const state = { failGetAll: false, beforeCommit: null, failCommit: null };

function bump(key) { versions.set(key, (versions.get(key) || 0) + 1); }
const updateTimeOf = (key) => (docs.has(key) ? { seconds: 1762000000 + versions.get(key), nanoseconds: 5000 } : undefined);
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    key,
    get: async () => {
      counters.reads++;
      return { exists: docs.has(key), id, data: () => docs.get(key), updateTime: updateTimeOf(key) };
    },
    set: async (value) => { counters.writes++; docs.set(key, value); bump(key); },
  };
}
function batch() {
  const ops = [];
  return {
    update(ref, value, precondition) { ops.push({ ref, value, precondition }); return this; },
    async commit() {
      if (state.beforeCommit) { const fn = state.beforeCommit; state.beforeCommit = null; fn(); }
      if (state.failCommit) throw state.failCommit;
      // Validate every operation before applying any, like Firestore's atomic commit.
      for (const { ref, precondition } of ops) {
        if (!docs.has(ref.key)) { const e = new Error('5 NOT_FOUND'); e.code = 5; throw e; }
        const now = updateTimeOf(ref.key);
        if (precondition && precondition.lastUpdateTime &&
            (precondition.lastUpdateTime.seconds !== now.seconds || precondition.lastUpdateTime.nanoseconds !== now.nanoseconds)) {
          const e = new Error('9 FAILED_PRECONDITION: the stored version does not match'); e.code = 9; throw e;
        }
      }
      for (const { ref, value } of ops) { counters.writes++; docs.set(ref.key, { ...docs.get(ref.key), ...value }); bump(ref.key); }
      counters.commits++;
    },
  };
}
const fakeDb = {
  getAll: async (...refs) => {
    if (state.failGetAll) throw new Error('14 UNAVAILABLE: firestore down');
    return Promise.all(refs.map(r => r.get()));
  },
  batch,
  collection: (col) => ({ doc: (id) => docRef(col, id) }),
};
const stubs = {
  react: { cache: (fn) => fn },
  'next/headers': { cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }) },
  'next/cache': { revalidatePath: (p) => { revalidated.push(p); } },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => ({}), hasAdminCredentials: () => true },
  // Admin PUT (review REV-03): the session check itself is covered by tests/f000-auth.cjs.
  [path.join(ROOT, 'lib/auth')]: { requireAdmin: async () => ({ ok: true }) },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
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
  return origLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const route = require(path.join(ROOT, 'app/api/automation/products/route.ts'));
const adminProduct = require(path.join(ROOT, 'app/api/products/[slug]/route.ts'));
const automationAuth = require(path.join(ROOT, 'lib/automation-auth.ts'));
const rules = require(path.join(ROOT, 'lib/product-automation.ts'));

const results = [];
async function check(name, fn) {
  automationAuth.resetAutomationRateLimit();
  Object.assign(state, { failGetAll: false, beforeCommit: null, failCommit: null });
  seed();
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
const quiet = async (fn) => { const w = console.warn, e = console.error, i = console.info; console.warn = console.error = console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.error = e; console.info = i; } };

const TOKEN_A = 'a'.repeat(20) + 'Angkasa-token-0123456789';
const TOKEN_S = 's'.repeat(20) + 'Sehan-token-0123456789xx';
function setTokens(map) {
  for (const k of Object.keys(process.env)) if (k.startsWith('AUTOMATION_TOKEN_')) delete process.env[k];
  Object.assign(process.env, map);
}
const req = (body, { token = TOKEN_A, headers = {}, method = 'PATCH' } = {}) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const h = { 'content-type': 'application/json', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  return new Request('http://localhost/api/automation/products', { method, body: raw, headers: h });
};
const call = async (body, opts) => {
  const r = await quiet(() => route.PATCH(req(body, opts)));
  return { status: r.status, json: await r.json() };
};

// A variable product with orders on its variants: the route must never touch any of these other fields.
const TOURMAX = {
  name: 'Tail bag Inzta Tourmax 30', slug: 'tail-bag-inzta-tourmax-30', description: 'Deskripsi lama ✅cordua 600',
  category: 'softcase', productType: 'variable', images: ['https://res.cloudinary.com/dukddlp0b/image/upload/v1/a.jpg'],
  features: ['Extend'], badge: 'Best', isActive: true,
  attributes: [{ id: 'att', name: 'Warna', values: ['Hitam'] }],
  variants: [{ variationId: 'v1', sku: 'TM-30', attributes: { Warna: 'Hitam' }, price: 450000, compareAtPrice: null, stock: 4, images: [], isActive: true }],
  priceFrom: 450000, priceTo: 450000, totalStock: 4, kategoriMotor: ['matic'], createdAt: '2026-01-01T00:00:00.000Z',
};
const SCRAMBAG = {
  name: 'Side bag Inzta XSR Srcrambag', slug: 'side-bag-inzta-xsr-srcrambag', description: 'Lama', category: 'hardcase',
  productType: 'simple', price: 300000, compareAtPrice: null, stock: 2, sku: null, images: [], features: [], isActive: false,
};
function seed() {
  docs.clear(); versions.clear(); revalidated.length = 0;
  Object.assign(counters, { reads: 0, writes: 0, commits: 0 });
  docs.set('products/tail-bag-inzta-tourmax-30', JSON.parse(JSON.stringify(TOURMAX))); bump('products/tail-bag-inzta-tourmax-30');
  docs.set('products/side-bag-inzta-xsr-srcrambag', JSON.parse(JSON.stringify(SCRAMBAG))); bump('products/side-bag-inzta-xsr-srcrambag');
}
const stored = (slug) => docs.get('products/' + slug);
const NEW_DESC = 'INZTA Tourmax 30L\nTail bag.\r\n\r\nSpesifikasi:\n- Bahan luar: Cordura 600D\n\n';
const tourmax = (extra = {}) => ({ slug: 'tail-bag-inzta-tourmax-30', description: NEW_DESC, kategoriMotor: ['adventure', 'matic'], ...extra });
// A real client takes expectedVersion from its dry run; here it is read from the fake store (null for a missing slug).
const versionNow = (slug) => rules.versionOf(updateTimeOf('products/' + slug));
const write = (items) => ({ dryRun: false, items: items.map(i => ('expectedVersion' in i ? i : { ...i, expectedVersion: versionNow(i.slug) })) });
const writeRaw = (items) => ({ dryRun: false, items });

(async () => {
  setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S });

  await check('only PATCH and dynamic are exported (Next.js route export rule)', async () => {
    assert.deepStrictEqual(Object.keys(route).sort(), ['PATCH', 'dynamic']);
  });

  // ── Token, rate limit, size ────────────────────────────────────────────────
  await check('no token -> 401, nothing read', async () => {
    const r = await call(write([tourmax()]), { token: null });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(counters.reads, 0);
  });
  await check('wrong token -> 401, nothing read or written', async () => {
    const r = await call(write([tourmax()]), { token: 'x'.repeat(44) });
    assert.strictEqual(r.status, 401);
    assert.strictEqual(counters.reads + counters.writes, 0);
    assert.strictEqual(stored('tail-bag-inzta-tourmax-30').description, TOURMAX.description);
  });
  await check('no AUTOMATION_TOKEN_<NAME> configured -> 503 with a generic message', async () => {
    setTokens({});
    try {
      const r = await call(write([tourmax()]));
      assert.strictEqual(r.status, 503);
      assert.strictEqual(r.json.error, 'Otomasi belum diaktifkan di server');
    } finally { setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S }); }
  });
  await check('Content-Length over 200 KB -> 413 before the token is checked', async () => {
    const r = await call(write([tourmax()]), { token: null, headers: { 'content-length': String(200 * 1024 + 1) } });
    assert.strictEqual(r.status, 413);
  });
  await check('real body over 200 KB without a usable Content-Length -> 413', async () => {
    const big = JSON.stringify(write([tourmax({ description: 'x'.repeat(210 * 1024) })]));
    const r = await call(big);
    assert.strictEqual(r.status, 413);
    assert.strictEqual(counters.reads, 0);
  });
  await check('the 21st request in an hour from one token -> 429; another token still works', async () => {
    for (let i = 0; i < 20; i++) assert.strictEqual((await call({ items: [tourmax()] })).status, 200);
    assert.strictEqual((await call({ items: [tourmax()] })).status, 429);
    assert.strictEqual((await call({ items: [tourmax()] }, { token: TOKEN_S })).status, 200);
  });

  // ── Body validation (nothing read) ─────────────────────────────────────────
  const bad = async (body, pattern) => {
    const r = await call(body);
    assert.strictEqual(r.status, 400, JSON.stringify(r.json));
    assert.match(r.json.error, pattern);
    assert.strictEqual(counters.reads, 0);
  };
  await check('invalid JSON -> 400', async () => { await bad('{', /format data/); });
  await check('array body -> 400', async () => { await bad([tourmax()], /format data/); });
  await check('unknown top-level key -> 400', async () => { await bad({ items: [tourmax()], publish: true }, /publish: field tidak dikenal/); });
  await check('dryRun not boolean -> 400', async () => { await bad({ dryRun: 'false', items: [tourmax()] }, /dryRun/); });
  await check('empty items -> 400', async () => { await bad({ dryRun: false, items: [] }, /minimal satu/); });
  await check('more than 50 items -> 400', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ slug: `p-${i}`, description: 'x' }));
    await bad(write(items), /maksimal 50/);
  });
  for (const field of ['price', 'stock', 'variants', 'images', 'isActive', 'category', 'features', 'badge', 'createdAt', 'updatedAt']) {
    await check(`item field "${field}" is refused (only name, description, kategoriMotor)`, async () => {
      await bad(write([tourmax({ [field]: field === 'variants' ? [] : 1 })]), new RegExp(`${field}: field tidak boleh diubah`));
    });
  }
  await check('invalid slug (path traversal) -> 400', async () => { await bad(write([{ slug: '../orders/x', description: 'a' }]), /slug: tidak valid/); });
  await check('duplicate slug -> 400', async () => { await bad(write([tourmax(), tourmax()]), /muncul dua kali/); });
  await check('item without any text field -> 400', async () => { await bad(write([{ slug: 'tail-bag-inzta-tourmax-30' }]), /tidak ada field/); });
  await check('empty description -> 400', async () => { await bad(write([tourmax({ description: ' \n ' })]), /description: tidak boleh kosong/); });
  await check('description over 5000 characters -> 400', async () => { await bad(write([tourmax({ description: 'x'.repeat(5001) })]), /lebih dari 5000/); });
  await check('description with a control character -> 400', async () => { await bad(write([tourmax({ description: 'a\u0007b' })]), /karakter kontrol/); });
  await check('name with a newline -> 400', async () => { await bad(write([tourmax({ name: 'a\nb' })]), /name: berisi karakter kontrol/); });
  await check('empty name -> 400', async () => { await bad(write([tourmax({ name: '  ' })]), /name: tidak boleh kosong/); });
  await check('name over 120 characters -> 400', async () => { await bad(write([tourmax({ name: 'x'.repeat(121) })]), /lebih dari 120/); });
  await check('unknown motor category -> 400', async () => { await bad(write([tourmax({ kategoriMotor: ['matic', 'bebek'] })]), /kategoriMotor/); });
  await check('duplicate motor category -> 400', async () => { await bad(write([tourmax({ kategoriMotor: ['matic', 'matic'] })]), /kategoriMotor/); });
  await check('expectedVersion not a string -> 400', async () => { await bad(write([tourmax({ expectedVersion: 5 })]), /expectedVersion/); });
  await check('REV-06: a write without expectedVersion -> 400 before any read; a dry run does not need it', async () => {
    await bad(writeRaw([tourmax()]), /expectedVersion: wajib saat menulis/);
    assert.strictEqual((await call({ items: [tourmax()] })).status, 200);
  });

  // ── Dry run ────────────────────────────────────────────────────────────────
  await check('missing dryRun means dry run: values returned, nothing written or revalidated', async () => {
    const r = await call({ items: [tourmax()] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.dryRun, true);
    const item = r.json.items[0];
    assert.strictEqual(item.slug, 'tail-bag-inzta-tourmax-30');
    assert.strictEqual(item.isActive, true);
    assert.deepStrictEqual(item.current, { name: TOURMAX.name, description: TOURMAX.description, kategoriMotor: ['matic'] });
    assert.deepStrictEqual(item.changes, ['description', 'kategoriMotor']);
    assert.match(item.version, /^\d+\.\d{9}$/);
    assert.strictEqual(counters.writes, 0);
    assert.strictEqual(revalidated.length, 0);
  });
  await check('dry run of a legacy product without kategoriMotor reports null and a change', async () => {
    const r = await call({ items: [{ slug: 'side-bag-inzta-xsr-srcrambag', kategoriMotor: [] }] });
    assert.strictEqual(r.json.items[0].current.kategoriMotor, null);
    assert.deepStrictEqual(r.json.items[0].changes, ['kategoriMotor']);
    assert.strictEqual(r.json.items[0].isActive, false);
  });
  await check('one missing slug -> 404 listing it, nothing written (dry run and write)', async () => {
    for (const dryRun of [true, false]) {
      const items = [tourmax(), { slug: 'tidak-ada', description: 'x' }];
      const r = await call(dryRun ? { dryRun, items } : write(items));
      assert.strictEqual(r.status, 404);
      assert.deepStrictEqual(r.json.missing, ['tidak-ada']);
    }
    assert.strictEqual(counters.writes, 0);
    assert.strictEqual(stored('tail-bag-inzta-tourmax-30').description, TOURMAX.description);
  });

  // ── Write ──────────────────────────────────────────────────────────────────
  await check('write changes only the sent text fields; price, stock, variants, photos, status stay', async () => {
    const r = await call(write([tourmax()]), { token: TOKEN_S });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.deepStrictEqual(r.json.updated, ['tail-bag-inzta-tourmax-30']);
    const after = stored('tail-bag-inzta-tourmax-30');
    assert.strictEqual(after.description, 'INZTA Tourmax 30L\nTail bag.\n\nSpesifikasi:\n- Bahan luar: Cordura 600D');
    assert.deepStrictEqual(after.kategoriMotor, ['matic', 'adventure']);
    assert.match(after.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    const { description, kategoriMotor, updatedAt, ...rest } = after;
    const { description: d0, kategoriMotor: k0, ...rest0 } = TOURMAX;
    assert.deepStrictEqual(rest, rest0);
    // The response keeps the values from before the write as the script's backup.
    assert.strictEqual(r.json.items[0].current.description, TOURMAX.description);
    assert.deepStrictEqual(r.json.items[0].current.kategoriMotor, ['matic']);
    assert.strictEqual(counters.commits, 1);
  });
  await check('write revalidates the product, catalogue, category, and frame pages', async () => {
    await call(write([tourmax()]));
    for (const p of ['/', '/produk', '/produk/[slug]', '/tas-motor/[kategori]', '/blog/[slug]', '/sitemap.xml']) {
      assert.ok(revalidated.includes(p), `missing ${p}: ${revalidated.join(',')}`);
    }
  });
  await check('rename writes the trimmed name and keeps the slug (document ID) unchanged', async () => {
    const r = await call(write([{ slug: 'side-bag-inzta-xsr-srcrambag', name: '  Side bag Inzta XSR Scrambag ' }]));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').name, 'Side bag Inzta XSR Scrambag');
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').slug, 'side-bag-inzta-xsr-srcrambag');
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').price, 300000);
  });
  await check('"Tanpa kategori" ([]) is written as an empty list', async () => {
    await call(write([{ slug: 'side-bag-inzta-xsr-srcrambag', kategoriMotor: [] }]));
    assert.deepStrictEqual(stored('side-bag-inzta-xsr-srcrambag').kategoriMotor, []);
  });
  await check('identical values are reported unchanged: no write, no revalidation', async () => {
    const r = await call(write([{ slug: 'tail-bag-inzta-tourmax-30', description: TOURMAX.description + '\n', kategoriMotor: ['matic'], name: TOURMAX.name }]));
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.json.updated, []);
    assert.deepStrictEqual(r.json.unchanged, ['tail-bag-inzta-tourmax-30']);
    assert.strictEqual(counters.writes, 0);
    assert.strictEqual(revalidated.length, 0);
  });
  await check('two products in one request are written in one batch commit', async () => {
    const r = await call(write([tourmax(), { slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru' }]));
    assert.deepStrictEqual(r.json.updated.sort(), ['side-bag-inzta-xsr-srcrambag', 'tail-bag-inzta-tourmax-30']);
    assert.strictEqual(counters.commits, 1);
    assert.strictEqual(counters.writes, 2);
  });

  // ── Concurrency ────────────────────────────────────────────────────────────
  await check('expectedVersion from the dry run is accepted while the product is unchanged', async () => {
    const preview = await call({ items: [tourmax()] });
    const r = await call(write([tourmax({ expectedVersion: preview.json.items[0].version })]));
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.deepStrictEqual(r.json.updated, ['tail-bag-inzta-tourmax-30']);
  });
  await check('admin saved after the dry run -> 409 with the new version, nothing written', async () => {
    const preview = await call({ items: [tourmax(), { slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru' }] });
    docs.set('products/tail-bag-inzta-tourmax-30', { ...stored('tail-bag-inzta-tourmax-30'), price: 1 }); bump('products/tail-bag-inzta-tourmax-30');
    const r = await call(write([
      tourmax({ expectedVersion: preview.json.items[0].version }),
      { slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru', expectedVersion: preview.json.items[1].version },
    ]));
    assert.strictEqual(r.status, 409);
    assert.deepStrictEqual(r.json.conflicts.map(c => c.slug), ['tail-bag-inzta-tourmax-30']);
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').description, 'Lama');
    assert.strictEqual(counters.writes, 0);
  });
  await check('admin saves between the read and the commit -> 409 and the whole batch is rolled back', async () => {
    state.beforeCommit = () => { bump('products/side-bag-inzta-xsr-srcrambag'); };
    const r = await call(write([tourmax(), { slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru' }]));
    assert.strictEqual(r.status, 409);
    assert.match(r.json.error, /Tidak ada yang tersimpan/);
    assert.strictEqual(stored('tail-bag-inzta-tourmax-30').description, TOURMAX.description);
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').description, 'Lama');
    assert.strictEqual(revalidated.length, 0);
  });
  await check('Firestore down -> 500 with a generic message, no stack or path in the body', async () => {
    state.failGetAll = true;
    const r = await call(write([tourmax()]));
    assert.strictEqual(r.status, 500);
    assert.doesNotMatch(JSON.stringify(r.json), /UNAVAILABLE|firestore|at /);
  });
  await check('commit failure other than a precondition -> 500, nothing revalidated', async () => {
    state.failCommit = new Error('13 INTERNAL');
    const r = await call(write([tourmax()]));
    assert.strictEqual(r.status, 500);
    assert.strictEqual(revalidated.length, 0);
  });

  // ── Admin PUT after an automated update (review REV-03) ──────────────────────
  const adminBody = (extra = {}) => ({ ...SCRAMBAG, name: 'Side bag Inzta XSR Srcrambag', description: 'Lama', stock: 9, ...extra });
  const adminPut = async (body) => {
    const r = await quiet(() => adminProduct.PUT(new Request('http://localhost/api/products/side-bag-inzta-xsr-srcrambag', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: { slug: 'side-bag-inzta-xsr-srcrambag' } }));
    return { status: r.status, json: await r.json() };
  };
  await check('REV-03: an admin form loaded before an automated update gets 409 and does not write the old text back', async () => {
    const loaded = stored('side-bag-inzta-xsr-srcrambag').updatedAt ?? null;
    await call(write([{ slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru dari otomasi', name: 'Side bag Inzta XSR Scrambag' }]));
    const r = await adminPut(adminBody({ expectedUpdatedAt: loaded }));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.json.code, 'PRODUCT_CHANGED');
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').description, 'Baru dari otomasi');
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').stock, 2);
  });
  await check('REV-03: an admin form loaded after the update saves normally and keeps the automated categories', async () => {
    await call(write([{ slug: 'side-bag-inzta-xsr-srcrambag', description: 'Baru dari otomasi', kategoriMotor: ['retro'] }]));
    const fresh = stored('side-bag-inzta-xsr-srcrambag');
    const r = await adminPut(adminBody({ description: fresh.description, expectedUpdatedAt: fresh.updatedAt }));
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(stored('side-bag-inzta-xsr-srcrambag').stock, 9);
    assert.deepStrictEqual(stored('side-bag-inzta-xsr-srcrambag').kategoriMotor, ['retro']);
    assert.strictEqual('expectedUpdatedAt' in stored('side-bag-inzta-xsr-srcrambag'), false);
  });
  await check('REV-03: a legacy product without updatedAt matches expectedUpdatedAt null; a body without the key is not checked', async () => {
    assert.strictEqual((await adminPut(adminBody({ expectedUpdatedAt: null }))).status, 200);
    assert.strictEqual((await adminPut(adminBody({ expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }))).status, 409);
    assert.strictEqual((await adminPut(adminBody())).status, 200);
  });
  await check('REV-03: a stored Firestore Timestamp compares equal to its JSON form from the admin list', async () => {
    const helpers = require(path.join(ROOT, 'app/api/products/_helpers.ts'));
    class Timestamp { constructor() { this._seconds = 1762000000; this._nanoseconds = 7; } }
    const sent = JSON.parse(JSON.stringify({ updatedAt: new Timestamp() })).updatedAt;
    assert.strictEqual(helpers.changedSinceLoaded({ updatedAt: new Timestamp() }, { expectedUpdatedAt: sent }), false);
    assert.strictEqual(helpers.changedSinceLoaded({ updatedAt: '2026-11-09T00:00:00.000Z' }, { expectedUpdatedAt: sent }), true);
  });

  // ── Pure rules ─────────────────────────────────────────────────────────────
  await check('normalizeDescription folds CRLF and trims only the end', async () => {
    assert.strictEqual(rules.normalizeDescription('  a\r\nb\r\rc  \n\n'), '  a\nb\n\nc');
  });
  await check('versionOf pads nanoseconds and returns null without a timestamp', async () => {
    assert.strictEqual(rules.versionOf({ seconds: 5, nanoseconds: 42 }), '5.000000042');
    assert.strictEqual(rules.versionOf(undefined), null);
  });
  await check('kategoriMotor is stored in D1 order (matic, adventure, retro, trail, sport)', async () => {
    const p = rules.parseProductPatchBody({ items: [{ slug: 'a', kategoriMotor: ['sport', 'matic', 'trail'] }] });
    assert.deepStrictEqual(p.items[0].kategoriMotor, ['matic', 'trail', 'sport']);
  });

  const failed = results.filter(r => r[0] === 'FAIL');
  for (const [s, n] of results) console.log(`${s}  ${n}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
