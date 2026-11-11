// F-031 API: the route logic of lib/warranty/handlers.ts (public routes and the ERP API) against an in-memory Firestore
// fake, an injected token verifier, and a fake Cloudinary Admin API (design.md §12). No network, no Firebase project,
// invented data only. Emulator-backed tests are release 2 (requirement 9.2: no emulator setup in the repo).
// Usage: npm run test:warranty-api  (or: node tests/f031-warranty-api.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');
const crypto = require('crypto');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

global.fetch = async url => {
  throw new Error(`real fetch called: ${url}`);
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  for (const ext of ['', '.ts', '.tsx']) {
    if (path.isAbsolute(request) && fs.existsSync(request + ext) && fs.statSync(request + ext).isFile()) return request + ext;
  }
  return origResolve.call(this, request, parent, ...rest);
};
const compile = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  m._compile(out.outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const H = require(path.join(ROOT, 'lib/warranty/handlers.ts'));
const R = require(path.join(ROOT, 'lib/warranty/rules.ts'));
const S = require(path.join(ROOT, 'lib/warranty/server.ts'));
const CL = require(path.join(ROOT, 'lib/warranty/cloudinary.ts'));
const { WARRANTY_COPY } = require(path.join(ROOT, 'lib/warranty/copy.ts'));
const E = WARRANTY_COPY.errors;

// In-memory Firestore: the subset the handlers use (doc get/delete, transactions with get/set/create/update,
// orderBy+limit, where ==/< , count). Timestamps are FakeTs objects with toMillis().
class FakeTs {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
}
const stamp = ms => new FakeTs(ms);
const clone = v => (v instanceof FakeTs ? v : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
function fakeDb() {
  const store = new Map();
  const stats = { reads: 0, writes: 0, failTx: false };
  const key = (c, id) => `${c}/${id}`;
  const snapOf = (c, id) => {
    const v = store.get(key(c, id));
    return { exists: v !== undefined, id, ref: ref(c, id), data: () => (v === undefined ? undefined : clone(v)) };
  };
  function ref(c, id) {
    return {
      id,
      _c: c,
      async get() { stats.reads++; return snapOf(c, id); },
      async delete() { stats.writes++; store.delete(key(c, id)); },
    };
  }
  const val = v => (v instanceof FakeTs ? v.ms : v);
  function query(c, filters = [], order = null, lim = Infinity) {
    const run = () => {
      let rows = [...store.entries()].filter(([k]) => k.startsWith(c + '/')).map(([k, v]) => ({ id: k.slice(c.length + 1), v }));
      for (const [f, op, x] of filters) rows = rows.filter(r => (op === '==' ? val(r.v[f]) === val(x) : op === '<' ? val(r.v[f]) < val(x) : false));
      if (order) rows.sort((a, b) => (val(a.v[order[0]]) - val(b.v[order[0]])) * (order[1] === 'desc' ? -1 : 1));
      return rows.slice(0, lim);
    };
    return {
      where: (f, op, x) => query(c, [...filters, [f, op, x]], order, lim),
      orderBy: (f, dir = 'asc') => query(c, filters, [f, dir], lim),
      limit: n => query(c, filters, order, n),
      async get() { const rows = run(); stats.reads += rows.length || 1; return { docs: rows.map(r => snapOf(c, r.id)) }; },
      count: () => ({ async get() { stats.reads++; const n = run().length; return { data: () => ({ count: n }) }; } }),
    };
  }
  const db = {
    _store: store,
    stats,
    collection: c => Object.assign(query(c), { doc: id => ref(c, id) }),
    async runTransaction(fn) {
      if (stats.failTx) throw new Error('simulated Firestore outage');
      const writes = [];
      const tx = {
        async get(r) { stats.reads++; return snapOf(r._c, r.id); },
        set(r, v) { writes.push(['set', r, v]); },
        create(r, v) { writes.push(['create', r, v]); },
        update(r, v) { writes.push(['update', r, v]); },
      };
      const out = await fn(tx);
      for (const [op, r, v] of writes) {
        const k = key(r._c, r.id);
        if (op === 'create' && store.has(k)) throw new Error('ALREADY_EXISTS');
        if (op === 'update' && !store.has(k)) throw new Error('NOT_FOUND');
        for (const [f, x] of Object.entries(v)) if (x === undefined) throw new Error(`undefined field ${f} (Firestore rejects it)`);
        store.set(k, op === 'update' ? { ...store.get(k), ...clone(v) } : clone(v));
        stats.writes++;
      }
      return out;
    },
  };
  return db;
}

// Fake Cloudinary Admin API: resources registered by tests, answered like GET /resources/image/authenticated/<id>.
function fakeCloudinary() {
  const resources = new Map();
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, auth: init && init.headers && init.headers.Authorization });
    const m = /\/resources\/image\/authenticated\/(.+)$/.exec(url);
    const id = m && m[1].split('/').map(decodeURIComponent).join('/');
    const r = id && resources.get(id);
    return { ok: Boolean(r), status: r ? 200 : 404, json: async () => (r ? { ...r } : { error: { message: 'not found' } }) };
  };
  return { resources, calls, fetch: fetchImpl, add: (publicId, over = {}) => resources.set(publicId, { public_id: publicId, resource_type: 'image', type: 'authenticated', format: 'jpg', bytes: 400000, version: 1731300001, width: 1920, height: 1440, ...over }) };
}

const SECRET = 'uji-rahasia-hmac-contoh-0123456789';
const FOLDER = 'garansi-staging/';
const ERP_ORIGIN = 'https://dashboard.inzta.id';
const T0 = Date.UTC(2026, 10, 11, 3, 0, 0);

function setup(over = {}) {
  const db = fakeDb();
  const cld = fakeCloudinary();
  const logs = [];
  let now = T0;
  let seq = 0;
  const env = {
    folder: FOLDER,
    hashSecret: SECRET,
    cloudinary: { cloud: 'democloud', apiKey: 'kunci-contoh', secret: 'rahasia-cloudinary-contoh' },
    erpProjectId: 'database-inzta',
    staff: 'uidAdmin:admin,uidProduksi:produksi',
    origins: ERP_ORIGIN,
    rates: { ...S.DEFAULT_RATES },
    production: false,
    ...over.env,
  };
  const tokens = {
    'tok-admin-aaaaaaaaaaaaaaaaaaaa': { uid: 'uidAdmin', email: 'admin.contoh@example.com', aud: 'database-inzta', iss: 'https://securetoken.google.com/database-inzta' },
    'tok-produksi-aaaaaaaaaaaaaaaaa': { uid: 'uidProduksi', email: 'produksi.contoh@example.com', aud: 'database-inzta', iss: 'https://securetoken.google.com/database-inzta' },
    'tok-outsider-aaaaaaaaaaaaaaaaa': { uid: 'uidLain', email: 'lain.contoh@example.com', aud: 'database-inzta', iss: 'https://securetoken.google.com/database-inzta' },
    'tok-otherproj-aaaaaaaaaaaaaaaa': { uid: 'uidAdmin', email: 'admin.contoh@example.com', aud: 'inzta-5244e', iss: 'https://securetoken.google.com/inzta-5244e' },
  };
  const deps = {
    db,
    env,
    now: () => now,
    randomBytes: n => (over.bytes ? over.bytes(n, seq++) : crypto.randomBytes(n)),
    fetch: cld.fetch,
    stamp,
    log: (msg, meta) => logs.push(msg + ' ' + JSON.stringify(meta || {})),
    verify: async t => {
      if (!tokens[t]) throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' });
      return tokens[t];
    },
  };
  return { db, cld, logs, deps, env, tick: ms => (now += ms), at: ms => (now = ms), get now() { return now; } };
}

