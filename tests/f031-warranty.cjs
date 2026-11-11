// F-031 pure rules (lib/warranty/rules.ts) and the Cloudinary signing helpers (lib/warranty/cloudinary.ts): phone
// normalization, field rules, HEIC refused, outside-period, transition matrix with role, required fields, staff list and
// origin parsing, ticket alphabet, WhatsApp templates, signature strings. Invented data only.
// Usage: npm run test:warranty  (or: node tests/f031-warranty.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');
const crypto = require('crypto');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

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

const R = require(path.join(ROOT, 'lib/warranty/rules.ts'));
const { WARRANTY_COPY } = require(path.join(ROOT, 'lib/warranty/copy.ts'));
const CL = require(path.join(ROOT, 'lib/warranty/cloudinary.ts'));
const E = WARRANTY_COPY.errors;

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name + ': ' + (e && e.message)]);
  }
}

// 2026-11-11 10:00 WIB
const NOW = Date.UTC(2026, 10, 11, 3, 0, 0);
const FOLDER = 'garansi-staging/';
const PRODUCTS = { 'tail-bag-contoh': 'Tail bag (contoh)', 'tank-bag-contoh': 'Tank bag (contoh)' };
const photo = (over = {}) => ({ publicId: FOLDER + 'Ab3dEf6hIj9kLm2nOp5qRs8t', version: 1731300000, width: 1600, height: 1200, format: 'jpg', ...over });
const claim = (over = {}) => ({
  name: 'Budi Contoh',
  whatsapp: '0812-3456-7890',
  location: 'Kota Contoh',
  product: 'tail-bag-contoh',
  channel: 'shopee',
  purchaseDate: '2026-09-01',
  orderRef: 'INV/2026/0001',
  usage: '1-3',
  damage: ['resleting', 'jahitan'],
  description: 'Resleting utama macet sejak minggu lalu dan jahitan samping lepas.',
  photos: [photo()],
  videoViaWhatsApp: false,
  consent: true,
  formToken: 'x',
  trap: '',
  ...over,
});
const vc = (over, ctx = {}) => R.validateClaimInput(claim(over), { now: NOW, productNames: PRODUCTS, folder: FOLDER, ...ctx });

check('W1 phone: 08…, 628…, +628…, spaces, dashes normalize to 628…', () => {
  for (const s of ['081234567890', '6281234567890', '+62 812-3456-7890', '0812 3456 7890', '0812.3456.7890'])
    assert.strictEqual(R.normalizeWhatsapp(s), '6281234567890', s);
});
check('W1 phone: landline, letters, too short or too long, non-Indonesian are refused', () => {
  for (const s of ['0211234567', '08123', '0812345678901234', '+1 555 123 4567', '0812abc4567', '', '62 21 1234567', null, 12345])
    assert.strictEqual(R.normalizeWhatsapp(s), null, String(s));
});
check('W1 phone: 10 and 15 digit bounds', () => {
  assert.strictEqual(R.normalizeWhatsapp('0812345678'), '62812345678'); // 11 digits after normalize
  assert.strictEqual(R.normalizeWhatsapp('6281234567'), '6281234567'); // 10 digits
  assert.strictEqual(R.normalizeWhatsapp('628123456789012'), '628123456789012'); // 15 digits
  assert.strictEqual(R.normalizeWhatsapp('6281234567890123'), null); // 16 digits
});

