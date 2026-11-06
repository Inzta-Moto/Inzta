// F-022: up to 10 product photos (simple and variable), batch upload, reorder, and a gallery that never hides photos.
// Layers: pure helpers (lib/product-images.ts), API validation and the POST/PUT routes against an in-memory Firestore,
// server-rendered markup of the product page gallery and the admin uploader, and static checks of the admin form.
// No request leaves the process (global fetch throws). Browser checks (real upload flow, drag, swipe) run with
// Playwright against next dev + fixture; scenarios and results are in inzta-hq docs/specs/F-022-galeri-foto-produk.md.
// Usage: npm run test:images  (or: node tests/f022-images.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

global.fetch = async (url) => { throw new Error(`real fetch called: ${url}`); };

// In-memory Firestore: enough for POST (create) and PUT (get + set) of /api/products.
const docs = new Map();
const revalidated = [];
function docRef(col, id) {
  const key = col + '/' + id;
  return {
    key, id,
    get: async () => ({ exists: docs.has(key), id, data: () => docs.get(key) }),
    set: async (v) => docs.set(key, JSON.parse(JSON.stringify(v))),
    create: async (v) => {
      if (docs.has(key)) { const e = new Error('ALREADY_EXISTS'); e.code = 6; throw e; }
      docs.set(key, JSON.parse(JSON.stringify(v)));
    },
    delete: async () => docs.delete(key),
  };
}
const fakeDb = {
  collection: (col) => ({
    doc: (id) => docRef(col, id),
    where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }), get: async () => ({ empty: true, docs: [] }) }),
  }),
};

const Link = ({ href, children, ...rest }) => require('react').createElement('a', { href, ...rest }, children);
const NextImage = ({ src, alt, width, height, sizes }) => require('react').createElement('img', { src, alt, width, height, sizes });
const realReact = require(path.join(ROOT, 'node_modules/react'));
const stubs = {
  react: Object.assign({}, realReact, { cache: (fn) => fn }),
  'next/link': { __esModule: true, default: Link },
  'next/image': { __esModule: true, default: NextImage },
  'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND'); }, useRouter: () => ({ push() {}, refresh() {} }), usePathname: () => '/admin/produk' },
  'next/cache': { revalidatePath: (p, t) => revalidated.push(t ? `${p} ${t}` : p), revalidateTag: () => {} },
  'browser-image-compression': { __esModule: true, default: async (f) => f },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, getAdminAuth: () => ({}), hasAdminCredentials: () => true },
  [path.join(ROOT, 'lib/auth')]: { requireAdmin: async () => ({ ok: true, uid: 'u-admin', email: 'admin@example.com' }), verifyAdminSession: async () => ({ uid: 'u-admin' }) },
  [path.join(ROOT, 'components/v2/fonts')]: { fontDisplay: { variable: 'fd' }, fontSans: { variable: 'fs' } },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
  if (stubs[request]) return request;
  if (request.endsWith('.css')) return request;
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
  if (resolved.endsWith('.css')) return {};
  return origLoad.call(this, request, parent, isMain);
};
const compile = (m, filename) => {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } });
  m._compile(out.outputText, filename);
};
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const I = require(path.join(ROOT, 'lib/product-images.ts'));
const H = require(path.join(ROOT, 'app/api/products/_helpers.ts'));
const PU = require(path.join(ROOT, 'lib/product-utils.ts'));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + (e && e.message)]); }
}

const CDN = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/';
const photos = (n, tag = 'p') => Array.from({ length: n }, (_, i) => `${CDN}${tag}${i + 1}.jpg`);
const simpleBody = (extra = {}) => ({ slug: 'tas-uji-f022', name: 'Tas uji F-022', productType: 'simple', description: '', category: 'hardcase', isActive: true, price: 250000, compareAtPrice: null, stock: 4, sku: null, features: [], badge: null, images: photos(10), imageUrl: `${CDN}p1.jpg`, ...extra });
const variant = (id, attrs, extra = {}) => ({ variationId: id, sku: id, attributes: attrs, price: 150000, compareAtPrice: null, stock: 5, images: [], isActive: true, ...extra });
const variableBody = (extra = {}) => ({ slug: 'tas-variasi-f022', name: 'Tas variasi F-022', productType: 'variable', description: '', category: 'softcase', isActive: true, features: [], badge: null,
  attributes: [{ id: 'a', name: 'Warna', values: ['Hitam', 'Abu'] }],
  variants: [variant('v1', { Warna: 'Hitam' }, { images: [`${CDN}hitam.jpg`] }), variant('v2', { Warna: 'Abu' }, { images: [`${CDN}abu.jpg`] })],
  images: photos(10, 'm'), imageUrl: `${CDN}m1.jpg`, ...extra });