const headers = (h = {}) => {
  const m = new Map(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: n => (m.has(n.toLowerCase()) ? m.get(n.toLowerCase()) : null) };
};
const pub = (body, h = {}) => ({ headers: headers({ 'x-real-ip': '203.0.113.7', ...h }), body: typeof body === 'string' ? body : JSON.stringify(body) });
const erpReq = (token, o = {}) => ({ headers: headers({ origin: ERP_ORIGIN, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(o.headers || {}) }), body: o.body === undefined ? '' : JSON.stringify(o.body), query: o.query || {} });
const ADMIN = 'tok-admin-aaaaaaaaaaaaaaaaaaaa';

let pidSeq = 0;
const newPublicId = () => `${FOLDER}${('Uji' + (++pidSeq) + 'x').padEnd(24, 'Q')}`;
async function token(t) {
  const r = await H.handleFormToken(t.deps);
  t.tick(6000);
  return r.body.token;
}
async function claimBody(t, over = {}) {
  const pid = newPublicId();
  t.cld.add(pid);
  return {
    name: 'Budi Contoh',
    whatsapp: '0812-3456-7890',
    location: 'Kota Contoh',
    product: 'lainnya',
    productOther: 'Tail bag lama (contoh)',
    channel: 'shopee',
    purchaseDate: '2026-04-01',
    orderRef: 'INV-0001',
    usage: '6-12',
    damage: ['resleting'],
    description: 'Resleting utama macet dan tidak bisa ditutup sejak kemarin.',
    photos: [{ publicId: pid, version: 1, width: 10, height: 10, format: 'jpg' }],
    videoViaWhatsApp: true,
    consent: true,
    formToken: await token(t),
    trap: '',
    ...over,
  };
}
async function feedbackBody(t, over = {}) {
  return { kind: 'saran', message: 'Tolong tambah pilihan warna hijau army untuk tail bag.', consent: true, formToken: await token(t), trap: '', ...over };
}
async function seedClaim(t, over = {}) {
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t, over.body || {}), { 'x-real-ip': `198.51.100.${++pidSeq}` }));
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  return r.body.ticket;
}
const stored = (t, col, id) => t.db._store.get(`${col}/${id}`);
async function detail(t, ticket) {
  const r = await H.handleErpClaimGet(t.deps, erpReq(ADMIN), ticket);
  return r.body.claim;
}
async function patch(t, ticket, body, tok = ADMIN) {
  return H.handleErpClaimPatch(t.deps, erpReq(tok, { body }), ticket);
}

const results = [];
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// Public: form token and upload signature

test('W3/3.3 form token: issued now, accepted after 5 s, too fast before, invalid when forged or older than 24 h', async () => {
  const t = setup();
  const tok = (await H.handleFormToken(t.deps)).body.token;
  assert.strictEqual(S.checkFormToken(SECRET, tok, T0 + 4999), 'too-fast');
  assert.strictEqual(S.checkFormToken(SECRET, tok, T0 + 5000), 'ok');
  assert.strictEqual(S.checkFormToken(SECRET, tok, T0 + 24 * 3600e3 + 1), 'invalid');
  assert.strictEqual(S.checkFormToken('lain-rahasia-0123456789', tok, T0 + 6000), 'invalid');
  assert.strictEqual(S.checkFormToken(SECRET, tok.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), T0 + 6000), 'invalid');
  assert.strictEqual(S.checkFormToken(SECRET, `${T0 - 10000}.${tok.split('.')[1]}`, T0), 'invalid');
  assert.strictEqual(S.checkFormToken(SECRET, undefined, T0), 'invalid');
});
test('W3 config: secrets missing → public routes 503 with a generic message; folder default garansi-staging/', async () => {
  const t = setup({ env: { hashSecret: null } });
  const r = await H.handleFormToken(t.deps);
  assert.strictEqual(r.status, 503);
  assert.ok(!JSON.stringify(r.body).includes('WARRANTY_HASH_SECRET'));
  const cfg = S.warrantyConfig({});
  assert.strictEqual(cfg.folder, 'garansi-staging/');
  assert.strictEqual(cfg.hashSecret, null);
  assert.strictEqual(cfg.cloudinary, null);
  assert.strictEqual(cfg.erpProjectId, 'database-inzta');
  assert.strictEqual(cfg.staff, '');
  assert.deepStrictEqual(cfg.rates, S.DEFAULT_RATES);
  assert.strictEqual(S.warrantyConfig({ WARRANTY_CLOUDINARY_FOLDER: 'garansi' }).folder, 'garansi/');
  assert.strictEqual(S.warrantyConfig({ WARRANTY_CLOUDINARY_FOLDER: '../produk/' }).folder, 'garansi-staging/');
  assert.strictEqual(S.warrantyConfig({ WARRANTY_RATE_CLAIM_HOUR: '50', WARRANTY_RATE_SIGN_HOUR: 'x' }).rates.claimHour, 50);
  assert.strictEqual(S.warrantyConfig({ WARRANTY_RATE_SIGN_HOUR: '-1' }).rates.signHour, 30);
  assert.strictEqual(S.warrantyConfig({ WARRANTY_HASH_SECRET: 'pendek' }).hashSecret, null);
});
test('W2/4.1–4.2 upload signature: environment folder, random id, signed authenticated/no-overwrite params, secret never returned', async () => {
  const t = setup();
  const r = await H.handleUploadSignature(t.deps, pub(''));
  assert.strictEqual(r.status, 200);
  const b = r.body;
  assert.deepStrictEqual(Object.keys(b).sort(), ['allowedFormats', 'apiKey', 'cloudName', 'folder', 'maxBytes', 'overwrite', 'publicId', 'signature', 'timestamp', 'type'].sort());
  assert.strictEqual(b.folder, FOLDER);
  assert.ok(b.publicId.startsWith(FOLDER) && /^[A-Za-z0-9_-]{24}$/.test(b.publicId.slice(FOLDER.length)));
  assert.strictEqual(b.allowedFormats, 'jpg,png,webp');
  assert.strictEqual(b.type, 'authenticated');
  assert.strictEqual(b.overwrite, false);
  assert.strictEqual(b.signature, CL.signParams({ allowed_formats: 'jpg,png,webp', overwrite: 'false', public_id: b.publicId, timestamp: b.timestamp, type: 'authenticated' }, 'rahasia-cloudinary-contoh'));
  assert.ok(!JSON.stringify(b).includes('rahasia-cloudinary-contoh'));
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  const r2 = await H.handleUploadSignature(t.deps, pub(''));
  assert.notStrictEqual(r2.body.publicId, b.publicId);
});
test('W2/4.3 upload signature: 30 per hour per hashed IP, then 429; another IP still passes; 503 without Cloudinary keys', async () => {
  const t = setup();
  for (let i = 0; i < 30; i++) assert.strictEqual((await H.handleUploadSignature(t.deps, pub(''))).status, 200);
  const over = await H.handleUploadSignature(t.deps, pub(''));
  assert.strictEqual(over.status, 429);
  assert.strictEqual(over.body.error, E.rateLimited);
  assert.strictEqual((await H.handleUploadSignature(t.deps, pub('', { 'x-real-ip': '203.0.113.99' }))).status, 200);
  t.tick(3600e3);
  assert.strictEqual((await H.handleUploadSignature(t.deps, pub(''))).status, 200, 'next hour bucket');
  const n = setup({ env: { cloudinary: null } });
  const u = await H.handleUploadSignature(n.deps, pub(''));
  assert.strictEqual(u.status, 503);
  assert.strictEqual(u.body.error, E.photoUnavailable);
});