check('W1 claim: a valid claim passes with cleaned text and the normalized number', () => {
  const r = vc({ name: '  Budi\u0007  Contoh ‮ ' });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.strictEqual(r.value.name, 'Budi Contoh');
  assert.strictEqual(r.value.whatsapp, '6281234567890');
  assert.strictEqual(r.value.productSlug, 'tail-bag-contoh');
  assert.strictEqual(r.value.productName, 'Tail bag (contoh)');
  assert.deepStrictEqual(r.value.damage, ['resleting', 'jahitan']);
  assert.strictEqual(r.value.videoViaWhatsApp, false);
});
check('W1 claim: required fields give their own Indonesian message', () => {
  const r = R.validateClaimInput({}, { now: NOW, productNames: PRODUCTS, folder: FOLDER });
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(Object.keys(r.errors).sort(), ['channel', 'consent', 'description', 'location', 'name', 'photos', 'product', 'usage', 'whatsapp'].sort());
  assert.strictEqual(r.errors.name, E.nameRequired);
  assert.strictEqual(r.errors.photos, E.photosRequired);
  assert.strictEqual(r.errors.consent, E.consentRequired);
});
check('W1 claim: name, location 2–80; description 20–2000 (characters, not bytes)', () => {
  assert.strictEqual(vc({ name: 'B' }).errors.name, E.nameLength);
  assert.strictEqual(vc({ name: 'x'.repeat(81) }).errors.name, E.nameLength);
  assert.ok(vc({ name: 'é'.repeat(80) }).ok);
  assert.strictEqual(vc({ location: 'x'.repeat(81) }).errors.location, E.locationLength);
  assert.strictEqual(vc({ description: 'terlalu pendek' }).errors.description, E.descriptionLength);
  assert.strictEqual(vc({ description: 'x'.repeat(2001) }).errors.description, E.descriptionLength);
  assert.ok(vc({ description: 'x'.repeat(2000) }).ok);
});
check('W1 claim: description keeps line breaks, drops control and bidi characters', () => {
  const r = vc({ description: 'Baris satu cukup panjang\r\n\r\n\r\n\r\nBaris dua\u0000 juga⁦ ada' });
  assert.ok(r.ok);
  assert.strictEqual(r.value.description, 'Baris satu cukup panjang\n\nBaris dua juga ada');
});
check('W1 claim: product must be an active slug or "lainnya" with a 2–80 name', () => {
  assert.strictEqual(vc({ product: 'produk-tidak-ada' }).errors.product, E.productUnknown);
  assert.strictEqual(vc({ product: '__proto__' }).errors.product, E.productUnknown);
  assert.strictEqual(vc({ product: '' }).errors.product, E.productRequired);
  assert.strictEqual(vc({ product: 'lainnya', productOther: 'X' }).errors.productOther, E.productOtherLength);
  const r = vc({ product: 'lainnya', productOther: ' Tas lama (contoh) ' });
  assert.ok(r.ok);
  assert.strictEqual(r.value.productSlug, null);
  assert.strictEqual(r.value.productName, 'Tas lama (contoh)');
});
check('W1 claim: channel and usage enums', () => {
  assert.strictEqual(vc({ channel: 'lazada' }).errors.channel, E.channelRequired);
  assert.strictEqual(vc({ usage: '2 bulan' }).errors.usage, E.usageRequired);
  for (const c of R.CHANNELS) assert.ok(vc({ channel: c }).ok, c);
  for (const u of R.USAGES) assert.ok(vc({ usage: u }).ok, u);
});
check('W1 claim: purchase date optional, real, not in the future (WIB), not before 2020-01-01', () => {
  assert.strictEqual(vc({ purchaseDate: '' }).value.purchaseDate, null);
  assert.strictEqual(vc({ purchaseDate: undefined }).value.purchaseDate, null);
  assert.strictEqual(vc({ purchaseDate: '2026-02-30' }).errors.purchaseDate, E.purchaseDateInvalid);
  assert.strictEqual(vc({ purchaseDate: '2026-11-12' }).errors.purchaseDate, E.purchaseDateFuture);
  assert.ok(vc({ purchaseDate: '2026-11-11' }).ok);
  assert.strictEqual(vc({ purchaseDate: '2019-12-31' }).errors.purchaseDate, E.purchaseDateTooOld);
  assert.ok(vc({ purchaseDate: '2020-01-01' }).ok);
  // 23:30 WIB on 11 Nov is still 11 Nov, although UTC already says 11 Nov 16:30.
  assert.ok(R.validateClaimInput(claim({ purchaseDate: '2026-11-11' }), { now: Date.UTC(2026, 10, 11, 16, 30), productNames: PRODUCTS, folder: FOLDER }).ok);
});
check('W1 claim: order number 3–40 of letters, digits, - _ /', () => {
  assert.strictEqual(vc({ orderRef: 'AB' }).errors.orderRef, E.orderRefInvalid);
  assert.strictEqual(vc({ orderRef: 'INV 2026' }).errors.orderRef, E.orderRefInvalid);
  assert.strictEqual(vc({ orderRef: 'x'.repeat(41) }).errors.orderRef, E.orderRefInvalid);
  assert.strictEqual(vc({ orderRef: '' }).value.orderRef, null);
  assert.strictEqual(vc({ orderRef: 'ORD-AB12_3/4' }).value.orderRef, 'ORD-AB12_3/4');
});
check('W1 claim: damage is a subset of the list, deduplicated, in list order', () => {
  assert.deepStrictEqual(vc({ damage: ['jahitan', 'resleting', 'jahitan'] }).value.damage, ['resleting', 'jahitan']);
  assert.strictEqual(vc({ damage: ['hilang'] }).errors.damage, E.damageInvalid);
  assert.strictEqual(vc({ damage: 'resleting' }).errors.damage, E.damageInvalid);
  assert.deepStrictEqual(vc({ damage: undefined }).value.damage, []);
});
check('W1 claim: photos 1–5, unique, in the environment folder, with a 20+ character random id', () => {
  assert.strictEqual(vc({ photos: [] }).errors.photos, E.photosRequired);
  const five = [1, 2, 3, 4, 5, 6].map(i => photo({ publicId: `${FOLDER}${'a'.repeat(20)}${i}` }));
  assert.ok(vc({ photos: five.slice(0, 5) }).ok);
  assert.strictEqual(vc({ photos: five }).errors.photos, E.photosTooMany);
  assert.strictEqual(vc({ photos: [photo(), photo()] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ publicId: 'garansi/Ab3dEf6hIj9kLm2nOp5qRs8t' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ publicId: 'produk/Ab3dEf6hIj9kLm2nOp5qRs8t' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ publicId: FOLDER + 'pendek' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ publicId: FOLDER + '../produk/Ab3dEf6hIj9kLm2nOp5qRs8t' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ format: 'heic' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [photo({ version: '1' })] }).errors.photos, E.photosInvalid);
  assert.strictEqual(vc({ photos: [{ ...photo(), url: 'https://evil.example/x.jpg' }] }).ok, true, 'extra keys are dropped, never stored');
  assert.strictEqual(vc({ photos: [{ ...photo(), url: 'x' }] }).value.photos[0].url, undefined);
});
check('W1 claim: consent must be exactly true; video flag boolean', () => {
  assert.strictEqual(vc({ consent: 'true' }).errors.consent, E.consentRequired);
  assert.strictEqual(vc({ videoViaWhatsApp: 'ya' }).ok, false);
  assert.strictEqual(vc({ videoViaWhatsApp: true }).value.videoViaWhatsApp, true);
});
check('W1/SEC-05 invisible characters (zero-width, LRM/RLM/ALM, BOM, word joiner, U+2028/2029) are removed', () => {
  const hidden = 'Bu\u200Bdi\u200D \u200EContoh\u200F\u061C\uFEFF\u2060';
  assert.strictEqual(R.cleanLine(hidden), 'Budi Contoh');
  assert.strictEqual(R.cleanLine('Kota\u2028Contoh'), 'Kota Contoh');
  assert.strictEqual(R.cleanText('Baris\u200B satu\u2028baris dua\uFEFF'), 'Baris satu\nbaris dua');
  assert.strictEqual(R.cleanText('Emoji tetap 👍 dan é tetap'), 'Emoji tetap 👍 dan é tetap');
});
check('W1 unknown keys are listed (route returns 400)', () => {
  assert.deepStrictEqual(R.unknownKeys(claim({ status: 'resolved', isAdmin: true }), R.CLAIM_KEYS), ['status', 'isAdmin']);
  assert.deepStrictEqual(R.unknownKeys(claim(), R.CLAIM_KEYS), []);
});