const jsonReq = (method, body) => new Request('http://localhost/api/products', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

(async () => {
  // ── Pure helpers ──────────────────────────────────────────────────────────
  await check('U-1 limits: 10 photos per product, 1 per variant', () => {
    assert.strictEqual(I.PRODUCT_IMAGE_MAX, 10);
    assert.strictEqual(I.VARIANT_IMAGE_MAX, 1);
  });
  await check('U-2 validateImageList: undefined/[]/1/10 ok; 11 and 50 IMAGES_TOO_MANY with the limit in the message', () => {
    for (const ok of [undefined, [], photos(1), photos(10)]) assert.strictEqual(I.validateImageList(ok), null);
    const e = I.validateImageList(photos(11));
    assert.strictEqual(e.code, 'IMAGES_TOO_MANY');
    assert.match(e.message, /Maksimal 10 foto produk \(sekarang 11\)/);
    assert.strictEqual(I.validateImageList(photos(50)).code, 'IMAGES_TOO_MANY');
    assert.match(I.validateImageList(photos(2), 1, 'variasi').message, /Maksimal 1 foto variasi/);
  });
  await check('U-3 validateImageList: null = no list (older clients); non-array and bad entries are INVALID_IMAGES', () => {
    assert.strictEqual(I.validateImageList(null), null);
    for (const bad of ['https://x/a.jpg', {}, 5, true]) assert.strictEqual(I.validateImageList(bad).code, 'INVALID_IMAGES', JSON.stringify(bad));
    for (const bad of [[''], ['  '], [5], [null], [{}], [photos(1)[0], undefined], ['x'.repeat(2049)]])
      assert.strictEqual(I.validateImageList(bad).code, 'INVALID_IMAGES', JSON.stringify(bad).slice(0, 40));
    assert.strictEqual(I.validateImageList(['x'.repeat(2048)]), null);
  });
  await check('U-4 planUpload: keeps the picked order, never past the limit, reports skipped files', () => {
    const files = Array.from({ length: 12 }, (_, i) => `f${i + 1}`);
    assert.deepStrictEqual(I.planUpload(files, 0, 10), { accepted: files.slice(0, 10), skipped: 2 });
    assert.deepStrictEqual(I.planUpload(['a', 'b', 'c'], 8, 10), { accepted: ['a', 'b'], skipped: 1 });
    assert.deepStrictEqual(I.planUpload(['a', 'b', 'c'], 10, 10), { accepted: [], skipped: 3 });
    assert.deepStrictEqual(I.planUpload(['a'], 12, 10), { accepted: [], skipped: 1 });
    assert.deepStrictEqual(I.planUpload(['a', 'b'], 0, 1), { accepted: ['a'], skipped: 1 });
    assert.deepStrictEqual(I.planUpload([], 3, 10), { accepted: [], skipped: 0 });
    assert.deepStrictEqual(I.planUpload(['a'], -2, 10), { accepted: ['a'], skipped: 0 });
  });
  await check('U-5 moveItem: moves left/right/first/last, copy on bad index, input untouched', () => {
    const list = ['a', 'b', 'c', 'd'];
    assert.deepStrictEqual(I.moveItem(list, 2, 1), ['a', 'c', 'b', 'd']);
    assert.deepStrictEqual(I.moveItem(list, 0, 3), ['b', 'c', 'd', 'a']);
    assert.deepStrictEqual(I.moveItem(list, 3, 0), ['d', 'a', 'b', 'c']);
    for (const [f, t] of [[0, -1], [3, 4], [-1, 0], [1, 1]]) assert.deepStrictEqual(I.moveItem(list, f, t), list);
    assert.notStrictEqual(I.moveItem(list, 1, 1), list);
    assert.deepStrictEqual(list, ['a', 'b', 'c', 'd']);
  });
  await check('U-6 uploadSummary: empty when all uploaded; names skipped and failed files', () => {
    assert.strictEqual(I.uploadSummary({ uploaded: 3, skipped: 0, failed: [], max: 10 }), '');
    assert.strictEqual(I.uploadSummary({ uploaded: 2, skipped: 1, failed: [], max: 10 }), '2 foto berhasil diunggah. 1 foto tidak diunggah karena batasnya 10 foto.');
    assert.strictEqual(I.uploadSummary({ uploaded: 0, skipped: 0, failed: [{ name: 'a.gif', reason: 'Format harus gambar (JPG, PNG, WebP)' }], max: 10 }), 'a.gif: Format harus gambar (JPG, PNG, WebP)');
    assert.strictEqual(I.uploadSummary({ uploaded: 1, skipped: 0, failed: [{ name: 'b.jpg', reason: 'Ukuran maksimal 5MB' }], max: 10 }), '1 foto berhasil diunggah. b.jpg: Ukuran maksimal 5MB');
  });
  await check('U-7 stepPhoto: wraps around, skips placeholders, recovers from a non-photo active tile', () => {
    const p = [0, 1, 2, 4]; // tile 3 is a placeholder
    assert.strictEqual(I.stepPhoto(p, 0, 1), 1);
    assert.strictEqual(I.stepPhoto(p, 2, 1), 4);
    assert.strictEqual(I.stepPhoto(p, 4, 1), 0);
    assert.strictEqual(I.stepPhoto(p, 0, -1), 4);
    assert.strictEqual(I.stepPhoto(p, 3, 1), 0);
    assert.strictEqual(I.stepPhoto(p, 3, -1), 4);
    assert.strictEqual(I.stepPhoto([], 0, 1), -1);
    assert.strictEqual(I.stepPhoto([5], 5, 1), 5);
  });
  await check('U-8 photoPosition: 1-based index among photos only', () => {
    assert.deepStrictEqual(I.photoPosition([0, 1, 2, 4], 4), { index: 4, total: 4 });
    assert.deepStrictEqual(I.photoPosition(Array.from({ length: 10 }, (_, i) => i), 0), { index: 1, total: 10 });
    assert.strictEqual(I.photoPosition([0, 1], 3), null);
  });
  await check('U-9 swipeDirection: left = next, right = prev, taps/short/vertical ignored', () => {
    assert.strictEqual(I.swipeDirection(-80, 5), 'next');
    assert.strictEqual(I.swipeDirection(80, -10), 'prev');
    assert.strictEqual(I.swipeDirection(-39, 0), null);
    assert.strictEqual(I.swipeDirection(0, 0), null);
    assert.strictEqual(I.swipeDirection(-60, 60), null);
    assert.strictEqual(I.swipeDirection(-60, 41), null);
    assert.strictEqual(I.swipeDirection(-60, 39), 'next');
  });
  await check('U-10 thumbScrollLeft: scrolls only when the thumbnail is cut off, never below 0', () => {
    const strip = { scrollLeft: 0, clientWidth: 400 };
    assert.strictEqual(I.thumbScrollLeft(strip, { left: 100, width: 90 }), null);
    assert.strictEqual(I.thumbScrollLeft(strip, { left: 380, width: 90 }), 380 + 90 + 4 - 400);
    assert.strictEqual(I.thumbScrollLeft({ scrollLeft: 300, clientWidth: 400 }, { left: 100, width: 90 }), 96);
    assert.strictEqual(I.thumbScrollLeft({ scrollLeft: 300, clientWidth: 400 }, { left: 2, width: 90 }), 0);
  });

  await check('U-11 imageFileError: non-images and files over 5 MB are refused before upload (they take no slot)', () => {
    const C = require(path.join(ROOT, 'lib/cloudinary-upload.ts'));
    assert.strictEqual(C.imageFileError({ type: 'image/jpeg', size: 1000 }), null);
    assert.strictEqual(C.imageFileError({ type: 'image/png', size: 5 * 1024 * 1024 }), null);
    assert.strictEqual(C.imageFileError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 }), 'Ukuran maksimal 5MB');
    assert.strictEqual(C.imageFileError({ type: 'text/plain', size: 10 }), 'Format harus gambar (JPG, PNG, WebP)');
    assert.strictEqual(C.imageFileError({ type: '', size: 10 }), 'Format harus gambar (JPG, PNG, WebP)');
    const src = read('components/ImageUpload.tsx');
    // Invalid files are filtered before planUpload, so they never use a free slot.
    assert.ok(src.indexOf('imageFileError(file)') < src.indexOf('planUpload(valid'), 'validate before planning');
  });

  await check('U-12 imageKeys: stable per URL (a move keeps keys), unique for duplicate legacy URLs', () => {
    assert.deepStrictEqual(I.imageKeys(['a', 'b', 'a']), ['a#0', 'b#0', 'a#1']);
    const before = I.imageKeys(['a', 'b', 'c']);
    const after = I.imageKeys(I.moveItem(['a', 'b', 'c'], 1, 2));
    assert.deepStrictEqual([...after].sort(), [...before].sort());
    assert.strictEqual(after[2], 'b#0');
  });
  await check('U-13 focusAfterMove: keeps the pressed direction, flips at either end', () => {
    assert.strictEqual(I.focusAfterMove(3, 10, 'kanan'), 'kanan');
    assert.strictEqual(I.focusAfterMove(9, 10, 'kanan'), 'kiri');
    assert.strictEqual(I.focusAfterMove(4, 10, 'kiri'), 'kiri');
    assert.strictEqual(I.focusAfterMove(0, 10, 'kiri'), 'kanan');
  });

  // ── API validation ────────────────────────────────────────────────────────
  await check('A-1 validateSimpleProduct: 10 photos ok, 11 rejected, existing rules still win first', () => {
    assert.strictEqual(H.validateSimpleProduct(simpleBody()), null);
    assert.strictEqual(H.validateSimpleProduct(simpleBody({ images: photos(11) })).code, 'IMAGES_TOO_MANY');
    assert.strictEqual(H.validateSimpleProduct(simpleBody({ images: photos(11), price: 0 })).code, 'INVALID_PRICE');
    assert.strictEqual(H.validateSimpleProduct(simpleBody({ images: 'x' })).code, 'INVALID_IMAGES');
    assert.strictEqual(H.validateSimpleProduct(simpleBody({ images: undefined })), null);
  });
  await check('A-2 validateVariableProduct: 10 gallery photos ok, 11 rejected; variant photo lists checked, null allowed', () => {
    assert.strictEqual(H.validateVariableProduct(variableBody()), null);
    assert.strictEqual(H.validateVariableProduct(variableBody({ images: photos(11) })).code, 'IMAGES_TOO_MANY');
    const vs = variableBody().variants;
    assert.strictEqual(H.validateVariableProduct(variableBody({ variants: [{ ...vs[0], images: null }, vs[1]] })), null);
    const tooMany = H.validateVariableProduct(variableBody({ variants: [{ ...vs[0], images: photos(11) }, vs[1]] }));
    assert.strictEqual(tooMany.code, 'IMAGES_TOO_MANY');
    assert.match(tooMany.message, /foto variasi/);
    assert.strictEqual(H.validateVariableProduct(variableBody({ variants: [{ ...vs[0], images: [5] }, vs[1]] })).code, 'INVALID_IMAGES');
    // A legacy variant with two photos still saves (sanity bound only, the form keeps one per variant).
    assert.strictEqual(H.validateVariableProduct(variableBody({ variants: [{ ...vs[0], images: photos(2, 'old') }, vs[1]] })), null);
  });

  const listRoute = require(path.join(ROOT, 'app/api/products/route.ts'));
  const slugRoute = require(path.join(ROOT, 'app/api/products/[slug]/route.ts'));
  await check('A-3 POST simple with 10 photos: 201, stored in the same order, imageUrl = photo 1', async () => {
    docs.clear();
    const res = await listRoute.POST(jsonReq('POST', simpleBody()));
    assert.strictEqual(res.status, 201);
    const stored = docs.get('products/tas-uji-f022');
    assert.deepStrictEqual(stored.images, photos(10));
    assert.strictEqual(stored.imageUrl, `${CDN}p1.jpg`);
  });
  await check('A-4 POST simple/variable with 11 photos: 400 IMAGES_TOO_MANY, nothing written', async () => {
    docs.clear();
    for (const body of [simpleBody({ images: photos(11) }), variableBody({ images: photos(11, 'm') })]) {
      const res = await listRoute.POST(jsonReq('POST', body));
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).code, 'IMAGES_TOO_MANY');
    }
    assert.strictEqual(docs.size, 0);
  });
  await check('A-5 POST variable with 10 gallery photos + variant photos: 201, all stored', async () => {
    docs.clear();
    const res = await listRoute.POST(jsonReq('POST', variableBody()));
    assert.strictEqual(res.status, 201);
    const stored = docs.get('products/tas-variasi-f022');
    assert.deepStrictEqual(stored.images, photos(10, 'm'));
    assert.deepStrictEqual(stored.variants.map(v => v.images), [[`${CDN}hitam.jpg`], [`${CDN}abu.jpg`]]);
  });
  await check('A-6 PUT reorder of 10 photos is stored; PUT with 11 is 400 and the stored product is unchanged', async () => {
    docs.clear();
    await listRoute.POST(jsonReq('POST', simpleBody()));
    const reordered = [...photos(10)].reverse();
    const ok = await slugRoute.PUT(jsonReq('PUT', simpleBody({ images: reordered, imageUrl: reordered[0] })), { params: { slug: 'tas-uji-f022' } });
    assert.strictEqual(ok.status, 200);
    assert.deepStrictEqual(docs.get('products/tas-uji-f022').images, reordered);
    assert.strictEqual(docs.get('products/tas-uji-f022').imageUrl, reordered[0]);
    const bad = await slugRoute.PUT(jsonReq('PUT', simpleBody({ images: photos(11) })), { params: { slug: 'tas-uji-f022' } });
    assert.strictEqual(bad.status, 400);
    assert.deepStrictEqual(docs.get('products/tas-uji-f022').images, reordered);
  });
  await check('A-7 PUT converts a variable product from 1 to 10 gallery photos (old "Gambar utama" limit gone)', async () => {
    docs.clear();
    await listRoute.POST(jsonReq('POST', variableBody({ images: photos(1, 'm') })));
    const res = await slugRoute.PUT(jsonReq('PUT', variableBody()), { params: { slug: 'tas-variasi-f022' } });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(docs.get('products/tas-variasi-f022').images.length, 10);
  });
  await check('A-8 legacy body without images but with imageUrl still stores [imageUrl]; empty list stays []', async () => {
    docs.clear();
    const body = simpleBody({ images: undefined });
    delete body.images;
    assert.strictEqual((await listRoute.POST(jsonReq('POST', body))).status, 201);
    assert.deepStrictEqual(docs.get('products/tas-uji-f022').images, [`${CDN}p1.jpg`]);
    docs.clear();
    assert.strictEqual((await listRoute.POST(jsonReq('POST', simpleBody({ images: [], imageUrl: '' })))).status, 201);
    assert.deepStrictEqual(docs.get('products/tas-uji-f022').images, []);
    docs.clear();
    // images: null from older clients is "no list": falls back to imageUrl like a missing list.
    assert.strictEqual((await listRoute.POST(jsonReq('POST', simpleBody({ images: null })))).status, 201);
    assert.deepStrictEqual(docs.get('products/tas-uji-f022').images, [`${CDN}p1.jpg`]);
  });
  await check('A-9 imageUrl is validated too (review REV-03): non-string, blank, or over 2048 chars → 400, nothing written', async () => {
    docs.clear();
    for (const bad of [5, '   ', 'x'.repeat(2049), { url: 'a' }, ['a']]) {
      const res = await listRoute.POST(jsonReq('POST', simpleBody({ images: [], imageUrl: bad })));
      assert.strictEqual(res.status, 400, JSON.stringify(bad).slice(0, 20));
      assert.strictEqual((await res.json()).code, 'INVALID_IMAGES');
    }
    assert.strictEqual(docs.size, 0);
    for (const ok of [undefined, null, '', `${CDN}p1.jpg`]) assert.strictEqual(H.validateImageFields({ images: [], imageUrl: ok }), null, String(ok));
    const put = await slugRoute.PUT(jsonReq('PUT', variableBody({ imageUrl: 7 })), { params: { slug: 'x' } });
    assert.strictEqual(put.status, 400);
  });

  // ── Product page gallery (server render) ─────────────────────────────────
  const ProductDetail = require(path.join(ROOT, 'components/v2/product/ProductDetail.tsx')).default;
  const render = (p) => renderToStaticMarkup(React.createElement(ProductDetail, { product: { ...PU.normalizeProduct(p.slug, p), slug: p.slug }, related: [] }));
  await check('R-1 simple product with 10 photos: 10 thumbnails "Foto n dari 10", counter 1/10, arrows hidden without JS', () => {
    const html = render(simpleBody());
    for (let n = 1; n <= 10; n++) assert.ok(html.includes(`aria-label="Foto ${n} dari 10"`), `thumb ${n}`);
    assert.strictEqual((html.match(/class="iz-thumb"/g) || []).length, 10);
    assert.match(html, /<span class="iz-gallery__count" aria-hidden="true">1\/10<\/span>/);
    assert.match(html, /<div class="iz-gallery__nav iz-js-only"><button class="iz-iconbtn iz-gallery__step iz-gallery__step--prev" type="button" aria-label="Foto sebelumnya">/);
    assert.ok(html.includes('aria-label="Foto berikutnya"'));
    assert.match(html, /<noscript><style>\.iz-js-only \{ display: none !important; \}<\/style><\/noscript>/);
    // Photo 1 is the main (LCP) image and every photo appears once as a thumbnail.
    assert.ok(html.indexOf('p1.jpg') < html.indexOf('iz-thumbs'));
    for (const src of photos(10)) assert.ok(html.includes(src.split('/').pop()), src);
  });
  await check('R-2 one photo: no counter, no arrows, no thumbnail strip; no photo: placeholder text', () => {
    const one = render(simpleBody({ images: photos(1) }));
    assert.ok(!one.includes('iz-gallery__count') && !one.includes('iz-gallery__nav') && !one.includes('class="iz-thumbs"'));
    const none = render(simpleBody({ images: [], imageUrl: '' }));
    assert.ok(none.includes('Foto belum tersedia') && !none.includes('iz-gallery__count'));
  });
  await check('R-3 variable product: 10 gallery photos + 2 variant photos = 12 tiles, counter 1/12', () => {
    const html = render(variableBody());
    assert.strictEqual((html.match(/class="iz-thumb"/g) || []).length, 12);
    assert.ok(html.includes('aria-label="Foto 12 dari 12"'));
    assert.match(html, /1\/12<\/span>/);
  });
  await check('R-4 side product: placeholders ("Foto sepasang") are not counted by the counter', () => {
    const side = variableBody({ slug: 'side-uji', jualPerSisi: true, bisaSepasang: true, images: photos(3, 's'),
      attributes: [{ id: 'a', name: 'Sisi', values: ['Kiri', 'Kanan'] }],
      variants: [variant('vk', { Sisi: 'Kiri' }, { images: [`${CDN}kiri.jpg`] }), variant('vn', { Sisi: 'Kanan' })] });
    const html = render(side);
    assert.ok(html.includes('Foto sepasang'), 'placeholder tile');
    // 3 product photos + Foto kiri = 4 photos; Foto kanan and Foto sepasang are placeholders.
    assert.match(html, /1\/4<\/span>/);
  });

  // ── Admin uploader (server render) and form ──────────────────────────────
  const ImageUpload = require(path.join(ROOT, 'components/ImageUpload.tsx')).default;
  const up = (value, max) => renderToStaticMarkup(React.createElement(ImageUpload, { value, onChange: () => {}, max }));
  await check('S-1 uploader max 10 with 3 photos: multiple file input, numbered items, "Utama" on photo 1, move buttons, 3/10', () => {
    const html = up(photos(3), 10);
    assert.match(html, /<input type="file" accept="image\/jpeg,image\/png,image\/webp" multiple="" style="display:none"\/>/);
    assert.strictEqual((html.match(/class="upload-multi-item upload-multi-item--sortable"/g) || []).length, 3);
    assert.strictEqual((html.match(/draggable="true"/g) || []).length, 3);
    assert.strictEqual((html.match(/Utama/g) || []).length, 1);
    assert.ok(html.indexOf('Utama') < html.indexOf('p2.jpg'));
    assert.match(html, /<button type="button" disabled="" aria-label="Geser gambar 1 ke kiri">/);
    assert.match(html, /<button type="button" aria-label="Geser gambar 1 ke kanan">/);
    assert.match(html, /<button type="button" disabled="" aria-label="Geser gambar 3 ke kanan">/);
    assert.match(html, /aria-label="Tambah foto \(3 dari 10\)"/);
    assert.match(html, /<span>3\/10<\/span>/);
  });
  await check('S-2 uploader max 1 (variants, side presets): single file, no drag, no move buttons, no "Utama"', () => {
    const html = up([], 1);
    assert.ok(!html.includes('multiple'));
    const one = up(photos(1), 1);
    assert.ok(!one.includes('upload-multi-move') && !one.includes('Utama') && !one.includes('draggable="true"'));
    assert.ok(!one.includes('upload-area'), 'add box hidden when full');
  });
  await check('S-3 uploader at 10/10: add box hidden; 11 legacy photos: alert to remove 1 before saving', () => {
    const full = up(photos(10), 10);
    assert.ok(!full.includes('upload-area'));
    assert.strictEqual((full.match(/class="upload-multi-item/g) || []).length, 10);
    const over = up(photos(11), 10);
    assert.match(over, /role="alert">Melebihi batas 10 foto\. Hapus 1 foto sebelum menyimpan\.<\/p>/);
    // A legacy variant with 2 photos (max 1) saves fine (F-022 D-2), so no misleading alert there (REV-D2).
    assert.ok(!up(photos(2), 1).includes('role="alert"'));
  });
  await check('S-4 admin product form: one gallery for both types at PRODUCT_IMAGE_MAX, variants at VARIANT_IMAGE_MAX, client check before save', () => {
    const src = read('app/admin/(panel)/produk/page.tsx');
    assert.ok(!/maks 3|max=\{3\}/.test(src), 'old limit of 3 removed');
    assert.strictEqual((src.match(/<ImageUpload value=\{fImages\} onChange=\{setFImages\} max=\{PRODUCT_IMAGE_MAX\}[ />]/g) || []).length, 1);
    assert.strictEqual((src.match(/<ImageUpload value=\{fImages\}/g) || []).length, 1, 'one gallery uploader for both types');
    assert.ok(!/value=\{fImages\}[^>]*max=\{1\}/.test(src), 'variable main image no longer max 1');
    assert.match(src, /Gambar produk \(maks \{PRODUCT_IMAGE_MAX\}\)/);
    assert.match(src, /onChange=\{urls => updateVariant\(v\.variationId, 'images', urls\)\}\s*max=\{VARIANT_IMAGE_MAX\}/);
    assert.match(src, /if \(fImages\.length > PRODUCT_IMAGE_MAX\) \{ setFormError\(/);
    assert.match(src, /images: fImages,\s*imageUrl: fImages\[0\] \|\| ''/);
  });
  await check('S-4b admin form waits for uploads (review REV-01): gallery and variant uploaders report busy; Save, Back, and submit are locked', () => {
    const src = read('app/admin/(panel)/produk/page.tsx');
    assert.match(src, /max=\{PRODUCT_IMAGE_MAX\} onBusyChange=\{trackUpload\} \/>/);
    assert.match(src, /max=\{VARIANT_IMAGE_MAX\}\s*onBusyChange=\{trackUpload\}/);
    assert.match(src, /disabled=\{saving \|\| uploadsBusy > 0\}/);
    assert.match(src, /const cancelForm = \(\) => \{ if \(uploadsBusy > 0\) return;/);
    assert.match(src, /if \(uploadsBusy > 0\) \{ setFormError\('Tunggu upload foto selesai/);
    const up = read('components/ImageUpload.tsx');
    // The batch loop checks the mounted flag before every write to the parent.
    const loop = up.slice(up.indexOf('for (let i = 0; i < accepted.length; i++)'), up.indexOf('setMessage(uploadSummary({ uploaded'));
    assert.ok((loop.match(/if \(!aliveRef\.current\) return;/g) || []).length >= 2, 'alive checks in loop');
    assert.ok(loop.indexOf('if (!aliveRef.current) return;', loop.indexOf('await uploadImage')) < loop.indexOf('onChange(next)'));
  });
  await check('S-5 other uploader users keep their limits (side preset 1, article images 5) and article API still caps at 5', () => {
    assert.match(read('app/admin/(panel)/produk/_v2/SidePresetCard.tsx'), /images: urls\.slice\(0, 1\) \}\)\} max=\{1\}/);
    assert.match(read('app/admin/(panel)/artikel/_editor/ArticleEditor.tsx'), /onChange=\{urls => set\('images', urls\)\} max=\{5\}/);
    assert.match(read('lib/article-input.ts'), /rawImages\.length > 5/);
  });
  await check('S-6 styles: admin uploader and v2 gallery classes exist; scripts/check-v2-css.mjs passes (v2 .iz- scope)', () => {
    const out = require('child_process').execFileSync(process.execPath, [path.join(ROOT, 'scripts/check-v2-css.mjs'), path.join(ROOT, 'app/(v2)')], { cwd: ROOT, encoding: 'utf8' });
    assert.match(out, /check-v2-css: ok/);
    const admin = read('app/admin/admin.css');
    for (const c of ['.upload-multi-move', '.upload-multi-main', '.upload-msg', '.upload-multi-item.is-drop-target', '.upload-area.is-file-over']) assert.ok(admin.includes(c), c);
    const v2 = read('app/(v2)/v2-product.css');
    for (const c of ['.iz-gallery__count', '.iz-gallery__nav', '.iz-gallery__step', '.iz-gallery__live']) assert.ok(v2.includes(c), c);
  });
  await check('S-7 test page /uji-dev/upload-foto: 404 in production and without the fixture; renders the uploader in dev with the fixture', () => {
    const Page = require(path.join(ROOT, 'app/uji-dev/upload-foto/page.tsx')).default;
    const env = { NODE_ENV: process.env.NODE_ENV, F016_FIXTURE: process.env.F016_FIXTURE };
    const set = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
    try {
      for (const [nodeEnv, fixture] of [['production', '/tmp/x.json'], ['development', undefined], ['production', undefined]]) {
        set('NODE_ENV', nodeEnv); set('F016_FIXTURE', fixture);
        assert.throws(() => Page(), /NEXT_NOT_FOUND/, `${nodeEnv} ${fixture}`);
      }
      set('NODE_ENV', 'development'); set('F016_FIXTURE', '/tmp/x.json');
      const html = renderToStaticMarkup(Page());
      assert.match(html, /id="ten"/);
      assert.match(html, /multiple=""/);
    } finally { set('NODE_ENV', env.NODE_ENV); set('F016_FIXTURE', env.F016_FIXTURE); }
  });
  await check('R-5 gallery live region (review REV-04): present and empty on the server (no hydration change), absent with one photo', () => {
    assert.match(render(simpleBody()), /<span class="iz-gallery__live" aria-live="polite"><\/span>/);
    assert.ok(!render(simpleBody({ images: photos(1) })).includes('iz-gallery__live'));
  });

  let failed = 0;
  for (const [s, n] of results) {
    if (s === 'FAIL') failed++;
    console.log(`${s}  ${n}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
