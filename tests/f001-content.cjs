// F-001: server-side public content reads, sitemap dates, failure policy, and revalidation after admin writes.
// Runs the real modules with an in-memory Firestore and stubbed Next.js APIs, like tests/f000-auth.cjs.
// Usage: npm run test:content  (or: node tests/f001-content.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const jar = new Map();
const revalidated = [];
const state = { credentials: true, failReads: false, failRevalidate: false };
const getAllCalls = [];

function snapshotOf(col, filter) {
  if (state.failReads) throw new Error('14 UNAVAILABLE: firestore down');
  const entries = [...docs.entries()]
    .filter(([k]) => k.startsWith(col + '/'))
    .map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v }))
    .filter(d => !filter || filter(d.data()));
  return { docs: entries, empty: entries.length === 0 };
}
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => {
      if (state.failReads) throw new Error('14 UNAVAILABLE: firestore down');
      return { exists: docs.has(key), id, data: () => docs.get(key) };
    },
    set: async (value, opts) => { docs.set(key, opts && opts.merge ? { ...(docs.get(key) || {}), ...value } : value); },
    create: async (value) => {
      if (docs.has(key)) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; }
      docs.set(key, value);
    },
    update: async (value) => {
      if (!docs.has(key)) { const e = new Error('5 NOT_FOUND'); e.code = 5; throw e; }
      docs.set(key, { ...docs.get(key), ...value });
    },
    delete: async () => { docs.delete(key); },
  };
}
const fakeDb = {
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    get: async () => snapshotOf(col),
    where: (field, op, value) => ({ get: async () => snapshotOf(col, d => d[field] === value), limit: () => ({ get: async () => snapshotOf(col, d => d[field] === value) }) }),
  }),
  // F-013 phase C resolver: one call for every referenced document, snapshots in ref order.
  getAll: async (...refs) => {
    getAllCalls.push(refs.length);
    return Promise.all(refs.map(r => r.get()));
  },
  // Enough for the order status revert path; not atomic.
  runTransaction: async (fn) => fn({ get: (ref) => ref.get(), update: (ref, v) => ref.set(v, { merge: true }), delete: (ref) => ref.delete() }),
};
const fakeAuth = {
  verifySessionCookie: async (c) => { if (c !== 'cookie-admin') throw new Error('invalid'); return { uid: 'u-admin', email: 'admin@inzta.id', email_verified: true }; },
};
const stubs = {
  react: { cache: (fn) => fn },
  'next/headers': { cookies: () => ({ get: (n) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: () => {}, delete: () => {} }) },
  'next/cache': { revalidatePath: (p) => { if (state.failRevalidate) throw new Error('revalidate down'); revalidated.push(p); } },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => fakeAuth, hasAdminCredentials: () => state.credentials },
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

const content = require(path.join(ROOT, 'lib/public-content.ts'));
const sitemap = require(path.join(ROOT, 'app/sitemap.ts')).default;
const articles = require(path.join(ROOT, 'app/api/articles/route.ts'));
const article = require(path.join(ROOT, 'app/api/articles/[slug]/route.ts'));
const products = require(path.join(ROOT, 'app/api/products/route.ts'));
const product = require(path.join(ROOT, 'app/api/products/[slug]/route.ts'));
const order = require(path.join(ROOT, 'app/api/admin/orders/[orderId]/route.ts'));
const embeds = require(path.join(ROOT, 'lib/article-embeds.ts'));
const preview = require(path.join(ROOT, 'app/api/admin/articles/preview/route.ts'));

const results = [];
async function check(name, fn) {
  const saved = { ...state };
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
  Object.assign(state, saved);
}
const req = (body) => new Request('http://localhost/api', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const timestamp = (iso) => ({ toMillis: () => Date.parse(iso) });
const quiet = async (fn) => { const w = console.warn, e = console.error; console.warn = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.error = e; } };