check('W1 HEIC refused before upload with the 2.3a message; JPG/PNG/WebP accepted', () => {
  assert.strictEqual(R.photoFileError({ type: 'image/heic', name: 'IMG_0001.HEIC', size: 1000 }), E.photoHeic);
  assert.strictEqual(R.photoFileError({ type: '', name: 'foto.heif', size: 1000 }), E.photoHeic);
  assert.strictEqual(R.photoFileError({ type: 'image/jpeg', name: 'IMG_0001.heic', size: 1000 }), E.photoHeic);
  assert.strictEqual(E.photoHeic, 'Foto format HEIC belum bisa diunggah. Ubah ke JPG, atau kirim fotonya lewat WhatsApp admin.');
  assert.strictEqual(R.photoFileError({ type: 'image/gif', name: 'a.gif', size: 1000 }), E.photoType);
  assert.strictEqual(R.photoFileError({ type: 'image/jpeg', name: 'a.jpg', size: 10 * 1024 * 1024 + 1 }), E.photoSize);
  for (const [t, n] of [['image/jpeg', 'a.jpg'], ['image/png', 'a.png'], ['image/webp', 'a.webp']]) assert.strictEqual(R.photoFileError({ type: t, name: n, size: 1000 }), null);
  assert.strictEqual(R.ACCEPTED_PHOTO_MIME, 'image/jpeg,image/png,image/webp');
  assert.strictEqual(R.isAcceptedPhotoType('image/heif', 'x.jpg'), false);
});