// Public: POST /api/garansi

test('W4/3.1 claim: 413 over 32 KB (body or declared length), 400 bad JSON, array, unknown keys', async () => {
  const t = setup();
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub('x'.repeat(32 * 1024 + 1)))).status, 413);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub('{}', { 'content-length': String(40000) }))).status, 413);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub('{bukan json'))).status, 400);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub('[1,2]'))).status, 400);
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { status: 'resolved' })));
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.code, 'UNKNOWN_KEYS');
  assert.strictEqual(t.db._store.size, 0);
});
test('W4/3.3 claim: filled honeypot → silent 200 that looks like success, no write at all', async () => {
  const t = setup();
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { trap: 'http://spam.example' })));
  assert.strictEqual(r.status, 200);
  assert.ok(R.TICKET_RE.test(r.body.ticket));
  assert.strictEqual(t.db._store.size, 0);
  assert.strictEqual(t.cld.calls.length, 0);
});
test('W4/3.3 claim: timer token missing, forged, or under 5 s → 400 without writes', async () => {
  const t = setup();
  const b = await claimBody(t);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub({ ...b, formToken: undefined }))).body.code, 'FORM_EXPIRED');
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub({ ...b, formToken: '1.abc' }))).body.code, 'FORM_EXPIRED');
  const fresh = (await H.handleFormToken(t.deps)).body.token;
  const fast = await H.handleCreateClaim(t.deps, pub({ ...b, formToken: fresh }));
  assert.strictEqual(fast.status, 400);
  assert.strictEqual(fast.body.code, 'TOO_FAST');
  assert.strictEqual(fast.body.error, E.tooFast);
  assert.strictEqual(t.db._store.size, 0);
});
test('W4/3.1 claim: field errors come back per field with the form messages', async () => {
  const t = setup();
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { whatsapp: '021-555', description: 'pendek', consent: false })));
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.code, 'INVALID');
  assert.deepStrictEqual(r.body.fields, { whatsapp: E.whatsappInvalid, description: E.descriptionLength, consent: E.consentRequired });
});
test('W4/3.2 claim: a photo outside the environment folder or not found on Cloudinary is refused; no raw URL stored', async () => {
  const t = setup();
  const foreign = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { photos: [{ publicId: 'garansi/Ab3dEf6hIj9kLm2nOp5qRs8t', version: 1, width: 1, height: 1, format: 'jpg' }] })));
  assert.strictEqual(foreign.status, 400);
  assert.strictEqual(foreign.body.fields.photos, E.photosInvalid);
  const missing = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { photos: [{ publicId: `${FOLDER}${'Z'.repeat(24)}`, version: 1, width: 1, height: 1, format: 'jpg' }] })));
  assert.strictEqual(missing.status, 400);
  assert.strictEqual(missing.body.fields.photos, E.photosInvalid);
  const pid = newPublicId();
  t.cld.add(pid, { type: 'upload' });
  const wrongType = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { photos: [{ publicId: pid, version: 1, width: 1, height: 1, format: 'jpg' }] })));
  assert.strictEqual(wrongType.status, 400);
  const big = newPublicId();
  t.cld.add(big, { bytes: 11 * 1024 * 1024 });
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub(await claimBody(t, { photos: [{ publicId: big, version: 1, width: 1, height: 1, format: 'jpg' }] })))).status, 400);
  assert.strictEqual([...t.db._store.keys()].filter(k => k.startsWith('warrantyClaims/')).length, 0);
  assert.ok(t.cld.calls.every(c => c.auth === 'Basic ' + Buffer.from('kunci-contoh:rahasia-cloudinary-contoh').toString('base64')));
});
test('W4/3.4 claim: 201 { ticket } and the document shape of design.md §3', async () => {
  const t = setup();
  const body = await claimBody(t);
  const r = await H.handleCreateClaim(t.deps, pub(body));
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.deepStrictEqual(Object.keys(r.body), ['ticket']);
  const d = stored(t, 'warrantyClaims', r.body.ticket);
  assert.ok(R.TICKET_RE.test(d.ticket));
  assert.deepStrictEqual(d.customer, { name: 'Budi Contoh', whatsapp: '6281234567890', location: 'Kota Contoh' });
  assert.deepStrictEqual(d.product, { slug: null, name: 'Tail bag lama (contoh)', channel: 'shopee', purchaseDate: '2026-04-01', orderRef: 'INV-0001', usage: '6-12' });
  assert.deepStrictEqual(d.photos, [{ publicId: body.photos[0].publicId, version: 1731300001, width: 1920, height: 1440, format: 'jpg' }], 'values from Cloudinary, not from the client');
  assert.strictEqual(d.videoViaWhatsApp, true);
  assert.strictEqual(d.outsidePeriod, true, 'April → November is more than 6 months (3.5a), still stored');
  assert.strictEqual(d.status, 'new');
  assert.strictEqual(d.assignee, 'admin');
  assert.strictEqual(d.publicNote, '');
  assert.strictEqual(d.resolution, null);
  assert.strictEqual(d.rejectReason, null);
  assert.deepStrictEqual(d.history, [{ at: new Date(t.now).toISOString(), by: 'customer', to: 'new' }]);
  assert.strictEqual(d.consentAt, new Date(t.now).toISOString());
  for (const f of ['createdAt', 'updatedAt', 'statusChangedAt']) assert.strictEqual(d[f].toMillis(), t.now, f);
  assert.strictEqual(d.firstResponseAt, null);
  assert.strictEqual(d.closedAt, null);
  assert.strictEqual(d.ipHash, S.ipHash(SECRET, '203.0.113.7'));
  assert.ok(!JSON.stringify(d).includes('203.0.113.7'), 'IP never stored in clear (3.6)');
  assert.ok(!JSON.stringify(d).includes('formToken') && !('trap' in d) && !('consent' in d));
  assert.ok(!JSON.stringify(d).includes('http'), 'no URL stored');
});
test('W4/2.2 claim: an active product slug is named by the server; an inactive or unknown slug is refused', async () => {
  const t = setup();
  t.db._store.set('products/tail-bag-contoh', { name: 'Tail bag (contoh)', isActive: true });
  t.db._store.set('products/tas-lama-contoh', { name: 'Tas lama (contoh)', isActive: false });
  const ok = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { product: 'tail-bag-contoh', productOther: undefined })));
  assert.strictEqual(ok.status, 201);
  assert.deepStrictEqual(stored(t, 'warrantyClaims', ok.body.ticket).product.slug, 'tail-bag-contoh');
  assert.strictEqual(stored(t, 'warrantyClaims', ok.body.ticket).product.name, 'Tail bag (contoh)');
  const off = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { product: 'tas-lama-contoh' }), { 'x-real-ip': '203.0.113.8' }));
  assert.strictEqual(off.body.fields.product, E.productUnknown);
});
test('W3/3.3 claim limits: 3 per hour per IP, then 429; a refused request does not count; next hour opens again', async () => {
  const t = setup();
  for (let i = 0; i < 3; i++) assert.strictEqual((await H.handleCreateClaim(t.deps, pub(await claimBody(t, { whatsapp: `0812345600${i}0` })))).status, 201);
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t, { whatsapp: '081234560990' })));
  assert.strictEqual(r.status, 429);
  assert.strictEqual(r.body.error, 'Terlalu banyak pengajuan. Coba lagi nanti atau hubungi admin lewat WhatsApp.');
  const hourKey = [...t.db._store.keys()].find(k => k.startsWith('rateLimits/garansi-submit-') && !k.includes('-day-'));
  assert.strictEqual(t.db._store.get(hourKey).count, 3, 'the refused request did not increment');
  t.tick(3600e3);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub(await claimBody(t, { whatsapp: '081234560880' })))).status, 201);
});
test('W3/3.3 claim limits: 3 per day per WhatsApp number across IPs; 10 per day per IP; overridable per environment', async () => {
  const t = setup();
  for (let i = 0; i < 3; i++) assert.strictEqual((await H.handleCreateClaim(t.deps, pub(await claimBody(t), { 'x-real-ip': `192.0.2.${i}` }))).status, 201);
  assert.strictEqual((await H.handleCreateClaim(t.deps, pub(await claimBody(t), { 'x-real-ip': '192.0.2.50' }))).status, 429);
  const d = setup({ env: { rates: { ...S.DEFAULT_RATES, claimHour: 100 } } });
  for (let i = 0; i < 10; i++) assert.strictEqual((await H.handleCreateClaim(d.deps, pub(await claimBody(d, { whatsapp: `08123456${String(i).padStart(4, '0')}` })))).status, 201, `day ${i}`);
  assert.strictEqual((await H.handleCreateClaim(d.deps, pub(await claimBody(d, { whatsapp: '081299990000' })))).status, 429);
  const keys = [...d.db._store.keys()].filter(k => k.startsWith('rateLimits/'));
  assert.ok(keys.every(k => !k.includes('6281') && !k.includes('203.0.113')), 'keys hold hashes only');
  assert.ok(keys.every(k => d.db._store.get(k).expiresAt instanceof FakeTs));
});
test('W4/3.4 claim: ticket collision retries with a new number; 5 collisions → 500 generic', async () => {
  const same = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  let tries = 0;
  const t = setup({ bytes: n => (n === 6 ? (tries++ < 2 ? same : crypto.randomBytes(6)) : crypto.randomBytes(n)) });
  const existing = R.generateTicket(same);
  t.db._store.set(`warrantyClaims/${existing}`, { ticket: existing, status: 'new' });
  tries = 0;
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t)));
  assert.strictEqual(r.status, 201);
  assert.notStrictEqual(r.body.ticket, existing);
  const stuck = setup({ bytes: n => (n === 6 ? same : crypto.randomBytes(n)) });
  stuck.db._store.set(`warrantyClaims/${existing}`, { ticket: existing });
  const s = await H.handleCreateClaim(stuck.deps, pub(await claimBody(stuck)));
  assert.strictEqual(s.status, 500);
  assert.deepStrictEqual(s.body, { error: E.server, code: 'SERVER' });
});
test('W4/3.5 claim: errors carry no stack or Firestore detail; logs hold the ticket only, no personal data', async () => {
  const t = setup();
  const r = await H.handleCreateClaim(t.deps, pub(await claimBody(t)));
  t.db.stats.failTx = true;
  const fail = await H.handleCreateClaim(t.deps, pub(await claimBody(t), { 'x-real-ip': '203.0.113.9' }));
  assert.strictEqual(fail.status, 500);
  assert.deepStrictEqual(fail.body, { error: E.server, code: 'SERVER' });
  const all = t.logs.join('\n');
  assert.ok(all.includes(r.body.ticket));
  for (const pii of ['Budi', '6281234567890', '0812', 'Kota Contoh', '203.0.113', 'Resleting', 'simulated Firestore outage']) assert.ok(!all.includes(pii), pii);
});

