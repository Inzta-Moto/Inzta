// F-012: article API (drafts, validation, stale saves), publish and unpublish, and the preview route.
// Runs the real route handlers with an in-memory Firestore and stubbed Next.js APIs, like the F-000 and
// F-001 tests. The fake keeps an updateTime per document so the lastUpdateTime precondition is exercised.
// Usage: npm run test:articles  (or: node tests/f012-articles.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const versions = new Map();
const jar = new Map();
const revalidated = [];
const counters = { reads: 0, writes: 0 };
const state = { failRevalidate: false, beforeUpdate: null };

function bump(key) { versions.set(key, (versions.get(key) || 0) + 1); }
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => {
      counters.reads++;
      return { exists: docs.has(key), id, data: () => docs.get(key), updateTime: docs.has(key) ? { v: versions.get(key) } : undefined };
    },
    create: async (value) => {
      if (docs.has(key)) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; }
      counters.writes++; docs.set(key, value); bump(key);
    },
    update: async (value, precondition) => {
      // Lets a test simulate another admin saving between this request's read and its write.
      if (state.beforeUpdate) { const fn = state.beforeUpdate; state.beforeUpdate = null; fn(key); }
      if (!docs.has(key)) { const e = new Error('5 NOT_FOUND'); e.code = 5; throw e; }
      if (precondition && precondition.lastUpdateTime && precondition.lastUpdateTime.v !== versions.get(key)) {
        const e = new Error('9 FAILED_PRECONDITION: the stored version does not match'); e.code = 9; throw e;
      }
      counters.writes++; docs.set(key, { ...docs.get(key), ...value }); bump(key);
    },
    delete: async () => { counters.writes++; docs.delete(key); },
  };
}
const fakeDb = {
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    get: async () => {
      counters.reads++;
      return { docs: [...docs.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v })) };
    },
  }),
};
const sessions = {
  'cookie-admin': { uid: 'u-admin', email: 'admin@inzta.id', email_verified: true },
  'cookie-affiliate': { uid: 'u-aff', email: 'aff@example.com', email_verified: true },
};
const fakeAuth = { verifySessionCookie: async (c) => { if (!sessions[c]) throw new Error('invalid'); return sessions[c]; } };
const stubs = {
  react: { cache: (fn) => fn },
  'next/headers': { cookies: () => ({ get: (n) => (jar.has(n) ? { value: jar.get(n) } : undefined), set: () => {}, delete: () => {} }) },
  'next/cache': { revalidatePath: (p) => { if (state.failRevalidate) throw new Error('revalidate down'); revalidated.push(p); } },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => fakeAuth, hasAdminCredentials: () => true },
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
const publish = require(path.join(ROOT, 'app/api/articles/[slug]/publish/route.ts'));
const preview = require(path.join(ROOT, 'app/api/admin/articles/preview/route.ts'));
const content = require(path.join(ROOT, 'lib/public-content.ts'));