check('W1 outside period: more than 6 months before submission (WIB day), month-end clamped', () => {
  assert.strictEqual(R.isOutsidePeriod('2026-05-11', NOW), false); // exactly 6 months
  assert.strictEqual(R.isOutsidePeriod('2026-05-10', NOW), true);
  assert.strictEqual(R.isOutsidePeriod(null, NOW), false);
  assert.strictEqual(R.isOutsidePeriod('2026-08-31', Date.UTC(2027, 1, 28, 3)), false); // +6 months clamps to 28 Feb
  assert.strictEqual(R.isOutsidePeriod('2026-08-31', Date.UTC(2027, 2, 1, 3)), true);
});

check('W1 transitions: the matrix of 6.2 exactly', () => {
  const expected = {
    new: ['under_review', 'rejected'],
    under_review: ['in_progress', 'waiting_customer', 'resolved', 'rejected'],
    in_progress: ['waiting_customer', 'resolved'],
    waiting_customer: ['under_review', 'in_progress', 'rejected'],
    resolved: ['under_review'],
    rejected: ['under_review'],
  };
  for (const from of R.STATUSES)
    for (const to of R.STATUSES) assert.strictEqual(R.canTransition(from, to, 'admin'), expected[from].includes(to), `${from}->${to}`);
});
check('W1 transitions: reopen is admin only; produksi cannot reopen', () => {
  assert.strictEqual(R.canTransition('resolved', 'under_review', 'produksi'), false);
  assert.strictEqual(R.canTransition('under_review', 'resolved', 'produksi'), true);
  assert.deepStrictEqual(R.allowedNext('rejected', 'produksi'), []);
  assert.deepStrictEqual(R.allowedNext('rejected', 'admin'), ['under_review']);
});
check('W1 required fields per target status (6.3) and reopen note', () => {
  assert.deepStrictEqual(R.requiredFieldsFor('waiting_customer'), ['publicNote']);
  assert.deepStrictEqual(R.requiredFieldsFor('rejected'), ['rejectReason', 'publicNote']);
  assert.deepStrictEqual(R.requiredFieldsFor('resolved'), ['resolution', 'publicNote']);
  assert.deepStrictEqual(R.requiredFieldsFor('under_review', 'resolved'), ['note']);
  assert.deepStrictEqual(R.requiredFieldsFor('under_review', 'new'), []);
  assert.deepStrictEqual(R.requiredFieldsFor('in_progress'), []);
});
check('W1 feedback transitions: forward moves and archived → read only', () => {
  const S = R.FEEDBACK_STATUSES;
  for (const a of S) for (const b of S) {
    const exp = S.indexOf(b) > S.indexOf(a) || (a === 'archived' && b === 'read');
    assert.strictEqual(R.canTransitionFeedback(a, b), exp, `${a}->${b}`);
  }
  assert.strictEqual(R.canTransitionFeedback('new', 'nope'), false);
});

check('W1 staff list: uid:role pairs, malformed and unknown roles ignored', () => {
  const m = R.parseStaffList(' uidA:admin, uidB:produksi ,uidC:owner, :admin, uidD, uidE:admin:x , ui d:admin');
  assert.deepStrictEqual([...m.entries()], [['uidA', 'admin'], ['uidB', 'produksi']]);
  assert.strictEqual(R.parseStaffList(undefined).size, 0);
});
check('W1 origins: exact match only, trailing slash on the env entry ignored', () => {
  const env = 'https://dashboard.inzta.id/, http://localhost:3000';
  assert.strictEqual(R.isAllowedOrigin('https://dashboard.inzta.id', env), true);
  assert.strictEqual(R.isAllowedOrigin('http://localhost:3000', env), true);
  for (const o of ['https://dashboard.inzta.id.evil.example', 'http://dashboard.inzta.id', 'https://evil.example', 'null', '', null, undefined])
    assert.strictEqual(R.isAllowedOrigin(o, env), false, String(o));
  assert.strictEqual(R.isAllowedOrigin('https://dashboard.inzta.id', ''), false);
});