// Public: POST /api/masukan

test('W4b/10.3 feedback: 201 { ref } and the document shape; optional contact empty', async () => {
  const t = setup();
  const r = await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t)));
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  assert.ok(R.FEEDBACK_REF_RE.test(r.body.ref));
  const d = stored(t, 'feedback', r.body.ref);
  assert.deepStrictEqual(
    { ...d, createdAt: d.createdAt.toMillis(), updatedAt: d.updatedAt.toMillis() },
    { ref: r.body.ref, kind: 'saran', message: 'Tolong tambah pilihan warna hijau army untuk tail bag.', product: null, contact: { name: null, whatsapp: null }, status: 'new', internalNote: '', history: [{ at: new Date(t.now).toISOString(), by: 'customer', to: 'new' }], consentAt: new Date(t.now).toISOString(), ipHash: S.ipHash(SECRET, '203.0.113.7'), createdAt: t.now, updatedAt: t.now },
  );
  const withContact = await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { name: 'Sari Contoh', whatsapp: '+62 812 1111 2222', product: 'lainnya', productOther: 'Jas hujan (contoh)' })));
  const c = stored(t, 'feedback', withContact.body.ref);
  assert.deepStrictEqual(c.contact, { name: 'Sari Contoh', whatsapp: '6281211112222' });
  assert.deepStrictEqual(c.product, { slug: null, name: 'Jas hujan (contoh)' });
});
test('W4b/10.3 feedback: honeypot, timer, unknown keys, validation, own budget 3/hour and global daily cap', async () => {
  const t = setup();
  const hp = await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { trap: 'x' })));
  assert.strictEqual(hp.status, 200);
  assert.ok(R.FEEDBACK_REF_RE.test(hp.body.ref));
  assert.strictEqual(t.db._store.size, 0);
  assert.strictEqual((await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { photos: [] })))).body.code, 'UNKNOWN_KEYS');
  assert.strictEqual((await H.handleCreateFeedback(t.deps, pub({ ...(await feedbackBody(t)), formToken: 'x' }))).body.code, 'FORM_EXPIRED');
  const bad = await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { kind: 'pujian', message: 'pendek' })));
  assert.deepStrictEqual(bad.body.fields, { kind: E.kindRequired, message: E.messageLength });
  for (let i = 0; i < 3; i++) assert.strictEqual((await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t)))).status, 201);
  assert.strictEqual((await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t)))).status, 429);
  const g = setup({ env: { rates: { ...S.DEFAULT_RATES, feedbackGlobalDay: 2 } } });
  assert.strictEqual((await H.handleCreateFeedback(g.deps, pub(await feedbackBody(g), { 'x-real-ip': '192.0.2.1' }))).status, 201);
  assert.strictEqual((await H.handleCreateFeedback(g.deps, pub(await feedbackBody(g), { 'x-real-ip': '192.0.2.2' }))).status, 201);
  const cap = await H.handleCreateFeedback(g.deps, pub(await feedbackBody(g), { 'x-real-ip': '192.0.2.3' }));
  assert.strictEqual(cap.status, 429);
  assert.ok(g.db._store.has(`rateLimits/masukan-submit-global-${R.rateBuckets(g.now).day}`));
});