function seed() {
  docs.clear();
  docs.set('articles/legacy-timestamp', { title: 'Legacy', slug: 'legacy-timestamp', excerpt: 'a', content: 'x', createdAt: timestamp('2026-07-01T00:00:00Z') });
  docs.set('articles/new-iso', { title: 'Baru', slug: 'new-iso', excerpt: 'b', content: 'y', createdAt: '2026-10-20T03:00:00.000Z', updatedAt: '2026-10-25T05:00:00.000Z' });
  docs.set('articles/no-date', { title: 'Tanpa tanggal', slug: 'no-date', excerpt: 'c', content: 'z' });
  // F-012: drafts never reach public reads; publishedAt (not createdAt) is the public date.
  docs.set('articles/draf-rahasia', { title: 'Draf', slug: 'draf-rahasia', excerpt: 'd', content: 'w', status: 'draft', contentFormat: 'markdown', createdAt: '2026-10-27T00:00:00.000Z', updatedAt: '2026-10-27T00:00:00.000Z' });
  docs.set('articles/terbit-lama-dibuat', { title: 'Terbit', slug: 'terbit-lama-dibuat', excerpt: 'e', content: 'v', status: 'published', contentFormat: 'markdown', createdAt: '2026-05-01T00:00:00.000Z', publishedAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z' });
  docs.set('products/tas-aktif', { name: 'Tas Aktif', isActive: true, price: 100000, stock: 3, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-10-26T01:00:00.000Z' });
  docs.set('products/tas-lama', { name: 'Tas Lama', isActive: true, price: 90000, stock: 1, createdAt: timestamp('2026-06-01T00:00:00Z') });
  docs.set('products/tas-nonaktif', { name: 'Tas Nonaktif', isActive: false, price: 1, stock: 0, updatedAt: '2026-12-01T00:00:00.000Z' });
}

(async () => {
  process.env.ADMIN_EMAILS = 'admin@inzta.id';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://inzta.id';

  await check('toMillis: Timestamp, {seconds}, {_seconds}, ISO, number, Date', () => {
    const ms = Date.parse('2026-10-01T00:00:00Z');
    assert.strictEqual(content.toMillis(timestamp('2026-10-01T00:00:00Z')), ms);
    assert.strictEqual(content.toMillis({ seconds: ms / 1000, nanoseconds: 0 }), ms);
    assert.strictEqual(content.toMillis({ _seconds: ms / 1000 }), ms);
    assert.strictEqual(content.toMillis('2026-10-01T00:00:00.000Z'), ms);
    assert.strictEqual(content.toMillis(ms), ms);
    assert.strictEqual(content.toMillis(new Date(ms)), ms);
  });
  await check('toMillis: missing or invalid values -> null', () => {
    for (const v of [undefined, null, '', 'bukan tanggal', {}, NaN]) assert.strictEqual(content.toMillis(v), null);
  });

  seed();
  await check('getArticles: published and legacy only, newest public date first (publishedAt, else createdAt), slug from doc id', async () => {
    const list = await content.getArticles();
    assert.deepStrictEqual(list.map(a => a.slug), ['terbit-lama-dibuat', 'new-iso', 'legacy-timestamp', 'no-date']);
    assert.strictEqual(list[0].publishedAt, Date.parse('2026-10-22T00:00:00.000Z'));
    list.shift();
    assert.strictEqual(typeof list[0].createdAt, 'number');
    assert.strictEqual(list[0].updatedAt, Date.parse('2026-10-25T05:00:00.000Z'));
  });
  await check('getArticles: results are plain JSON (safe to pass to client components)', async () => {
    const list = await content.getArticles();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(list)), list);
  });
  await check('getActiveProducts: only active, newest first, normalized, dates in ms', async () => {
    const list = await content.getActiveProducts();
    assert.deepStrictEqual(list.map(p => p.slug), ['tas-aktif', 'tas-lama']);
    assert.strictEqual(list[0].productType, 'simple');
    assert.strictEqual(list[1].createdAt, Date.parse('2026-06-01T00:00:00Z'));
  });
  await check('toArticleCard: only card fields, no article content', async () => {
    const [first] = await content.getArticles();
    const card = content.toArticleCard(first);
    assert.deepStrictEqual(Object.keys(card).sort(), ['coverAlt', 'coverImage', 'createdAt', 'excerpt', 'imageUrl', 'images', 'publishedAt', 'slug', 'title']);
    assert.ok(!('content' in card));
  });
  await check('getArticle: existing slug -> article, missing slug -> null, draft -> null', async () => {
    assert.strictEqual((await content.getArticle('new-iso')).title, 'Baru');
    assert.strictEqual(await content.getArticle('tidak-ada'), null);
    assert.strictEqual(await content.getArticle('draf-rahasia'), null);
  });

  await check('failure policy: no Admin credentials -> empty lists and null article, no throw', async () => {
    state.credentials = false; state.failReads = true;
    await quiet(async () => {
      assert.deepStrictEqual(await content.getArticles(), []);
      assert.deepStrictEqual(await content.getActiveProducts(), []);
      assert.strictEqual(await content.getArticle('new-iso'), null);
    });
  });
  await check('failure policy: no credentials on Vercel Production -> throws instead of caching empty pages', async () => {
    state.credentials = false; process.env.VERCEL_ENV = 'production';
    try {
      await assert.rejects(() => content.getArticles(), /credentials missing in production/);
      await assert.rejects(() => content.getArticle('new-iso'), /credentials missing in production/);
    } finally { delete process.env.VERCEL_ENV; }
  });
  await check('failure policy: credentials present and read fails -> throws (ISR keeps last good page)', async () => {
    state.failReads = true;
    await assert.rejects(() => content.getArticles(), /UNAVAILABLE/);
    await assert.rejects(() => content.getActiveProducts(), /UNAVAILABLE/);
    await assert.rejects(() => content.getArticle('new-iso'), /UNAVAILABLE/);
  });
  await check('sitemap: read failure propagates instead of caching a sitemap without articles', async () => {
    state.failReads = true;
    await assert.rejects(() => sitemap(), /UNAVAILABLE/);
  });

  await check('sitemap: every article listed with lastModified = updatedAt, else createdAt, else omitted', async () => {
    const map = await sitemap();
    const byUrl = Object.fromEntries(map.map(e => [e.url, e]));
    assert.strictEqual(byUrl['https://inzta.id/blog/new-iso'].lastModified.toISOString(), '2026-10-25T05:00:00.000Z');
    assert.strictEqual(byUrl['https://inzta.id/blog/legacy-timestamp'].lastModified.toISOString(), '2026-07-01T00:00:00.000Z');
    assert.ok(byUrl['https://inzta.id/blog/no-date']);
    assert.ok(!('lastModified' in byUrl['https://inzta.id/blog/no-date']));
  });
  await check('sitemap: drafts are not listed (F-012)', async () => {
    const map = await sitemap();
    assert.ok(!map.some(e => e.url.includes('draf-rahasia')));
    assert.ok(map.some(e => e.url === 'https://inzta.id/blog/terbit-lama-dibuat'));
  });
  await check('sitemap: active products only, lastModified from their dates', async () => {
    const map = await sitemap();
    const byUrl = Object.fromEntries(map.map(e => [e.url, e]));
    assert.strictEqual(byUrl['https://inzta.id/produk/tas-aktif'].lastModified.toISOString(), '2026-10-26T01:00:00.000Z');
    assert.strictEqual(byUrl['https://inzta.id/produk/tas-lama'].lastModified.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.ok(!byUrl['https://inzta.id/produk/tas-nonaktif']);
  });
  await check('sitemap: static pages use the newest content date, never the request time', async () => {
    const map = await sitemap();
    const byUrl = Object.fromEntries(map.map(e => [e.url, e]));
    assert.strictEqual(byUrl['https://inzta.id'].lastModified.toISOString(), '2026-10-26T01:00:00.000Z');
    assert.strictEqual(byUrl['https://inzta.id/produk'].lastModified.toISOString(), '2026-10-26T01:00:00.000Z');
    assert.strictEqual(byUrl['https://inzta.id/blog'].lastModified.toISOString(), '2026-10-25T05:00:00.000Z');
  });

  const validArticle = { title: 'Tas samping XSR 155', slug: 'tas-samping-xsr-155', excerpt: 'Ringkas', content: 'Isi' };
  const simpleProduct = { slug: 'tas-uji', name: 'Tas uji', productType: 'simple', price: 100000, stock: 5, isActive: true };
  const asAdmin = () => { jar.clear(); jar.set('admin_session', 'cookie-admin'); };
  const articlePaths = (slug) => ['/', '/blog', `/blog/${slug}`, '/sitemap.xml', '/blog/[slug]'];  // F-013 C4 (K-10): every article page

  // F-012: creating or editing a draft changes no public page, so only public changes revalidate.
  await check('revalidate: editing a published (legacy) article revalidates its paths', async () => {
    asAdmin(); seed();
    revalidated.length = 0;
    assert.strictEqual((await article.PUT(req({ title: 'Baru diubah', excerpt: 'b', content: 'y' }), { params: { slug: 'new-iso' } })).status, 200);
    assert.deepStrictEqual(revalidated, articlePaths('new-iso'));
  });
  await check('revalidate: draft create and edit revalidate nothing; delete revalidates home, blog list, article, sitemap', async () => {
    asAdmin();
    revalidated.length = 0; assert.strictEqual((await articles.POST(req(validArticle))).status, 201);
    assert.deepStrictEqual(revalidated, []);
    revalidated.length = 0; assert.strictEqual((await article.PUT(req(validArticle), { params: { slug: 'tas-samping-xsr-155' } })).status, 200);
    assert.deepStrictEqual(revalidated, []);
    revalidated.length = 0; assert.strictEqual((await article.DELETE(req({}), { params: { slug: 'tas-samping-xsr-155' } })).status, 200);
    assert.deepStrictEqual(revalidated, articlePaths('tas-samping-xsr-155'));
  });
  await check('revalidate: product create, edit, delete revalidate home and sitemap; updatedAt written', async () => {
    asAdmin();
    revalidated.length = 0; assert.strictEqual((await products.POST(req(simpleProduct))).status, 201);
    assert.deepStrictEqual(revalidated, ['/', '/sitemap.xml', '/blog/[slug]']);
    assert.ok(content.toMillis(docs.get('products/tas-uji').updatedAt));
    revalidated.length = 0; assert.strictEqual((await product.PUT(req(simpleProduct), { params: { slug: 'tas-uji' } })).status, 200);
    assert.deepStrictEqual(revalidated, ['/', '/sitemap.xml', '/blog/[slug]']);
    revalidated.length = 0; assert.strictEqual((await product.DELETE(req({}), { params: { slug: 'tas-uji' } })).status, 200);
    assert.deepStrictEqual(revalidated, ['/', '/sitemap.xml', '/blog/[slug]']);
  });
  await check('revalidate: order status change revalidates home and sitemap (stock); failed change does not', async () => {
    asAdmin();
    docs.set('orders/o-1', { status: 'pending', items: [] });
    revalidated.length = 0; assert.strictEqual((await order.PATCH(req({ status: 'cancelled' }), { params: { orderId: 'o-1' } })).status, 200);
    assert.deepStrictEqual(revalidated, ['/', '/sitemap.xml', '/blog/[slug]']);
    assert.strictEqual(docs.get('orders/o-1').status, 'cancelled');
    revalidated.length = 0;
    assert.strictEqual((await quiet(() => order.PATCH(req({ status: 'cancelled' }), { params: { orderId: 'tidak-ada' } }))).status, 500);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('revalidate: rejected write (no cookie) revalidates nothing', async () => {
    jar.clear(); revalidated.length = 0;
    assert.strictEqual((await articles.POST(req(validArticle))).status, 401);
    assert.strictEqual((await products.POST(req(simpleProduct))).status, 401);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('revalidate: a synchronous revalidatePath error does not fail the saved write', async () => {
    asAdmin(); state.failRevalidate = true;
    const r = await quiet(() => articles.POST(req({ ...validArticle, slug: 'tetap-tersimpan' })));
    assert.strictEqual(r.status, 201);
    assert.ok(docs.has('articles/tetap-tersimpan'));
  });

  // F-013 phase C (requirements 19, 22.4): card data for [[produk:…]] and [[artikel:…]] markers.
  const blocks = (...refs) => refs.map(r => { const [type, slug] = r.split(':'); return { type, slug }; });
  await check('embeds: one getAll for all markers; inactive, draft, missing, and self left out', async () => {
    seed(); getAllCalls.length = 0;
    const r = await embeds.resolveEmbeds(
      [{ type: 'html', html: '<p>x</p>' }, ...blocks('product:tas-aktif', 'product:tas-nonaktif', 'product:tidak-ada', 'product:tas-aktif', 'article:terbit-lama-dibuat', 'article:draf-rahasia', 'article:legacy-timestamp', 'article:tidak-ada', 'article:diri-sendiri')],
      { exclude: 'diri-sendiri' },
    );
    assert.deepStrictEqual(getAllCalls, [7]);
    assert.deepStrictEqual(Object.keys(r.products), ['tas-aktif']);
    assert.deepStrictEqual(Object.keys(r.articles).sort(), ['legacy-timestamp', 'terbit-lama-dibuat']);
    docs.set('articles/diri-sendiri', { title: 'Diri', excerpt: 'x', content: 'y', status: 'published' });
    const self = await embeds.resolveEmbeds(blocks('article:diri-sendiri'), { exclude: 'diri-sendiri' });
    assert.deepStrictEqual(self.articles, {});
  });
  await check('embeds: card fields only, JSON-safe, image and date from the article', async () => {
    seed();
    docs.set('articles/terbit-lama-dibuat', { ...docs.get('articles/terbit-lama-dibuat'), coverImage: 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/c.jpg', coverAlt: 'Sampul' });
    docs.set('products/tas-aktif', { ...docs.get('products/tas-aktif'), description: 'rahasia', sku: 'S-1', images: ['https://res.cloudinary.com/dukddlp0b/image/upload/v1/p.jpg'], compareAtPrice: 150000 });
    const r = await embeds.resolveEmbeds(blocks('product:tas-aktif', 'article:terbit-lama-dibuat'));
    assert.deepStrictEqual(r.products['tas-aktif'], { slug: 'tas-aktif', name: 'Tas Aktif', image: 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/p.jpg', price: 100000, priceTo: null, compareAtPrice: 150000, inStock: true });
    assert.deepStrictEqual(r.articles['terbit-lama-dibuat'], { slug: 'terbit-lama-dibuat', title: 'Terbit', excerpt: 'e', image: 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/c.jpg', date: Date.parse('2026-10-22T00:00:00.000Z') });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), r);
  });
  await check('embeds: no marker -> no read; no credentials -> no cards; read error propagates', async () => {
    seed(); getAllCalls.length = 0;
    assert.deepStrictEqual(await embeds.resolveEmbeds([{ type: 'html', html: '<p>x</p>' }]), { products: {}, articles: {} });
    assert.deepStrictEqual(getAllCalls, []);
    state.credentials = false;
    assert.deepStrictEqual(await quiet(() => embeds.resolveEmbeds(blocks('product:tas-aktif'))), { products: {}, articles: {} });
    state.credentials = true; state.failReads = true;
    await assert.rejects(() => embeds.resolveEmbeds(blocks('product:tas-aktif')), /UNAVAILABLE/);
  });
  await check('embeds: prices and stock follow ProductCard (K-8, K-9)', () => {
    const P = (p) => embeds.toProductEmbed({ slug: 's', name: 'N', images: [], ...p });
    assert.deepStrictEqual(P({ productType: 'simple', price: 100, compareAtPrice: 80, stock: 0 }), { slug: 's', name: 'N', image: null, price: 100, priceTo: null, compareAtPrice: null, inStock: false });
    assert.strictEqual(P({ productType: 'simple', price: 100 }).inStock, true, 'legacy without stock counts as available');
    const v = P({ productType: 'variable', priceFrom: 100, priceTo: 200, totalStock: 5, variants: [{ isActive: true, compareAtPrice: 250 }, { isActive: false, compareAtPrice: 999 }, { isActive: true, compareAtPrice: null }] });
    assert.deepStrictEqual([v.price, v.priceTo, v.compareAtPrice, v.inStock], [100, 200, 250, true]);
    const same = P({ productType: 'variable', priceFrom: 100, priceTo: 100, totalStock: 0, variants: [] });
    assert.deepStrictEqual([same.price, same.priceTo, same.compareAtPrice, same.inStock], [100, null, null, false]);
    const none = P({ productType: 'variable', priceFrom: null, priceTo: null, variants: [] });
    assert.deepStrictEqual([none.price, none.priceTo], [null, null]);
    assert.strictEqual(P({ images: ['javascript:alert(1)'] }).image, null);
    assert.strictEqual(P({ images: ['http://x/y.jpg'] }).image, null);
  });
  await check('preview route: returns blocks and embeds, excludes the edited slug, survives a failed read', async () => {
    seed(); asAdmin();
    const body = { content: '[[produk:tas-aktif]]\n\n[[artikel:terbit-lama-dibuat]]', contentFormat: 'markdown', slug: 'terbit-lama-dibuat' };
    const res = await preview.POST(req(body));
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.deepStrictEqual(json.blocks, [{ type: 'product', slug: 'tas-aktif' }, { type: 'article', slug: 'terbit-lama-dibuat' }]);
    assert.deepStrictEqual(Object.keys(json.embeds.products), ['tas-aktif']);
    assert.deepStrictEqual(json.embeds.articles, {});
    state.failReads = true;
    const failed = await quiet(() => preview.POST(req({ ...body, slug: '../x' })));
    assert.strictEqual(failed.status, 200);
    assert.deepStrictEqual((await failed.json()).embeds, { products: {}, articles: {} });
    jar.clear();
    assert.strictEqual((await preview.POST(req(body))).status, 401);
  });

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