check('W1 ticket: GRN-/MSK- + 6 characters from the alphabet without 0 O 1 I', () => {
  assert.strictEqual(R.TICKET_ALPHABET.length, 32);
  assert.ok(!/[0O1I]/.test(R.TICKET_ALPHABET));
  for (let i = 0; i < 500; i++) {
    const t = R.generateTicket(crypto.randomBytes(6));
    assert.ok(R.TICKET_RE.test(t), t);
  }
  assert.ok(R.FEEDBACK_REF_RE.test(R.generateTicket(crypto.randomBytes(6), 'MSK')));
  assert.strictEqual(R.generateTicket(Uint8Array.from([0, 31, 32, 255, 8, 9])), 'GRN-A9A9JK');
  assert.throws(() => R.generateTicket(new Uint8Array(3)));
});

check('W1 WhatsApp templates per status with ticket, name, and note; none for new', () => {
  const v = { ticket: 'GRN-ABCDEF', name: 'Budi Contoh', publicNote: 'foto label produk.' };
  assert.strictEqual(R.whatsappTemplate('waiting_customer', v), 'Halo Budi Contoh, untuk klaim GRN-ABCDEF kami butuh: foto label produk. Bisa dibalas di chat ini. Terima kasih.');
  assert.ok(R.whatsappTemplate('under_review', v).includes('GRN-ABCDEF'));
  assert.ok(R.whatsappTemplate('resolved', v).includes('foto label produk'));
  assert.ok(R.whatsappTemplate('rejected', v).startsWith('Halo Budi Contoh, mohon maaf'));
  assert.strictEqual(R.whatsappTemplate('in_progress', { ...v, publicNote: '' }), 'Halo Budi Contoh, klaim GRN-ABCDEF sedang ditangani tim produksi INZTA.');
  assert.strictEqual(R.whatsappTemplate('new', v), null);
  assert.strictEqual(R.waLink('6281234567890', 'a b&c'), 'https://wa.me/6281234567890?text=a%20b%26c');
});
check('W1 labels: English for staff, Indonesian for the customer', () => {
  assert.strictEqual(R.statusLabel('waiting_customer'), 'Waiting Customer');
  assert.strictEqual(R.statusLabel('new', 'customer'), 'Diterima');
  assert.strictEqual(R.FEEDBACK_STATUS_LABELS.followed_up, 'Ditindaklanjuti');
});

check('W1 feedback: kind chips, 20–1000 message, optional product/name/number', () => {
  const ok = R.validateFeedbackInput({ kind: 'saran', message: 'Tolong tambah warna hijau army untuk tail bag.', consent: true }, { productNames: PRODUCTS });
  assert.ok(ok.ok);
  assert.deepStrictEqual(ok.value, { kind: 'saran', message: 'Tolong tambah warna hijau army untuk tail bag.', productSlug: null, productName: null, name: null, whatsapp: null });
  const bad = R.validateFeedbackInput({ kind: 'pujian', message: 'pendek', name: 'X', whatsapp: '021', product: 'nope', consent: false }, { productNames: PRODUCTS });
  assert.deepStrictEqual(Object.keys(bad.errors).sort(), ['consent', 'kind', 'message', 'name', 'product', 'whatsapp']);
  const full = R.validateFeedbackInput({ kind: 'kritik', message: 'x'.repeat(1000), product: 'tank-bag-contoh', name: 'Sari Contoh', whatsapp: '+62 812 1111 2222', consent: true }, { productNames: PRODUCTS });
  assert.ok(full.ok);
  assert.strictEqual(full.value.whatsapp, '6281211112222');
  assert.strictEqual(full.value.productName, 'Tank bag (contoh)');
  assert.strictEqual(R.validateFeedbackInput({ kind: 'kritik', message: 'x'.repeat(1001), consent: true }, { productNames: PRODUCTS }).errors.message, E.messageLength);
  assert.ok(R.validateFeedbackInput({ kind: 'kritik', message: 'x'.repeat(30), product: 'lainnya', productOther: 'Jas hujan (contoh)', consent: true }, { productNames: PRODUCTS }).ok);
});