// ERP API: auth and CORS

test('W5/5.1 auth: no token 401, bad token 401, other project 401, not listed 403, produksi 403 in R1, admin 200', async () => {
  const t = setup();
  const cases = [[null, 401], ['tok-bogus-aaaaaaaaaaaaaaaaaaa', 401], ['tok-otherproj-aaaaaaaaaaaaaaaa', 401], ['tok-outsider-aaaaaaaaaaaaaaaaa', 403], ['tok-produksi-aaaaaaaaaaaaaaaaa', 403], [ADMIN, 200]];
  for (const [tok, status] of cases) {
    const r = await H.handleErpSummary(t.deps, erpReq(tok));
    assert.strictEqual(r.status, status, String(tok));
    assert.strictEqual(r.headers['Access-Control-Allow-Origin'], ERP_ORIGIN, `CORS on ${status}`);
    assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  }
  assert.strictEqual((await H.handleErpSummary(t.deps, erpReq(null))).body.code, 'UNAUTHENTICATED');
  assert.strictEqual((await H.handleErpSummary(t.deps, erpReq('tok-outsider-aaaaaaaaaaaaaaaaa'))).body.code, 'FORBIDDEN');
  const basic = await H.handleErpSummary(t.deps, { headers: headers({ origin: ERP_ORIGIN, authorization: 'Basic abc' }) });
  assert.strictEqual(basic.status, 401);
  const cookieOnly = await H.handleErpSummary(t.deps, { headers: headers({ origin: ERP_ORIGIN, cookie: 'admin_session=contoh' }) });
  assert.strictEqual(cookieOnly.status, 401, 'an admin cookie is not accepted');
});
test('W5/5.1a CORS: exact origin only, Vary: Origin, no credentials; preflight 204/403; headers on 401/403/409/500', async () => {
  const t = setup();
  const evil = await H.handleErpSummary(t.deps, erpReq(ADMIN, { headers: { origin: 'https://dashboard.inzta.id.evil.example' } }));
  assert.strictEqual(evil.headers['Access-Control-Allow-Origin'], undefined);
  assert.strictEqual(evil.headers.Vary, 'Origin');
  const pre = H.handleErpPreflight(t.deps, { headers: headers({ origin: ERP_ORIGIN }) });
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers['Access-Control-Allow-Headers'], 'Authorization, Content-Type');
  assert.ok(pre.headers['Access-Control-Allow-Methods'].includes('PATCH'));
  assert.strictEqual(pre.headers['Access-Control-Allow-Credentials'], undefined);
  assert.strictEqual(H.handleErpPreflight(t.deps, { headers: headers({ origin: 'https://evil.example' }) }).status, 403);
  const ticket = await seedClaim(t);
  const c409 = await patch(t, ticket, { expectedUpdatedAt: '2000-01-01T00:00:00.000Z', status: 'under_review' });
  assert.strictEqual(c409.status, 409);
  assert.strictEqual(c409.headers['Access-Control-Allow-Origin'], ERP_ORIGIN);
  t.db.stats.failTx = true;
  const c500 = await patch(t, ticket, { expectedUpdatedAt: 'x', status: 'under_review' });
  assert.strictEqual(c500.status, 500);
  assert.strictEqual(c500.headers['Access-Control-Allow-Origin'], ERP_ORIGIN);
  assert.deepStrictEqual(c500.body, { error: E.server, code: 'SERVER' });
});
test('W5/6.3a the ID token and Authorization header never reach logs or responses', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  const cur = await detail(t, ticket);
  await patch(t, ticket, { expectedUpdatedAt: cur.updatedAt, status: 'under_review' });
  await H.handleErpSummary(t.deps, erpReq('tok-bogus-aaaaaaaaaaaaaaaaaaa'));
  t.db.stats.failTx = true;
  await patch(t, ticket, { expectedUpdatedAt: cur.updatedAt, status: 'rejected' });
  const all = t.logs.join('\n');
  assert.ok(!/tok-|Bearer|authorization/i.test(all), all);
});

// ERP API: list, summary, detail

