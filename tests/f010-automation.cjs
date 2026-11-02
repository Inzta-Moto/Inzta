// F-010 (ADR-0020): POST /api/automation/articles, the token route the inzta-hq pipeline publishes through.
// Same harness as tests/f012-articles.cjs: the real route handler with an in-memory Firestore and stubbed Next.js APIs.
// Usage: npm run test:automation  (or: node tests/f010-automation.cjs <repo-root>)
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
const revalidateTypes = [];
const counters = { reads: 0, writes: 0 };
const state = { failRevalidate: false, beforeUpdate: null, failGet: false };

function bump(key) { versions.set(key, (versions.get(key) || 0) + 1); }
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    get: async () => {
      counters.reads++;
      if (state.failGet) throw new Error('14 UNAVAILABLE: firestore down');
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
  // F-013 phase C4: the card resolver reads every target in one call.
  getAll: async (...refs) => Promise.all(refs.map(r => r.get())),
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
  'next/cache': { revalidatePath: (p, type) => { if (state.failRevalidate) throw new Error('revalidate down'); revalidated.push(p); if (type) revalidateTypes.push(`${p}:${type}`); } },
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

const route = require(path.join(ROOT, 'app/api/automation/articles/route.ts'));
const automationAuth = require(path.join(ROOT, 'lib/automation-auth.ts'));
const articlesApi = require(path.join(ROOT, 'app/api/articles/route.ts'));
const format = require(path.join(ROOT, 'lib/article-format.ts'));

const results = [];
async function check(name, fn) {
  const saved = { ...state };
  automationAuth.resetAutomationRateLimit();
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
  Object.assign(state, saved);
}
const quiet = async (fn) => { const w = console.warn, e = console.error, i = console.info; console.warn = console.error = console.info = () => {}; try { return await fn(); } finally { console.warn = w; console.error = e; console.info = i; } };

const TOKEN_A = 'a'.repeat(20) + 'Angkasa-token-0123456789';
const TOKEN_S = 's'.repeat(20) + 'Sehan-token-0123456789xx';
function setTokens(map) {
  for (const k of Object.keys(process.env)) if (k.startsWith('AUTOMATION_TOKEN_')) delete process.env[k];
  Object.assign(process.env, map);
}
const post = (body, { token = TOKEN_A, headers = {} } = {}) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const h = { 'content-type': 'application/json', ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  return new Request('http://localhost/api/automation/articles', { method: 'POST', body: raw, headers: h });
};
const call = (body, opts) => quiet(() => route.POST(post(body, opts)));
const paths = (slug) => ['/', '/blog', `/blog/${slug}`, '/sitemap.xml', '/blog/[slug]', '/tas-motor/[kategori]', '/tentang'];

const CLD = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/foto.jpg';
const CLD2 = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/inzta/foto-2.jpg';
const ready = (slug, extra = {}) => ({
  title: 'Tank bag untuk motor matic', slug, excerpt: 'Ringkasan artikel',
  content: `## Pilih posisi\n\nIsi.\n\n![Tas tengah di skutik](${CLD2} "Foto: INZTA")\n\n## Penutup\n\nSelesai.`,
  coverImage: CLD, coverAlt: 'Sampul tas tengah', coverCaption: 'Foto: INZTA', author: 'Angkasa',
  metaTitle: 'Tank Bag Motor Matic', metaDescription: 'Deskripsi', publish: true, ...extra,
});

(async () => {
  setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S });

  await check('only POST and dynamic are exported (Next.js route export rule)', async () => {
    assert.deepStrictEqual(Object.keys(route).sort(), ['POST', 'dynamic']);
  });
  await check('no AUTOMATION_TOKEN_<NAME> configured -> 503, nothing written', async () => {
    setTokens({}); const w = counters.writes;
    const r = await call(ready('mati'));
    assert.strictEqual(r.status, 503);
    assert.strictEqual(counters.writes, w);
    setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S });
  });
  await check('a token shorter than 32 characters is ignored (only one configured -> 503)', async () => {
    setTokens({ AUTOMATION_TOKEN_PENDEK: 'pendek-sekali' });
    assert.strictEqual((await call(ready('pendek'), { token: 'pendek-sekali' })).status, 503);
    setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S });
  });
  await check('missing, malformed, or wrong token -> 401, nothing written', async () => {
    const w = counters.writes;
    assert.strictEqual((await call(ready('x1'), { token: null })).status, 401);
    assert.strictEqual((await call(ready('x2'), { token: null, headers: { authorization: TOKEN_A } })).status, 401, 'no Bearer prefix');
    assert.strictEqual((await call(ready('x3'), { token: TOKEN_A + 'x' })).status, 401);
    assert.strictEqual((await call(ready('x4'), { token: TOKEN_A.slice(0, -1) })).status, 401);
    assert.strictEqual(counters.writes, w);
  });
  await check('valid token + publish: true -> 201 published, source automation, actor recorded, pages revalidated', async () => {
    revalidated.length = 0;
    const r = await call(ready('tank-bag-motor-matic'));
    assert.strictEqual(r.status, 201);
    const body = await r.json();
    assert.deepStrictEqual([body.slug, body.articleStatus, body.url, body.editUrl], ['tank-bag-motor-matic', 'published', '/blog/tank-bag-motor-matic', '/admin/artikel/tank-bag-motor-matic']);
    const d = docs.get('articles/tank-bag-motor-matic');
    assert.deepStrictEqual([d.status, d.source, d.contentFormat, d.createdBy, d.publishedBy, d.author, d.coverCaption], ['published', 'automation', 'markdown', 'angkasa', 'angkasa', 'Angkasa', 'Foto: INZTA']);
    assert.ok(d.publishedAt && d.publishedAt === d.createdAt && d.createdAt === d.updatedAt);
    assert.deepStrictEqual(d.images, []);
    assert.deepStrictEqual(revalidated, paths('tank-bag-motor-matic'));
  });
  await check('201 lists the editor warnings: missing topik (W-7); none for topik and 2 H2', async () => {
    const r = await call(ready('peringatan-topik'));
    const { warnings } = await r.json();
    assert.ok(warnings.some(w => w.id === 'W-7'), JSON.stringify(warnings));
    const ok = await (await call(ready('dengan-topik', { topik: 'touring' }))).json();
    assert.deepStrictEqual(ok.warnings.map(w => w.id), [], JSON.stringify(ok.warnings));
    assert.strictEqual(docs.get('articles/dengan-topik').topik, 'touring');
  });
  await check('a name with an underscore is accepted (AUTOMATION_TOKEN_M_SECHAN -> m_sechan)', async () => {
    setTokens({ AUTOMATION_TOKEN_M_SECHAN: TOKEN_S });
    assert.strictEqual((await call(ready('garis-bawah'), { token: TOKEN_S })).status, 201);
    assert.strictEqual(docs.get('articles/garis-bawah').publishedBy, 'm_sechan');
    setTokens({ AUTOMATION_TOKEN_ANGKASA: TOKEN_A, AUTOMATION_TOKEN_SEHAN: TOKEN_S });
  });
  await check('REV-06: createdBy and publishedBy never reach the public API or public page data', async () => {
    const r = await quiet(() => articlesApi.GET(new Request('http://localhost/api/articles')));
    const { items } = await r.json();
    const item = items.find(i => i.slug === 'tank-bag-motor-matic');
    assert.ok(item, 'published article listed');
    assert.ok(!('createdBy' in item) && !('publishedBy' in item), JSON.stringify(Object.keys(item)));
    const pub = format.toPublicArticle('tank-bag-motor-matic', docs.get('articles/tank-bag-motor-matic'));
    assert.ok(!('createdBy' in pub) && !('publishedBy' in pub));
  });
  await check('each person has their own token: the Sehan token records "sehan"', async () => {
    assert.strictEqual((await call(ready('artikel-sehan'), { token: TOKEN_S })).status, 201);
    assert.strictEqual(docs.get('articles/artikel-sehan').publishedBy, 'sehan');
  });
  await check('server fields in the body are ignored (status, source, publishedAt, createdBy, publishedBy)', async () => {
    const r = await call(ready('field-server', { publish: false, status: 'published', source: 'admin', publishedAt: '2020-01-01', createdBy: 'hacker', publishedBy: 'hacker', createdAt: '2020-01-01' }));
    assert.strictEqual(r.status, 201);
    const d = docs.get('articles/field-server');
    assert.deepStrictEqual([d.status, d.source, d.publishedAt, d.createdBy, d.publishedBy], ['draft', 'automation', undefined, 'angkasa', undefined]);
    assert.notStrictEqual(d.createdAt, '2020-01-01');
  });
  await check('publish: false or missing -> draft, no publish checks, nothing revalidated', async () => {
    revalidated.length = 0;
    const local = { coverImage: '', content: '## A\n\n![Foto lokal](../images/K-03/foto.jpg)\n' };
    assert.strictEqual((await call(ready('draf-satu', { publish: false, ...local }))).status, 201);
    const { publish, ...noFlag } = ready('draf-dua', local);
    assert.strictEqual((await call(noFlag)).status, 201);
    for (const slug of ['draf-satu', 'draf-dua']) {
      const d = docs.get(`articles/${slug}`);
      assert.deepStrictEqual([d.status, d.publishedAt, d.publishedBy], ['draft', undefined, undefined], slug);
    }
    assert.deepStrictEqual(revalidated, []);
  });
  await check('publish that is not a boolean -> 400, nothing written', async () => {
    const w = counters.writes;
    for (const publish of ['true', 1, 'ya']) assert.strictEqual((await call(ready('bukan-boolean', { publish }))).status, 400, String(publish));
    assert.strictEqual(counters.writes, w);
  });
  await check('publish with a local image left -> 400 with C-7, nothing written', async () => {
    const w = counters.writes; revalidated.length = 0;
    const r = await call(ready('gambar-lokal', { content: '## A\n\nIsi.\n\n![Foto](../images/K-03/foto.jpg)\n\n## B\n\nIsi.' }));
    assert.strictEqual(r.status, 400);
    const body = await r.json();
    assert.ok(body.checks.some(c => c.id === 'C-7'), JSON.stringify(body.checks));
    assert.strictEqual(counters.writes, w);
    assert.ok(!docs.has('articles/gambar-lokal'));
    assert.deepStrictEqual(revalidated, []);
  });
  await check('publish without a cover or with an image from another host -> 400 (C-5, C-6 or validation)', async () => {
    const noCover = await (await call(ready('tanpa-sampul', { coverImage: '' }))).json();
    assert.ok(noCover.checks.some(c => c.id === 'C-5'), JSON.stringify(noCover));
    assert.strictEqual((await call(ready('sampul-asing', { coverImage: 'https://evil.example/a.jpg' }))).status, 400);
    const foreign = await (await call(ready('isi-asing', { content: '## A\n\n![Foto](https://evil.example/a.jpg)\n\n## B\n\nx' }))).json();
    assert.ok(foreign.checks.some(c => c.id === 'C-6'), JSON.stringify(foreign));
  });
  await check('existing slug -> 409, the published article is unchanged and nothing is revalidated', async () => {
    const before = JSON.stringify(docs.get('articles/tank-bag-motor-matic'));
    revalidated.length = 0;
    const r = await call(ready('tank-bag-motor-matic', { title: 'Judul pengganti' }));
    assert.strictEqual(r.status, 409);
    assert.strictEqual(JSON.stringify(docs.get('articles/tank-bag-motor-matic')), before);
    assert.deepStrictEqual(revalidated, []);
  });
  await check('field validation is the editor\'s: bad slug, long title, reserved slug -> 400', async () => {
    assert.strictEqual((await call(ready('Slug Salah'))).status, 400);
    assert.strictEqual((await call(ready('judul-panjang', { title: 'x'.repeat(151) }))).status, 400);
    assert.strictEqual((await call(ready('baru'))).status, 400);
  });
  await check('body over 100 KB -> 413 (Content-Length or actual size), nothing written', async () => {
    const w = counters.writes;
    assert.strictEqual((await call(ready('besar'), { headers: { 'content-length': String(100 * 1024 + 1) } })).status, 413);
    const big = JSON.stringify(ready('besar-dua', { content: 'x'.repeat(100 * 1024) }));
    assert.strictEqual((await quiet(() => route.POST(new Request('http://localhost/x', { method: 'POST', body: big, headers: { authorization: `Bearer ${TOKEN_A}` } })))).status, 413);
    assert.strictEqual(counters.writes, w);
  });
  await check('not JSON or not an object -> 400', async () => {
    assert.strictEqual((await call('{bukan json')).status, 400);
    assert.strictEqual((await call('[1,2]')).status, 400);
    assert.strictEqual((await call('null')).status, 400);
  });
  await check('more than 20 requests in an hour from one token -> 429; the other token is not affected', async () => {
    for (let i = 0; i < 20; i++) await call('{bukan json');
    assert.strictEqual((await call(ready('kebanyakan'))).status, 429);
    assert.strictEqual((await call('{bukan json', { token: TOKEN_S })).status, 400);
  });
  await check('Firestore down -> 500 with the generic message', async () => {
    const orig = fakeDb.collection;
    fakeDb.collection = () => ({ doc: () => ({ create: async () => { throw new Error('14 UNAVAILABLE'); } }) });
    try {
      const r = await call(ready('db-mati', { publish: false }));
      assert.strictEqual(r.status, 500);
      assert.ok((await r.json()).error);
    } finally { fakeDb.collection = orig; }
  });

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