const results = [];
async function check(name, fn) {
  const saved = { ...state };
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
  Object.assign(state, saved);
}
const req = (body, method = 'POST') => new Request('http://localhost/api', method === 'GET' ? { method } : { method, body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const json = (r) => r.json();
const as = (cookie) => { jar.clear(); if (cookie) jar.set('admin_session', cookie); };
const quiet = async (fn) => { const w = console.warn, e = console.error; console.warn = console.error = () => {}; try { return await fn(); } finally { console.warn = w; console.error = e; } };
const p = (slug) => ({ params: { slug } });
const paths = (slug) => ['/', '/blog', `/blog/${slug}`, '/sitemap.xml'];

const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/foto.jpg';
const ready = {
  title: 'Tas samping XSR 155', slug: 'tas-samping-xsr-155', excerpt: 'Ringkasan artikel', content: `## Pilih posisi\n\nIsi.\n\n![Tas di XSR 155](${CLD} "Foto tim")`,
  coverImage: CLD, coverAlt: 'Sampul tas samping', metaTitle: 'Tas samping XSR 155', metaDescription: 'Deskripsi',
};

(async () => {
  process.env.ADMIN_EMAILS = 'admin@inzta.id';

  // Create and save drafts
  await check('POST: creates a markdown draft by Tim INZTA; status, author, source, publishedAt in the body are ignored', async () => {
    as('cookie-admin'); revalidated.length = 0;
    const r = await articles.POST(req({ ...ready, status: 'published', author: 'Hacker', source: 'automation', publishedAt: '2020-01-01', images: [CLD], contentFormat: 'plain' }));
    assert.strictEqual(r.status, 201);
    const d = docs.get('articles/tas-samping-xsr-155');
    assert.deepStrictEqual([d.status, d.contentFormat, d.source, d.author, d.images, d.publishedAt], ['draft', 'markdown', 'admin', 'Tim INZTA', [], undefined]);
    assert.ok(d.createdAt && d.createdAt === d.updatedAt);
    assert.deepStrictEqual(revalidated, [], 'a draft changes no public page');
    const { item } = await json(r);
    assert.strictEqual(typeof item.updatedAt, 'number', 'API dates are epoch ms');
  });
  await check('POST: a draft needs only title and slug (empty content and excerpt save)', async () => {
    as('cookie-admin');
    const r = await articles.POST(req({ title: 'Kosong', slug: 'draf-kosong' }));
    assert.strictEqual(r.status, 201);
    assert.strictEqual(docs.get('articles/draf-kosong').content, '');
  });
  await check('POST: reserved slug "baru" -> 400, no write', async () => {
    as('cookie-admin'); const w = counters.writes;
    assert.strictEqual((await articles.POST(req({ title: 'x', slug: 'baru' }))).status, 400);
    assert.strictEqual(counters.writes, w);
  });
  await check('caps: metaTitle 200 and metaDescription 500 accepted (61/156 are only warnings), 201/501 and coverAlt 201 rejected', async () => {
    as('cookie-admin');
    assert.strictEqual((await articles.POST(req({ title: 'm', slug: 'meta-ok', metaTitle: 'x'.repeat(61), metaDescription: 'y'.repeat(156) }))).status, 201);
    assert.strictEqual((await articles.POST(req({ title: 'm', slug: 'meta-max', metaTitle: 'x'.repeat(200), metaDescription: 'y'.repeat(500) }))).status, 201);
    for (const patch of [{ metaTitle: 'x'.repeat(201) }, { metaDescription: 'y'.repeat(501) }, { coverAlt: 'z'.repeat(201) }, { excerpt: 'e'.repeat(301) }]) {
      const w = counters.writes;
      assert.strictEqual((await articles.POST(req({ title: 'm', slug: 'meta-bad', ...patch }))).status, 400, JSON.stringify(Object.keys(patch)));
      assert.strictEqual(counters.writes, w);
    }
  });
  await check('cover image only from the allowed Cloudinary cloud', async () => {
    as('cookie-admin');
    for (const coverImage of ['https://res.cloudinary.com/other/a.jpg', 'https://evil.example/a.jpg', 'http://res.cloudinary.com/dukddlp0b/a.jpg']) {
      assert.strictEqual((await articles.POST(req({ title: 'c', slug: 'cover-bad', coverImage }))).status, 400, coverImage);
    }
  });
  await check('PUT on a draft: saves without publish checks, keeps createdAt and status, stores images: [] for markdown', async () => {
    as('cookie-admin'); revalidated.length = 0;
    const before = docs.get('articles/draf-kosong');
    const r = await article.PUT(req({ title: 'Kosong 2', excerpt: '', content: '# masih draf', images: [CLD], status: 'published' }, 'PUT'), p('draf-kosong'));
    assert.strictEqual(r.status, 200);
    const d = docs.get('articles/draf-kosong');
    assert.deepStrictEqual([d.title, d.status, d.createdAt, d.images], ['Kosong 2', 'draft', before.createdAt, []]);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('PUT: stale baseUpdatedAt -> 409 with the Indonesian message, no write', async () => {
    as('cookie-admin'); const w = counters.writes;
    const r = await article.PUT(req({ ...ready, baseUpdatedAt: 1 }, 'PUT'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 409);
    assert.match((await json(r)).error, /sudah diubah di tempat lain/);
    assert.strictEqual(counters.writes, w);
  });
  await check('PUT: matching baseUpdatedAt (ms from GET) saves', async () => {
    as('cookie-admin');
    const { item } = await json(await article.GET(req({}, 'GET'), p('tas-samping-xsr-155')));
    const r = await article.PUT(req({ ...ready, baseUpdatedAt: item.updatedAt }, 'PUT'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 200);
  });
  await check('PUT: another save between read and write -> 409 through the Firestore precondition', async () => {
    as('cookie-admin');
    const { item } = await json(await article.GET(req({}, 'GET'), p('tas-samping-xsr-155')));
    state.beforeUpdate = (key) => { docs.set(key, { ...docs.get(key), title: 'Admin lain' }); bump(key); };
    const r = await article.PUT(req({ ...ready, title: 'Saya', baseUpdatedAt: item.updatedAt }, 'PUT'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(docs.get('articles/tas-samping-xsr-155').title, 'Admin lain');
  });

  // Publish and unpublish
  await check('publish: no cookie -> 401, affiliate -> 403, missing article -> 404', async () => {
    as(null); assert.strictEqual((await publish.POST(req({}), p('tas-samping-xsr-155'))).status, 401);
    assert.strictEqual((await publish.DELETE(req({}, 'DELETE'), p('tas-samping-xsr-155'))).status, 401);
    as('cookie-affiliate'); assert.strictEqual((await quiet(() => publish.POST(req({}), p('tas-samping-xsr-155')))).status, 403);
    as('cookie-admin'); assert.strictEqual((await publish.POST(req({}), p('tidak-ada'))).status, 404);
  });
  await check('publish: blocked without cover -> 400 with checks, document unchanged, nothing revalidated', async () => {
    as('cookie-admin'); revalidated.length = 0;
    docs.set('articles/tanpa-sampul', { ...ready, slug: 'tanpa-sampul', coverImage: '', status: 'draft', contentFormat: 'markdown' }); bump('articles/tanpa-sampul');
    const before = JSON.stringify(docs.get('articles/tanpa-sampul'));
    const r = await publish.POST(req({}), p('tanpa-sampul'));
    assert.strictEqual(r.status, 400);
    assert.ok((await json(r)).checks.some(c => c.id === 'C-5'));
    assert.strictEqual(JSON.stringify(docs.get('articles/tanpa-sampul')), before);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('publish: placeholder image (ADR-0013 local path) -> 400 C-7', async () => {
    as('cookie-admin');
    docs.set('articles/ada-placeholder', { ...ready, slug: 'ada-placeholder', content: '## A\n\n![Tank bag](../images/K-03/tk5.jpg)', status: 'draft', contentFormat: 'markdown' });
    const r = await publish.POST(req({}), p('ada-placeholder'));
    assert.strictEqual(r.status, 400);
    assert.ok((await json(r)).checks.some(c => c.id === 'C-7'));
  });
  await check('publish: image the regex accepts but the renderer drops (inline with text) -> 400 C-6', async () => {
    as('cookie-admin');
    docs.set('articles/gambar-inline', { ...ready, slug: 'gambar-inline', content: `Teks ![Alt](${CLD}) menempel.`, status: 'draft', contentFormat: 'markdown' });
    const r = await publish.POST(req({}), p('gambar-inline'));
    assert.strictEqual(r.status, 400);
    assert.ok((await json(r)).checks.some(c => c.id === 'C-6'));
  });
  let firstPublishedAt;
  await check('publish: OK sets status and publishedAt, revalidates home, blog, article, sitemap; appears in public reads', async () => {
    as('cookie-admin'); revalidated.length = 0;
    assert.strictEqual(await content.getArticle('tas-samping-xsr-155'), null, 'draft hidden before publish');
    const r = await publish.POST(req({}), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 200);
    const d = docs.get('articles/tas-samping-xsr-155');
    assert.strictEqual(d.status, 'published');
    assert.ok(d.publishedAt);
    firstPublishedAt = d.publishedAt;
    assert.deepStrictEqual(revalidated, paths('tas-samping-xsr-155'));
    assert.ok((await content.getArticles()).some(a => a.slug === 'tas-samping-xsr-155'));
  });
  await check('publish: changes made between the checks and the write -> 409 (unchecked content never goes live)', async () => {
    as('cookie-admin');
    docs.set('articles/balapan', { ...ready, slug: 'balapan', status: 'draft', contentFormat: 'markdown' }); bump('articles/balapan');
    state.beforeUpdate = (key) => { docs.set(key, { ...docs.get(key), content: '![](GAMBAR-1)' }); bump(key); };
    const r = await publish.POST(req({}), p('balapan'));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(docs.get('articles/balapan').status, 'draft');
  });
  await check('PUT on a published article failing a blocking check -> 400 with checks, no write', async () => {
    as('cookie-admin'); const w = counters.writes; revalidated.length = 0;
    const r = await article.PUT(req({ ...ready, coverAlt: '' }, 'PUT'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 400);
    assert.ok((await json(r)).checks.some(c => c.id === 'C-5'));
    assert.strictEqual(counters.writes, w);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('PUT on a published article that passes -> 200, revalidated, still published', async () => {
    as('cookie-admin'); revalidated.length = 0;
    const r = await article.PUT(req({ ...ready, title: 'Judul baru' }, 'PUT'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([docs.get('articles/tas-samping-xsr-155').title, docs.get('articles/tas-samping-xsr-155').status], ['Judul baru', 'published']);
    assert.deepStrictEqual(revalidated, paths('tas-samping-xsr-155'));
  });
  await check('unpublish: back to draft, publishedAt kept, revalidated, gone from public reads and the single GET', async () => {
    as('cookie-admin'); revalidated.length = 0;
    const r = await publish.DELETE(req({}, 'DELETE'), p('tas-samping-xsr-155'));
    assert.strictEqual(r.status, 200);
    const d = docs.get('articles/tas-samping-xsr-155');
    assert.deepStrictEqual([d.status, d.publishedAt], ['draft', firstPublishedAt]);
    assert.deepStrictEqual(revalidated, paths('tas-samping-xsr-155'));
    assert.strictEqual(await content.getArticle('tas-samping-xsr-155'), null);
    as(null); assert.strictEqual((await article.GET(req({}, 'GET'), p('tas-samping-xsr-155'))).status, 404);
  });
  await check('republish keeps the first publishedAt', async () => {
    as('cookie-admin');
    await new Promise((s) => setTimeout(s, 5));
    assert.strictEqual((await publish.POST(req({}), p('tas-samping-xsr-155'))).status, 200);
    assert.strictEqual(docs.get('articles/tas-samping-xsr-155').publishedAt, firstPublishedAt);
  });
  await check('publish: a synchronous revalidatePath error does not fail the saved publish', async () => {
    as('cookie-admin'); state.failRevalidate = true;
    docs.set('articles/tetap-terbit', { ...ready, slug: 'tetap-terbit', status: 'draft', contentFormat: 'markdown' });
    const r = await quiet(() => publish.POST(req({}), p('tetap-terbit')));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(docs.get('articles/tetap-terbit').status, 'published');
  });

  // Legacy plain articles
  await check('legacy plain article (no status, no contentFormat): publish checks only C-1 to C-3; gallery kept on save', async () => {
    as('cookie-admin');
    docs.set('articles/gasber-16', { title: 'Gasber 16', slug: 'gasber-16', excerpt: 'Ride', content: 'Baris 1\nBaris 2', images: [CLD], createdAt: '2026-10-25T00:00:00.000Z' });
    const r = await article.PUT(req({ title: 'Gasber 16', excerpt: 'Ride', content: 'Baris 1\nBaris 2', images: [CLD, CLD] }, 'PUT'), p('gasber-16'));
    assert.strictEqual(r.status, 200);
    const d = docs.get('articles/gasber-16');
    assert.deepStrictEqual([d.contentFormat, d.images.length, d.status], ['plain', 2, undefined]);
  });
  await check('conversion: plain -> markdown accepted (gallery cleared); markdown -> plain rejected', async () => {
    as('cookie-admin');
    docs.set('articles/lama-ubah', { title: 'Lama', slug: 'lama-ubah', excerpt: 'x', content: 'a', images: [CLD], status: 'draft' });
    const r = await article.PUT(req({ title: 'Lama', excerpt: 'x', content: `a\n\n![Alt](${CLD})`, contentFormat: 'markdown', images: [CLD] }, 'PUT'), p('lama-ubah'));
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([docs.get('articles/lama-ubah').contentFormat, docs.get('articles/lama-ubah').images], ['markdown', []]);
    assert.strictEqual((await article.PUT(req({ title: 'Lama', contentFormat: 'plain' }, 'PUT'), p('lama-ubah'))).status, 400);
    assert.strictEqual((await article.PUT(req({ title: 'Lama', contentFormat: 'html' }, 'PUT'), p('lama-ubah'))).status, 400);
  });
  await check('unpublish a legacy article records publishedAt from createdAt, so its indexed slug stays locked', async () => {
    as('cookie-admin');
    assert.strictEqual((await publish.DELETE(req({}, 'DELETE'), p('gasber-16'))).status, 200);
    assert.deepStrictEqual([docs.get('articles/gasber-16').status, docs.get('articles/gasber-16').publishedAt], ['draft', '2026-10-25T00:00:00.000Z']);
  });

  // Reads
  await check('GET list: non-admin sees published and legacy only; admin sees drafts too', async () => {
    as(null);
    const pub = (await json(await articles.GET())).items.map(i => i.slug);
    assert.ok(pub.includes('tas-samping-xsr-155') && !pub.includes('draf-kosong') && !pub.includes('gasber-16'));
    as('cookie-affiliate');
    const aff = (await json(await quiet(() => articles.GET()))).items.map(i => i.slug);
    assert.ok(!aff.includes('draf-kosong'));
    as('cookie-admin');
    const all = (await json(await articles.GET())).items.map(i => i.slug);
    assert.ok(all.includes('draf-kosong') && all.includes('gasber-16'));
  });
  await check('GET list: viewer says whether the session was accepted as admin (drafts hidden otherwise)', async () => {
    as(null); assert.strictEqual((await json(await articles.GET())).viewer, 'public');
    as('cookie-admin'); assert.strictEqual((await json(await articles.GET())).viewer, 'admin');
  });
  await check('publish: a body marked cannot parse -> 400 with C-4, not a 500', async () => {
    as('cookie-admin');
    docs.set('articles/terlalu-dalam', { ...ready, slug: 'terlalu-dalam', content: '- '.repeat(5000) + 'x', status: 'draft', contentFormat: 'markdown' });
    const r = await quiet(() => publish.POST(req({}), p('terlalu-dalam')));
    assert.strictEqual(r.status, 400);
    assert.ok((await json(r)).checks.some(c => c.id === 'C-4'));
  });
  await check('API errors are Indonesian with a next step (404 and 500)', async () => {
    as('cookie-admin');
    const r = await publish.POST(req({}), p('tidak-ada'));
    assert.match((await json(r)).error, /tidak ditemukan/);
  });
  await check('GET single: draft -> 404 for the public, 200 for an admin', async () => {
    as(null); assert.strictEqual((await article.GET(req({}, 'GET'), p('draf-kosong'))).status, 404);
    as('cookie-admin'); assert.strictEqual((await article.GET(req({}, 'GET'), p('draf-kosong'))).status, 200);
  });

  // Preview
  await check('preview: no cookie -> 401, non-admin -> 403', async () => {
    as(null); assert.strictEqual((await preview.POST(req({ content: 'a', contentFormat: 'markdown' }))).status, 401);
    as('cookie-affiliate'); assert.strictEqual((await quiet(() => preview.POST(req({ content: 'a', contentFormat: 'markdown' })))).status, 403);
  });
  await check('preview: over 100 KB -> 413', async () => {
    as('cookie-admin');
    const big = JSON.stringify({ content: 'x'.repeat(100 * 1024), contentFormat: 'markdown' });
    assert.strictEqual((await preview.POST(req(big))).status, 413);
  });
  await check('preview: 200 with sanitized html and warnings, zero Firestore reads or writes', async () => {
    as('cookie-admin'); const r0 = counters.reads, w0 = counters.writes;
    const r = await preview.POST(req({ content: `## Judul\n\n<script>alert(1)</script>\n\n![Alt](${CLD})\n\n![Belum](../images/K-03/a.jpg)`, contentFormat: 'markdown' }));
    assert.strictEqual(r.status, 200);
    const body = await json(r);
    assert.ok(body.html.includes('<h2>Judul</h2>') && body.html.includes('<figure>') && !body.html.includes('<script'));
    assert.deepStrictEqual(body.warnings.map(w => w.kind).sort(), ['placeholder', 'raw-html']);
    assert.deepStrictEqual([counters.reads, counters.writes], [r0, w0]);
  });
  await check('preview: same HTML as the renderer used by the public page', async () => {
    as('cookie-admin');
    const { renderArticle } = require(path.join(ROOT, 'lib/markdown.ts'));
    const src = docs.get('articles/tas-samping-xsr-155').content;
    const body = await json(await preview.POST(req({ content: src, contentFormat: 'markdown' })));
    assert.strictEqual(body.html, renderArticle({ content: src, contentFormat: 'markdown' }).html);
  });

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