test('W5/5.2–5.3 list: newest first, open by default, status filter, max 200 rows, marks; 400 on unknown filter', async () => {
  const t = setup({ env: { rates: { ...S.DEFAULT_RATES, claimHour: 1000, claimDay: 1000, claimWaDay: 1000 } } });
  const tickets = [];
  for (let i = 0; i < 3; i++) {
    tickets.push(await seedClaim(t));
    t.tick(60e3);
  }
  t.db._store.get(`warrantyClaims/${tickets[0]}`).status = 'resolved';
  const r = await H.handleErpClaimList(t.deps, erpReq(ADMIN));
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.items.map(i => i.ticket), [tickets[2], tickets[1]]);
  const item = r.body.items[0];
  assert.deepStrictEqual(Object.keys(item).sort(), ['ageDays', 'assignee', 'channel', 'createdAt', 'customerName', 'outsidePeriod', 'productName', 'status', 'statusLabel', 'ticket', 'updatedAt', 'videoViaWhatsApp'].sort());
  assert.strictEqual(item.statusLabel, 'New Ticket');
  assert.strictEqual(item.videoViaWhatsApp, true);
  assert.strictEqual(item.outsidePeriod, true);
  assert.strictEqual(item.ageDays, 0);
  assert.ok(!('whatsapp' in item) && !('ipHash' in item), 'list carries no phone or hash');
  assert.deepStrictEqual((await H.handleErpClaimList(t.deps, erpReq(ADMIN, { query: { status: 'resolved' } }))).body.items.map(i => i.ticket), [tickets[0]]);
  assert.strictEqual((await H.handleErpClaimList(t.deps, erpReq(ADMIN, { query: { status: 'all' } }))).body.items.length, 3);
  assert.strictEqual((await H.handleErpClaimList(t.deps, erpReq(ADMIN, { query: { status: 'hapus' } }))).status, 400);
  for (let i = 0; i < 230; i++) t.db._store.set(`warrantyClaims/GRN-X${i}`, { ticket: `GRN-X${i}`, status: 'new', createdAt: stamp(T0 - i * 1000), customer: { name: 'Contoh' }, product: { name: 'Contoh' } });
  const big = await H.handleErpClaimList(t.deps, erpReq(ADMIN));
  assert.strictEqual(big.body.items.length, 200);
  assert.strictEqual(big.body.truncated, true);
});
test('W3 cleanup: the list route deletes at most 50 expired rate-limit counters and keeps live ones', async () => {
  const t = setup();
  for (let i = 0; i < 60; i++) t.db._store.set(`rateLimits/old-${i}`, { count: 1, expiresAt: stamp(T0 - 1000) });
  t.db._store.set('rateLimits/live', { count: 1, expiresAt: stamp(T0 + 3600e3) });
  await H.handleErpClaimList(t.deps, erpReq(ADMIN));
  const left = [...t.db._store.keys()].filter(k => k.startsWith('rateLimits/'));
  assert.strictEqual(left.length, 11);
  assert.ok(left.includes('rateLimits/live'));
});
test('W5/5.5 ringkasan: count of new claims and new feedback', async () => {
  const t = setup();
  await seedClaim(t);
  await seedClaim(t);
  await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t)));
  const r = await H.handleErpSummary(t.deps, erpReq(ADMIN));
  assert.deepStrictEqual(r.body, { newCount: 2, newFeedbackCount: 1 });
});
test('W5/5.4 detail: customer, product, signed photo URLs (s--…--), marks, allowed next statuses; 404 for unknown ids', async () => {
  const t = setup();
  t.db._store.set('products/tail-bag-contoh', { name: 'Tail bag (contoh)', isActive: true });
  const ticket = await seedClaim(t, { body: { product: 'tail-bag-contoh' } });
  const c = await detail(t, ticket);
  assert.strictEqual(c.ticket, ticket);
  assert.deepStrictEqual(c.customer, { name: 'Budi Contoh', whatsapp: '6281234567890', location: 'Kota Contoh', waLink: 'https://wa.me/6281234567890' });
  assert.strictEqual(c.product.url, 'https://inzta.id/produk/tail-bag-contoh');
  assert.strictEqual(c.photos.length, 1);
  assert.match(c.photos[0].thumbUrl, /^https:\/\/res\.cloudinary\.com\/democloud\/image\/authenticated\/s--[A-Za-z0-9_-]{8}--\/c_limit,w_400\/v1731300001\/garansi-staging\//);
  assert.match(c.photos[0].viewUrl, /\/c_limit,w_1600\//);
  assert.match(c.photos[0].downloadUrl, /expires_at=/);
  assert.ok(!JSON.stringify(c).includes('rahasia-cloudinary-contoh'));
  assert.deepStrictEqual(c.allowedNext.map(a => a.status), ['under_review', 'rejected']);
  assert.deepStrictEqual(c.allowedNext.find(a => a.status === 'rejected').requires, ['rejectReason', 'publicNote']);
  assert.strictEqual(c.videoViaWhatsApp, true);
  assert.strictEqual(c.outsidePeriod, true);
  assert.ok(!('ipHash' in c) && !('consentAt' in c));
  assert.strictEqual((await H.handleErpClaimGet(t.deps, erpReq(ADMIN), 'GRN-ZZZZZZ')).status, 404);
  assert.strictEqual((await H.handleErpClaimGet(t.deps, erpReq(ADMIN), '../feedback/x')).status, 404);
  const n = setup({ env: { cloudinary: null } });
  n.db._store = t.db._store;
  const d2 = await H.handleErpClaimGet({ ...t.deps, env: { ...t.env, cloudinary: null } }, erpReq(ADMIN), ticket);
  assert.deepStrictEqual(d2.body.claim.photos, []);
  assert.strictEqual(d2.body.claim.photosUnavailable, true);
});

// ERP API: PATCH claim

test('W5/6.2 PATCH: disallowed transition 409 and nothing written', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  const c = await detail(t, ticket);
  const before = JSON.stringify(stored(t, 'warrantyClaims', ticket));
  const r = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'resolved', resolution: 'diperbaiki', publicNote: 'Sudah diperbaiki.' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.code, 'TRANSITION');
  assert.strictEqual(JSON.stringify(stored(t, 'warrantyClaims', ticket)), before);
});
test('W5/6.5 PATCH: stale expectedUpdatedAt 409 "Tiket sudah diubah orang lain, muat ulang" and nothing written', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  const c = await detail(t, ticket);
  t.tick(1000);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review' })).status, 200);
  const before = JSON.stringify(stored(t, 'warrantyClaims', ticket));
  const r = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, assignee: 'produksi' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.body.error, 'Tiket sudah diubah orang lain, muat ulang.');
  assert.strictEqual(JSON.stringify(stored(t, 'warrantyClaims', ticket)), before);
  assert.strictEqual((await patch(t, ticket, { status: 'in_progress' })).status, 400, 'expectedUpdatedAt required');
});
test('W5/6.4 PATCH: history entry with staff email and uid, updatedAt, statusChangedAt, firstResponseAt on the first move only', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  let c = await detail(t, ticket);
  t.tick(5000);
  const r = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review', internalNote: 'Cek foto resleting.' });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const d = stored(t, 'warrantyClaims', ticket);
  assert.strictEqual(d.status, 'under_review');
  assert.deepStrictEqual(d.history[1], { at: new Date(t.now).toISOString(), by: 'admin.contoh@example.com', byUid: 'uidAdmin', from: 'new', to: 'under_review', internalNote: 'Cek foto resleting.' });
  assert.strictEqual(d.updatedAt.toMillis(), t.now);
  assert.strictEqual(d.statusChangedAt.toMillis(), t.now);
  assert.strictEqual(d.firstResponseAt.toMillis(), t.now);
  assert.strictEqual(r.body.claim.updatedAt, new Date(t.now).toISOString());
  assert.deepStrictEqual(r.body.claim.internalNotes, [{ at: new Date(t.now).toISOString(), by: 'admin.contoh@example.com', note: 'Cek foto resleting.' }]);
  const first = d.firstResponseAt.toMillis();
  c = r.body.claim;
  t.tick(5000);
  await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'waiting_customer', publicNote: 'Mohon kirim foto label produk.' });
  assert.strictEqual(stored(t, 'warrantyClaims', ticket).firstResponseAt.toMillis(), first);
  assert.deepStrictEqual(Object.keys(stored(t, 'warrantyClaims', ticket).customer), ['name', 'whatsapp', 'location'], 'customer data untouched');
});
test('W5/6.3 PATCH: required fields — waiting_customer needs a public note; rejected reason + note; resolved resolution + note', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  let c = await detail(t, ticket);
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review' })).body.claim;
  const w = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'waiting_customer', publicNote: '   ' });
  assert.strictEqual(w.status, 400);
  assert.ok(w.body.fields.publicNote);
  const rj = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'rejected' });
  assert.deepStrictEqual(Object.keys(rj.body.fields).sort(), ['publicNote', 'rejectReason']);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'rejected', rejectReason: 'alasan-lain', publicNote: 'x' })).status, 400);
  const rs = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'resolved', publicNote: 'Selesai.' });
  assert.deepStrictEqual(Object.keys(rs.body.fields), ['resolution']);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, resolution: 'diganti' })).status, 400, 'resolution only with a move to resolved');
  const ok = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'resolved', resolution: 'diganti', publicNote: 'Resleting diganti baru.' });
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  const d = stored(t, 'warrantyClaims', ticket);
  assert.strictEqual(d.resolution, 'diganti');
  assert.strictEqual(d.publicNote, 'Resleting diganti baru.');
  assert.strictEqual(d.closedAt.toMillis(), t.now);
  assert.strictEqual(ok.body.claim.customerMessage, 'Halo Budi Contoh, klaim ' + ticket + ' sudah selesai: Resleting diganti baru. Terima kasih sudah memakai INZTA.');
  assert.ok(ok.body.claim.customerWaLink.startsWith('https://wa.me/6281234567890?text=Halo%20Budi'));
});
test('W5/6.6 PATCH: entering in_progress assigns produksi automatically; assignee change alone is allowed', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  let c = await detail(t, ticket);
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review' })).body.claim;
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'in_progress', assignee: 'admin' })).body.claim;
  assert.strictEqual(c.assignee, 'produksi');
  assert.strictEqual(stored(t, 'warrantyClaims', ticket).history.at(-1).assignee, 'produksi');
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, assignee: 'admin' })).body.claim;
  assert.strictEqual(c.assignee, 'admin');
  assert.deepStrictEqual(Object.keys(stored(t, 'warrantyClaims', ticket).history.at(-1)).sort(), ['assignee', 'at', 'by', 'byUid']);
});
test('W5/6.2 PATCH: reopen resolved → under_review needs a note, clears closing data, history keeps it', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  let c = await detail(t, ticket);
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'rejected', rejectReason: 'pemakaian', publicNote: 'Kerusakan karena benturan.' })).body.claim;
  assert.strictEqual(c.status, 'rejected');
  const noNote = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review' });
  assert.strictEqual(noNote.status, 400);
  assert.ok(noNote.body.fields.note);
  c = (await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'under_review', internalNote: 'Customer kirim foto baru.' })).body.claim;
  const d = stored(t, 'warrantyClaims', ticket);
  assert.strictEqual(d.status, 'under_review');
  assert.strictEqual(d.closedAt, null);
  assert.strictEqual(d.rejectReason, null);
  assert.ok(d.history.some(h => h.rejectReason === 'pemakaian'));
});
test('W5/5.6 PATCH: unknown keys (customer data) 400, no change 400, note too long 400, internal note alone 200', async () => {
  const t = setup();
  const ticket = await seedClaim(t);
  const c = await detail(t, ticket);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, customer: { name: 'Lain' } })).body.code, 'UNKNOWN_KEYS');
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, description: 'ubah' })).status, 400);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt })).body.code, 'NO_CHANGE');
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'new' })).body.code, 'NO_CHANGE');
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, publicNote: 'x'.repeat(1001) })).status, 400);
  assert.strictEqual((await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, status: 'selesai' })).status, 400);
  const n = await patch(t, ticket, { expectedUpdatedAt: c.updatedAt, internalNote: 'Catatan\u0007 internal <script>' });
  assert.strictEqual(n.status, 200);
  assert.strictEqual(stored(t, 'warrantyClaims', ticket).history.at(-1).internalNote, 'Catatan internal <script>', 'control chars stripped; HTML escaping is the ERP job (5.6a)');
  assert.strictEqual(stored(t, 'warrantyClaims', ticket).status, 'new');
  assert.strictEqual((await H.handleErpClaimPatch(t.deps, { ...erpReq(ADMIN), body: '{x' }, ticket)).status, 400);
  assert.strictEqual((await patch(t, 'GRN-ZZZZZZ', { expectedUpdatedAt: c.updatedAt, status: 'under_review' })).status, 404);
});

