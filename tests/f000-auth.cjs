// Runs the real F-000 route handlers with a fake cookie jar and an in-memory Firestore.
// Usage: npm run test:auth  (or: node tests/f000-auth.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const jar = new Map();
const docs = new Map();
const sessions = {
  'cookie-admin': { uid: 'u-admin', email: 'Admin@Inzta.id' },
  'cookie-affiliate': { uid: 'u-aff', email: 'aff@example.com' },
  'cookie-claim': { uid: 'u-claim', email: 'other@example.com', admin: true },
};
const idTokens = {
  'token-admin': { uid: 'u-admin', email: 'admin@inzta.id' },
  'token-affiliate': { uid: 'u-aff', email: 'aff@example.com' },
};
let writes = 0;

function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => ({ exists: docs.has(key), id, data: () => docs.get(key) }),
    set: async (value, opts) => { writes++; docs.set(key, opts && opts.merge ? { ...(docs.get(key) || {}), ...value } : value); },
    create: async (value) => {
      if (docs.has(key)) { const e = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; throw e; }
      writes++; docs.set(key, value);
    },
    delete: async () => { writes++; docs.delete(key); },
  };
}
const fakeDb = {
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    get: async () => ({ docs: [...docs.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.split('/')[1], data: () => v })) }),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
  }),
};
const fakeAuth = {
  verifySessionCookie: async (c) => { if (!sessions[c]) throw new Error('invalid'); return sessions[c]; },
  verifyIdToken: async (t) => { if (!idTokens[t]) throw new Error('invalid'); return idTokens[t]; },
  createSessionCookie: async (t) => 'issued-' + t,
};
const stubs = {
  'next/headers': { cookies: () => ({ get: (n) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: (n, v) => jar.set(n, v), delete: (n) => jar.delete(n) }) },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => fakeAuth },
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

const articles = require(path.join(ROOT, 'app/api/articles/route.ts'));
const article = require(path.join(ROOT, 'app/api/articles/[slug]/route.ts'));
const products = require(path.join(ROOT, 'app/api/products/route.ts'));
const product = require(path.join(ROOT, 'app/api/products/[slug]/route.ts'));
const session = require(path.join(ROOT, 'app/api/auth/session/route.ts'));
const { middleware } = require(path.join(ROOT, 'middleware.ts'));
const { NextRequest } = require(path.join(ROOT, 'node_modules/next/server'));
const { isAllowedAdmin, verifyAdminSession } = require(path.join(ROOT, 'lib/auth.ts'));
const { toSlug, SLUG_PATTERN } = require(path.join(ROOT, 'lib/slug.ts'));
const { adminErrorMessage } = require(path.join(ROOT, 'lib/admin-messages.ts'));

const req = (body) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const as = (cookie) => { jar.clear(); if (cookie) jar.set('admin_session', cookie); };
const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}
const validArticle = { title: 'Tas samping XSR 155', slug: 'tas-samping-xsr-155', excerpt: 'Ringkas', content: 'Isi artikel', images: ['https://res.cloudinary.com/demo/a.jpg'] };
const simpleProduct = { slug: 'tas-uji', name: 'Tas uji', productType: 'simple', price: 100000, stock: 5, isActive: true };