check('W1 rate buckets use the WIB wall clock', () => {
  assert.deepStrictEqual(R.rateBuckets(Date.UTC(2026, 10, 11, 17, 5)), { hour: '2026111200', day: '20261112' });
});

check('W1 copy: no absolute promises in buyer-facing text (8.2)', () => {
  const text = JSON.stringify(WARRANTY_COPY, (k, v) => (typeof v === 'function' ? v.toString() : v)).toLowerCase();
  for (const w of ['gratis', '100%', 'dijamin', 'pasti diganti', 'selamanya', 'terbaik']) assert.ok(!text.includes(w), w);
  assert.ok(text.includes('garansi 6 bulan'));
});

// Cloudinary signing (W2): the documented algorithm, SHA-1 over sorted parameters + secret, Node crypto only.
check('W2 upload signature: sorted k=v pairs joined by &, secret appended, SHA-1 hex', () => {
  const params = { timestamp: 1315060510, public_id: 'sample_image', eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop' };
  assert.strictEqual(CL.signatureString(params), 'eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510');
  // Example from the Cloudinary "Generating authentication signatures" guide (secret abcd).
  assert.strictEqual(CL.signParams(params, 'abcd'), 'bfd09f95f331f558cbd1320e67aa8d488770583e');
  assert.strictEqual(CL.signatureString({ a: '', b: undefined, c: null, d: 'x' }), 'd=x');
});
check('W2 upload params: folder in the public id, random 24-character id, authenticated, no overwrite, jpg/png/webp only', () => {
  const p = CL.buildUploadParams({ folder: FOLDER, now: NOW, randomId: 'Ab3dEf6hIj9kLm2nOp5qRs8t' });
  assert.deepStrictEqual(p, { allowed_formats: 'jpg,png,webp', overwrite: 'false', public_id: FOLDER + 'Ab3dEf6hIj9kLm2nOp5qRs8t', timestamp: Math.floor(NOW / 1000), transformation: 'c_limit,h_1920,w_1920', type: 'authenticated' });
  assert.ok(!('tags' in p), 'no tag until A-147');
  assert.ok(!('upload_preset' in p));
  assert.strictEqual(CL.randomPublicId(Buffer.alloc(18, 255)).length, 24);
  assert.ok(/^[A-Za-z0-9_-]{24}$/.test(CL.randomPublicId(crypto.randomBytes(18))));
});
check('W2 delivery URL: s--<8 chars>-- over "<transformation>/<public_id>.<format>", URL-safe base64', () => {
  const ph = photo();
  const url = CL.signedDeliveryUrl({ cloud: 'democloud', secret: 'abcd', photo: ph, transformation: 'c_limit,w_400' });
  const toSign = `c_limit,w_400/${ph.publicId}.${ph.format}`;
  const sig = crypto.createHash('sha1').update(toSign + 'abcd').digest('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 8);
  assert.strictEqual(url, `https://res.cloudinary.com/democloud/image/authenticated/s--${sig}--/c_limit,w_400/v${ph.version}/${ph.publicId}.${ph.format}`);
});
check('W2 private download URL expires and is signed like an API call', () => {
  const ph = photo();
  const u = new URL(CL.privateDownloadUrl({ cloud: 'democloud', apiKey: 'k123', secret: 'abcd', photo: ph, now: NOW, ttlSeconds: 3600 }));
  assert.strictEqual(u.origin + u.pathname, 'https://api.cloudinary.com/v1_1/democloud/image/download');
  const q = Object.fromEntries(u.searchParams);
  assert.strictEqual(q.type, 'authenticated');
  assert.strictEqual(Number(q.expires_at), Math.floor(NOW / 1000) + 3600);
  const { api_key, signature, ...signed } = q;
  assert.strictEqual(api_key, 'k123');
  assert.strictEqual(signature, CL.signParams(signed, 'abcd'));
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const [s, n] of results) console.log(`${s}  ${n}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