// ERP API: feedback

test('W5/10.6 feedback list, detail, PATCH: forward moves, archived → read, stale 409, unknown keys 400', async () => {
  const t = setup();
  const a = (await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { name: 'Sari Contoh', whatsapp: '081211112222', message: 'x'.repeat(120) })))).body.ref;
  t.tick(1000);
  const b = (await H.handleCreateFeedback(t.deps, pub(await feedbackBody(t, { kind: 'kritik' }), { 'x-real-ip': '192.0.2.10' }))).body.ref;
  const list = await H.handleErpFeedbackList(t.deps, erpReq(ADMIN));
  assert.deepStrictEqual(list.body.items.map(i => i.ref), [b, a]);
  const ia = list.body.items[1];
  assert.strictEqual(ia.excerpt.length, 80);
  assert.strictEqual(ia.name, 'Sari Contoh');
  assert.strictEqual(ia.hasWhatsapp, true);
  assert.strictEqual(list.body.items[0].name, null);
  const get = await H.handleErpFeedbackGet(t.deps, erpReq(ADMIN), a);
  const f = get.body.feedback;
  assert.strictEqual(f.contact.waLink, 'https://wa.me/6281211112222');
  assert.deepStrictEqual(f.allowedNext, ['read', 'followed_up', 'archived']);
  const fp = (body, ref = a) => H.handleErpFeedbackPatch(t.deps, erpReq(ADMIN, { body }), ref);
  assert.strictEqual((await fp({ expectedUpdatedAt: f.updatedAt, kind: 'kritik' })).body.code, 'UNKNOWN_KEYS');
  t.tick(1000);
  const p1 = await fp({ expectedUpdatedAt: f.updatedAt, status: 'archived', internalNote: 'Sudah dibalas.' });
  assert.strictEqual(p1.status, 200, JSON.stringify(p1.body));
  assert.strictEqual(p1.body.feedback.internalNote, 'Sudah dibalas.');
  assert.deepStrictEqual(stored(t, 'feedback', a).history.at(-1), { at: new Date(t.now).toISOString(), by: 'admin.contoh@example.com', byUid: 'uidAdmin', from: 'new', to: 'archived', internalNote: 'Sudah dibalas.' });
  assert.strictEqual((await fp({ expectedUpdatedAt: f.updatedAt, status: 'read' })).status, 409, 'stale');
  const u = p1.body.feedback.updatedAt;
  assert.strictEqual((await fp({ expectedUpdatedAt: u, status: 'new' })).status, 409, 'archived → new not allowed');
  assert.strictEqual((await fp({ expectedUpdatedAt: u, status: 'read' })).status, 200, 'archived → read allowed');
  assert.deepStrictEqual((await H.handleErpFeedbackList(t.deps, erpReq(ADMIN, { query: { status: 'read' } }))).body.items.map(i => i.ref), [a]);
  assert.strictEqual((await H.handleErpFeedbackGet(t.deps, erpReq(ADMIN), 'MSK-ZZZZZZ')).status, 404);
  assert.strictEqual((await H.handleErpFeedbackGet(t.deps, erpReq('tok-outsider-aaaaaaaaaaaaaaaaa'), a)).status, 403);
});

