// F-016 tasks B5 and B8: pure rules of the per-category page (S5.1.3, S5.2.2, S5.3.1, S5.4.1, S5.5, S5.6.1-S5.6.3,
// S5.8.3-S5.8.5, S5.9.3) and the Tentang contact number (S8.6.1). Same harness as tests/f016-v2-data.cjs.
// Usage: npm run test:motor  (or: node tests/f016-motor.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

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
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const P = require(path.join(ROOT, 'components/v2/motor/motor-page.ts'));
const M = require(path.join(ROOT, 'lib/v2/motor-category.ts'));
const H = require(path.join(ROOT, 'lib/v2/home-data.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const ALL = ['matic', 'adventure', 'retro', 'trail'];
let t = 1000;
const prod = (slug, name, kategoriMotor, extra = {}) => ({ productType: 'simple', slug, name, price: 100000, images: [`https://res.cloudinary.com/dukddlp0b/image/upload/v1/${slug}.jpg`], isActive: true, kategoriMotor, createdAt: t++, ...extra });
const art = (slug, extra = {}) => ({ slug, title: slug, excerpt: '', content: '', contentFormat: 'markdown', status: 'published', createdAt: null, updatedAt: null, publishedAt: null, ...extra });

const xsr = prod('side-bag-inzta-xsr-155', 'Side bag Inzta XSR 155', ['retro']);
const scram = prod('side-bag-inzta-xsr-srcrambag', 'Side bag Inzta XSR Srcrambag', ['retro'], { badge: 'BEST SELLER' });
const tk5 = prod('tankbag-tk-5', 'Tankbag TK 5', ['retro', 'retro', 'nope']);
const adv20 = prod('sidebag-inzta-adventure-20l-tas-touring-motor', 'Sidebag inzta Adventure 20L, tas touring motor', ['adventure']);
const uni = (i) => prod(`uni-${i}`, `Side bag universal ${i}`, ALL, i === 3 ? { badge: 'Best seller' } : {});
const unis = [uni(1), uni(2), uni(3), uni(4)];

check('S5.3.1: best sellers first, then newest', () => {
  const sorted = P.sortForCategory([xsr, scram, tk5]);
  assert.deepStrictEqual(sorted.map(p => p.slug), ['side-bag-inzta-xsr-srcrambag', 'tankbag-tk-5', 'side-bag-inzta-xsr-155']);
});

check('S5.3/S5.5: category list excludes universal products; universal capped at 3 with best seller first', () => {
  const data = P.buildCategoryPage('retro', [xsr, scram, tk5, ...unis], []);
  assert.deepStrictEqual(data.cards.map(c => c.slug).sort(), ['side-bag-inzta-xsr-155', 'side-bag-inzta-xsr-srcrambag', 'tankbag-tk-5']);
  assert.deepStrictEqual(data.universal.map(c => c.slug), ['uni-3', 'uni-4', 'uni-2']);
});

check('S5.3.3/S5.5.1: fit labels come from the name only; universal tagging gives no universal chip', () => {
  const data = P.buildCategoryPage('retro', [xsr, tk5, ...unis], []);
  assert.deepStrictEqual(data.cards.find(c => c.slug === xsr.slug).fit, { kind: 'model', text: 'Dibuat untuk Yamaha XSR 155' });
  assert.strictEqual(data.cards.find(c => c.slug === tk5.slug).fit, null);
  assert.ok(data.universal.every(c => c.fit === null));
});

check('S5.1.3: Retro lead needs side, tank, XSR 155, and a 20L side bag among S5.3 + S5.5', () => {
  const withAll = [xsr, tk5, { ...adv20, kategoriMotor: ['retro'] }];
  assert.ok(P.approvedLead('retro', withAll, []));
  assert.strictEqual(P.approvedLead('retro', [xsr, tk5], []), null, 'no 20L');
  assert.strictEqual(P.approvedLead('retro', [xsr, adv20], []), null, 'no tank');
  assert.strictEqual(P.approvedLead('retro', [tk5, adv20], []), null, 'no XSR 155');
  assert.ok(P.approvedLead('retro', [xsr, tk5], [adv20]), 'universal products count');
});

check('S5.1.1: categories without an approved line show P-17 and the meta fallback', () => {
  for (const c of ['matic', 'adventure', 'trail']) assert.strictEqual(P.approvedLead(c, [xsr, tk5, adv20], []), null);
  assert.strictEqual(P.fallbackLead('Trail'), 'Tas INZTA untuk motor Trail. Ragu soal ukuran? Tanyakan ke admin lewat WhatsApp.');
  assert.strictEqual(P.categoryDescription('matic', null), 'Tas INZTA untuk motor Matic.');
  assert.strictEqual(P.categoryTitle('retro'), 'Tas untuk motor Retro'); // F-005 6.2: the layout template adds the brand
});

check('S5.2.2: tablist only with two or more of Side/Tank/Tail; "Semua" first', () => {
  assert.deepStrictEqual(P.categoryTabs([xsr, scram]), []);
  assert.deepStrictEqual(P.categoryTabs([xsr, tk5]).map(x => x.key), ['semua', 'side', 'tank']);
  const botol = prod('botol-bag-inzta-xmax', 'Botol bag Inzta Xmax', ['matic']);
  assert.deepStrictEqual(P.categoryTabs([xsr, botol]), [], 'aksesori is not a tab');
  const wander = prod('tankbag-and-tailbag-wanderpack-10l', 'Tankbag and Tailbag wanderpack 10L', ['retro']);
  assert.deepStrictEqual(P.categoryTabs([wander]).map(x => x.key), ['semua', 'tank', 'tail'], 'two-position product counts for both');
});

check('S5.2.3: card positions are per grid index and include the second position', () => {
  const wander = prod('tankbag-and-tailbag-wanderpack-10l', 'Tankbag and Tailbag wanderpack 10L', ['retro']);
  const data = P.buildCategoryPage('retro', [xsr, wander], []);
  const i = data.cards.findIndex(c => c.slug === wander.slug);
  assert.deepStrictEqual(data.cardPositions[i], ['tank', 'tail']);
  assert.strictEqual(data.cards.length, data.cardPositions.length);
});

check('S5.3.2: empty category has no tabs and no notice', () => {
  const data = P.buildCategoryPage('trail', [xsr, ...unis], []);
  assert.deepStrictEqual([data.cards.length, data.tabs.length, data.showInstallNotice], [0, 0, false]);
  assert.strictEqual(data.universal.length, 3);
});

check('S5.4.1: install notice only on Retro with an XSR 155 product', () => {
  assert.strictEqual(P.buildCategoryPage('retro', [xsr], []).showInstallNotice, true);
  assert.strictEqual(P.buildCategoryPage('retro', [scram, tk5], []).showInstallNotice, false);
  assert.strictEqual(P.buildCategoryPage('matic', [{ ...xsr, kategoriMotor: ['matic'] }], []).showInstallNotice, false);
});

check('S5.8.4/S5.8.5: not indexable while the allowlist is empty, even with products and an approved lead', () => {
  assert.deepStrictEqual(M.INDEXABLE_CATEGORIES, []);
  const full = [xsr, tk5, { ...adv20, kategoriMotor: ['retro'] }];
  assert.ok(P.approvedLead('retro', full, []));
  for (const c of ALL) assert.strictEqual(P.categoryIndexable(c, full), false);
  assert.strictEqual(M.isCategoryIndexable('retro', full, true), false, 'not allowlisted');
});

check('S5.9.3: prefilled WhatsApp text is URL-encoded', () => {
  assert.strictEqual(P.consultHref('retro', '6289513482410'), 'https://wa.me/6289513482410?text=' + encodeURIComponent('Halo INZTA, saya ingin konsultasi tas untuk motor Retro saya'));
});

check('S5.6: newest per-motor article of the category; other topics and categories ignored', () => {
  const list = [
    art('a-old', { topik: 'per-motor', kategoriMotor: ['retro'], publishedAt: 1 }),
    art('a-new', { topik: 'per-motor', kategoriMotor: ['matic', 'retro'], publishedAt: 5 }),
    art('a-touring', { topik: 'touring', kategoriMotor: ['retro'], publishedAt: 9 }),
    art('a-matic', { topik: 'per-motor', kategoriMotor: ['matic'], publishedAt: 9 }),
  ];
  assert.strictEqual(P.pickCategoryArticle(list, 'retro').slug, 'a-new');
  assert.strictEqual(P.pickCategoryArticle(list, 'trail'), null, 'S5.6.3 no article');
});

check('S5.6.1: first three ## headings outside fences, inline Markdown reduced', () => {
  const content = [
    '# H1', '## Pilih **posisi** dulu', '```', '## inside code', '```', '### Sub', '## [Versi tali](/x) vs `baut` ##',
    '~~~~', '## also code', '~~~', '## still code', '~~~~', '##NoSpace', '## Ketiga _miring_ {#id}', '## Keempat',
  ].join('\n');
  assert.deepStrictEqual(P.articleH2s({ content, contentFormat: 'markdown' }), ['Pilih posisi dulu', 'Versi tali vs baut', 'Ketiga miring']);
  assert.deepStrictEqual(P.articleH2s({ content, contentFormat: 'plain' }), [], 'legacy plain');
  assert.deepStrictEqual(P.articleH2s({ content: 'Teks tanpa judul', contentFormat: 'markdown' }), []);
  assert.deepStrictEqual(P.articleH2s({ content: '## Satu\r\nteks\r\n## Dua\r\n', contentFormat: 'markdown' }), ['Satu', 'Dua'], 'CRLF');
});

check('S5.6.2: thumbs follow first appearance, skip duplicates/missing/inactive/photo-less, max 4', () => {
  const noPhoto = prod('no-photo', 'No photo', [], { images: [], imageUrl: '' });
  const inactive = prod('inactive', 'Inactive', [], { isActive: false });
  const content = ['[[produk:tankbag-tk-5]]', '', '[[produk:tankbag-tk-5]]', '', '[[produk:missing]]', '', '[[produk:no-photo]]', '', '[[produk:inactive]]', '',
    '[[artikel:x]]', '', '[[produk:side-bag-inzta-xsr-155]]', '', '[[produk:side-bag-inzta-xsr-srcrambag]]', '', '[[produk:uni-1]]', '', '[[produk:uni-2]]'].join('\n');
  const thumbs = P.articleThumbs(content, [xsr, scram, tk5, noPhoto, inactive, ...unis]);
  assert.deepStrictEqual(thumbs.map(x => x.slug), ['tankbag-tk-5', 'side-bag-inzta-xsr-155', 'side-bag-inzta-xsr-srcrambag', 'uni-1']);
  assert.strictEqual(thumbs[0].name, 'Tankbag TK 5');
});

check('S5.6: meta date and cover host rule', () => {
  const a = art('a', { topik: 'per-motor', kategoriMotor: ['retro'], publishedAt: Date.UTC(2026, 9, 24, 3), coverImage: 'https://example.com/x.jpg' });
  const d = P.buildCategoryPage('retro', [xsr], [a]).article;
  assert.strictEqual(d.meta, 'Tim INZTA · 24 Oktober 2026');
  assert.strictEqual(d.cover, null, 'foreign host is not used');
  const undated = P.buildCategoryPage('retro', [xsr], [art('b', { topik: 'per-motor', kategoriMotor: ['retro'] })]).article;
  assert.strictEqual(undated.meta, 'Tim INZTA');
});

check('S8.6.1: WhatsApp number formatted from WA_NUMBER (two values)', () => {
  assert.strictEqual(H.formatWaDisplay('6289513482410'), '+62 895-1348-2410');
  assert.strictEqual(H.formatWaDisplay('6283804058329'), '+62 838-0405-8329');
});

let failed = 0;
for (const [s, n] of results) {
  if (s === 'FAIL') failed++;
  console.log(`${s}  ${n}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