(async () => {
  process.env.ADMIN_EMAILS = 'admin@inzta.id';

  await check('isAllowedAdmin: allowlist is case-insensitive', () => assert.strictEqual(isAllowedAdmin({ email: 'ADMIN@inzta.id' }), true));
  await check('isAllowedAdmin: admin claim passes', () => assert.strictEqual(isAllowedAdmin({ email: 'x@y.z', admin: true }), true));
  await check('isAllowedAdmin: other email denied', () => assert.strictEqual(isAllowedAdmin({ email: 'aff@example.com' }), false));
  await check('isAllowedAdmin: empty ADMIN_EMAILS fails closed', () => {
    const saved = process.env.ADMIN_EMAILS; process.env.ADMIN_EMAILS = '';
    try { assert.strictEqual(isAllowedAdmin({ email: 'admin@inzta.id' }), false); } finally { process.env.ADMIN_EMAILS = saved; }
  });

  const writeCases = [
    ['POST /api/articles', () => articles.POST(req(validArticle))],
    ['PUT /api/articles/[slug]', () => article.PUT(req(validArticle), { params: { slug: 'tas-samping-xsr-155' } })],
    ['DELETE /api/articles/[slug]', () => article.DELETE(req({}), { params: { slug: 'tas-samping-xsr-155' } })],
    ['POST /api/products', () => products.POST(req(simpleProduct))],
    ['PUT /api/products/[slug]', () => product.PUT(req(simpleProduct), { params: { slug: 'tas-uji' } })],
    ['DELETE /api/products/[slug]', () => product.DELETE(req({}), { params: { slug: 'tas-uji' } })],
  ];
  for (const [name, call] of writeCases) {
    await check(`${name}: no cookie -> 401, no write`, async () => { as(null); const w = writes; const r = await call(); assert.strictEqual(r.status, 401); assert.strictEqual(writes, w); });
    await check(`${name}: affiliate session as admin cookie -> 403, no write`, async () => { as('cookie-affiliate'); const w = writes; const r = await call(); assert.strictEqual(r.status, 403); assert.strictEqual(writes, w); });
    await check(`${name}: invalid cookie -> 401`, async () => { as('forged'); const r = await call(); assert.strictEqual(r.status, 401); });
  }

  await check('session: affiliate token asking role admin -> 403, no admin cookie', async () => {
    jar.clear(); const r = await session.POST(req({ idToken: 'token-affiliate', role: 'admin' }));
    assert.strictEqual(r.status, 403); assert.ok(!jar.has('admin_session'));
  });
  await check('session: allowed admin -> 200 with admin cookie', async () => {
    jar.clear(); const r = await session.POST(req({ idToken: 'token-admin', role: 'admin' }));
    assert.strictEqual(r.status, 200); assert.ok(jar.has('admin_session'));
  });
  await check('session: affiliate login unchanged -> 200 with affiliate cookie', async () => {
    jar.clear(); const r = await session.POST(req({ idToken: 'token-affiliate', role: 'affiliate' }));
    assert.strictEqual(r.status, 200); assert.ok(jar.has('affiliate_session'));
  });

  await check('admin: create article -> 201, only whitelisted fields, createdAt set', async () => {
    as('cookie-admin'); const r = await articles.POST(req({ ...validArticle, createdAt: '1999-01-01', status: 'published', evil: 1 }));
    assert.strictEqual(r.status, 201);
    const d = docs.get('articles/tas-samping-xsr-155');
    assert.deepStrictEqual(Object.keys(d).sort(), ['content', 'createdAt', 'excerpt', 'images', 'slug', 'title', 'updatedAt']);
    assert.notStrictEqual(d.createdAt, '1999-01-01');
  });
  await check('admin: POST onto a taken slug -> 409, existing article untouched', async () => {
    as('cookie-admin'); const before = { ...docs.get('articles/tas-samping-xsr-155') }; const w = writes;
    const r = await articles.POST(req({ ...validArticle, title: 'Judul lain' }));
    assert.strictEqual(r.status, 409); assert.strictEqual(writes, w);
    assert.deepStrictEqual(docs.get('articles/tas-samping-xsr-155'), before);
  });
  await check('admin: edit via PUT keeps createdAt, updates updatedAt', async () => {
    as('cookie-admin'); const before = docs.get('articles/tas-samping-xsr-155').createdAt;
    await new Promise((s) => setTimeout(s, 5));
    const r = await article.PUT(req({ ...validArticle, title: 'Judul PUT' }), { params: { slug: 'tas-samping-xsr-155' } });
    assert.strictEqual(r.status, 200);
    const d = docs.get('articles/tas-samping-xsr-155');
    assert.strictEqual(d.createdAt, before); assert.notStrictEqual(d.updatedAt, before); assert.strictEqual(d.title, 'Judul PUT');
  });
  await check('admin: PUT on a missing article -> 404, no write', async () => {
    as('cookie-admin'); const w = writes;
    const r = await article.PUT(req(validArticle), { params: { slug: 'tidak-ada' } });
    assert.strictEqual(r.status, 404); assert.strictEqual(writes, w);
  });
  await check('admin: slug with "/" -> 400 (not 500), no write', async () => {
    as('cookie-admin'); const w = writes; const r = await articles.POST(req({ ...validArticle, slug: 'a/b' }));
    assert.strictEqual(r.status, 400); assert.strictEqual(writes, w);
  });
  await check('admin: bad slug on new article -> 400, no write', async () => {
    as('cookie-admin'); const w = writes; const r = await articles.POST(req({ ...validArticle, slug: 'Tas_Baru!' })); assert.strictEqual(r.status, 400); assert.strictEqual(writes, w);
  });
  await check('admin: legacy slug on existing article can still be edited via PUT', async () => {
    docs.set('articles/Legacy_Slug', { title: 'Lama', slug: 'Legacy_Slug', content: 'x', createdAt: '2026-01-01' });
    as('cookie-admin'); const r = await article.PUT(req({ ...validArticle, slug: 'Legacy_Slug' }), { params: { slug: 'Legacy_Slug' } });
    assert.strictEqual(r.status, 200); assert.strictEqual(docs.get('articles/Legacy_Slug').createdAt, '2026-01-01');
  });
  await check('admin: non-Cloudinary image -> 400', async () => {
    as('cookie-admin'); const r = await articles.POST(req({ ...validArticle, images: ['https://evil.example/x.png'] })); assert.strictEqual(r.status, 400);
  });
  await check('admin: 6 images -> 400', async () => {
    as('cookie-admin'); const r = await articles.POST(req({ ...validArticle, images: Array(6).fill('https://res.cloudinary.com/a.jpg') })); assert.strictEqual(r.status, 400);
  });
  await check('admin: title over 150 chars -> 400', async () => {
    as('cookie-admin'); const r = await articles.POST(req({ ...validArticle, title: 'x'.repeat(151) })); assert.strictEqual(r.status, 400);
  });
  await check('admin (custom claim): delete article -> 200', async () => {
    as('cookie-claim'); const r = await article.DELETE(req({}), { params: { slug: 'tas-samping-xsr-155' } });
    assert.strictEqual(r.status, 200); assert.ok(!docs.has('articles/tas-samping-xsr-155'));
  });
  await check('admin: create, edit price/stock, delete product', async () => {
    as('cookie-admin');
    assert.strictEqual((await products.POST(req(simpleProduct))).status, 201);
    assert.strictEqual((await product.PUT(req({ ...simpleProduct, price: 120000, stock: 3 }), { params: { slug: 'tas-uji' } })).status, 200);
    assert.strictEqual(docs.get('products/tas-uji').price, 120000);
    assert.strictEqual((await product.DELETE(req({}), { params: { slug: 'tas-uji' } })).status, 200);
  });
  await check('admin: new product with bad slug -> 400', async () => {
    as('cookie-admin'); const r = await products.POST(req({ ...simpleProduct, slug: 'Tas Uji' })); assert.strictEqual(r.status, 400);
  });
  await check('admin: non-string product slug -> 400 (not 500)', async () => {
    as('cookie-admin'); const r = await products.POST(req({ ...simpleProduct, slug: 123 })); assert.strictEqual(r.status, 400);
  });
  await check('admin: product POST onto a taken slug -> 409, other product untouched', async () => {
    as('cookie-admin');
    assert.strictEqual((await products.POST(req({ ...simpleProduct, slug: 'produk-b', price: 250000 }))).status, 201);
    const before = { ...docs.get('products/produk-b') }; const w = writes;
    const r = await products.POST(req({ ...simpleProduct, slug: 'produk-b', price: 1 }));
    assert.strictEqual(r.status, 409); assert.strictEqual(writes, w); assert.deepStrictEqual(docs.get('products/produk-b'), before);
  });
  await check('admin: product PUT on a missing slug -> 404, no write', async () => {
    as('cookie-admin'); const w = writes;
    const r = await product.PUT(req({ ...simpleProduct, slug: 'baru' }), { params: { slug: 'Baru Banget' } });
    assert.strictEqual(r.status, 404); assert.strictEqual(writes, w);
  });
  await check('admin: product PUT keeps the document slug even if the body says otherwise', async () => {
    as('cookie-admin');
    const r = await product.PUT(req({ ...simpleProduct, slug: 'lain' }), { params: { slug: 'produk-b' } });
    assert.strictEqual(r.status, 200); assert.strictEqual(docs.get('products/produk-b').slug, 'produk-b');
  });
  await check('session: refused admin login also clears a stale admin_session cookie', async () => {
    jar.clear(); jar.set('admin_session', 'stale');
    const r = await session.POST(req({ idToken: 'token-affiliate', role: 'admin' }));
    assert.strictEqual(r.status, 403); assert.ok(!jar.has('admin_session'));
  });
  await check('verifyAdminSession: non-admin gets an error with status 403', async () => {
    as('cookie-affiliate'); const r = await verifyAdminSession(); assert.strictEqual(r.error, 'Forbidden'); assert.strictEqual(r.status, 403);
  });
  await check('verifyAdminSession: allowed admin keeps the old shape', async () => {
    as('cookie-admin'); const r = await verifyAdminSession(); assert.strictEqual(r.uid, 'u-admin'); assert.ok(r.decodedClaims);
  });
  await check('toSlug: generated slugs always pass the API pattern', () => {
    const cases = { 'Apa itu Tankbag ?': 'apa-itu-tankbag', 'Tas_Botol XMAX': 'tas-botol-xmax', 'Tas Motor \u{1F525}': 'tas-motor', '  Side Bag  Z10 ': 'side-bag-z10', 'Caf\u00e9 Rider': 'cafe-rider' };
    for (const [input, expected] of Object.entries(cases)) { assert.strictEqual(toSlug(input), expected); assert.ok(SLUG_PATTERN.test(toSlug(input))); }
  });
  await check('adminErrorMessage: 401 and 403 become instructions in Indonesian', () => {
    assert.match(adminErrorMessage(401), /Sesi admin habis/); assert.match(adminErrorMessage(403), /tidak punya akses admin/);
    assert.strictEqual(adminErrorMessage(400, 'slug: wajib diisi'), 'slug: wajib diisi');
  });
  await check('public: GET articles and products still work without login', async () => {
    as(null);
    assert.strictEqual((await articles.GET()).status, 200);
    assert.strictEqual((await products.GET()).status, 200);
    assert.strictEqual((await article.GET(req({}), { params: { slug: 'Legacy_Slug' } })).status, 200);
  });

  const mw = (url, method, cookie) => middleware(new NextRequest('http://localhost' + url, { method, headers: cookie ? { cookie: 'admin_session=' + cookie } : {} }));
  await check('middleware: POST /api/articles without cookie -> 401', () => assert.strictEqual(mw('/api/articles', 'POST').status, 401));
  await check('middleware: DELETE /api/products/x without cookie -> 401', () => assert.strictEqual(mw('/api/products/x', 'DELETE').status, 401));
  await check('middleware: GET /api/products without cookie passes', () => assert.notStrictEqual(mw('/api/products', 'GET').status, 401));
  await check('middleware: GET variant-orders passes (unchanged)', () => assert.notStrictEqual(mw('/api/products/x/variant-orders', 'GET').status, 401));
  await check('middleware: POST /api/articles with cookie passes to handler', () => assert.notStrictEqual(mw('/api/articles', 'POST', 'c').status, 401));
  await check('middleware: /admin/login with a cookie is not bounced back to /admin (no redirect loop)', () => {
    const r = mw('/admin/login', 'GET', 'c');
    assert.ok(!r.headers.get('location'), 'unexpected redirect to ' + r.headers.get('location'));
  });

  for (const [s, n] of results) console.log(s + '  ' + n);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