// Firebase Admin app order (review REV-05)

test('W5/REV-05 the named "erp" app created first does not stop lib/firebaseAdmin from creating [DEFAULT]', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const keep = { k: process.env.FIREBASE_PRIVATE_KEY, e: process.env.FIREBASE_CLIENT_EMAIL, p: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
  process.env.FIREBASE_PRIVATE_KEY = privateKey;
  process.env.FIREBASE_CLIENT_EMAIL = 'uji@contoh-project.iam.gserviceaccount.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'contoh-project';
  try {
    const { erpTokenVerifier } = require(path.join(ROOT, 'lib/warranty/erp-auth.ts'));
    const verify = await erpTokenVerifier('database-inzta');
    assert.strictEqual(typeof verify, 'function');
    const { getApps } = require(path.join(ROOT, 'node_modules/firebase-admin/lib/app/index.js'));
    assert.deepStrictEqual(getApps().map(a => a.name), ['erp']);
    const fa = require(path.join(ROOT, 'lib/firebaseAdmin.ts'));
    assert.deepStrictEqual(getApps().map(a => a.name).sort(), ['[DEFAULT]', 'erp']);
    assert.strictEqual(fa.hasAdminCredentials(), true);
    assert.strictEqual(getApps().find(a => a.name === 'erp').options.projectId, 'database-inzta');
    // firebase-admin fills in Application Default Credentials lazily; no service account is passed to the erp app.
    const cred = getApps().find(a => a.name === 'erp').options.credential;
    assert.ok(!cred || cred.constructor.name === 'ApplicationDefaultCredential', cred && cred.constructor.name);
    // A warm start calls the verifier again: no "already exists".
    assert.strictEqual(await erpTokenVerifier('database-inzta'), verify);
  } finally {
    for (const [k, v] of [['FIREBASE_PRIVATE_KEY', keep.k], ['FIREBASE_CLIENT_EMAIL', keep.e], ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', keep.p]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
test('W5 the middleware matcher does not cover /api/erp, /api/garansi, or /api/masukan', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'middleware.ts'), 'utf8');
  const matcher = /matcher:\s*\[([\s\S]*?)\]/.exec(src)[1];
  for (const p of ['/api/erp', '/api/garansi', '/api/masukan', "'/api/:path*'", "'/:path*'"]) assert.ok(!matcher.includes(p), p);
});
test('W5 every ERP route file exports OPTIONS and is force-dynamic; public routes are force-dynamic', async () => {
  const erpFiles = ['app/api/erp/garansi/route.ts', 'app/api/erp/garansi/ringkasan/route.ts', 'app/api/erp/garansi/[ticket]/route.ts', 'app/api/erp/masukan/route.ts', 'app/api/erp/masukan/[ref]/route.ts'];
  for (const f of erpFiles) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(/export async function OPTIONS/.test(src), f);
    assert.ok(/dynamic = 'force-dynamic'/.test(src), f);
    assert.ok(!/console\.|authorization/i.test(src), `${f} logs nothing itself`);
  }
  for (const f of ['app/api/garansi/route.ts', 'app/api/garansi/form-token/route.ts', 'app/api/garansi/upload-signature/route.ts', 'app/api/masukan/route.ts'])
    assert.ok(/dynamic = 'force-dynamic'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f);
  const libs = ['handlers.ts', 'erp-auth.ts', 'route-deps.ts'].map(f => fs.readFileSync(path.join(ROOT, 'lib/warranty', f), 'utf8')).join('\n');
  assert.ok(!/log\([^)]*(authorization|token)/i.test(libs), 'no log call mentions the token');
  assert.ok(!/NEXT_PUBLIC_[A-Z_]*(SECRET|CLOUDINARY_API)/.test(libs), 'no secret behind NEXT_PUBLIC_');
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      results.push(['PASS', name]);
    } catch (e) {
      results.push(['FAIL', `${name}: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`]);
    }
  }
  const failed = results.filter(r => r[0] === 'FAIL');
  for (const [s, n] of results) console.log(`${s}  ${n}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
