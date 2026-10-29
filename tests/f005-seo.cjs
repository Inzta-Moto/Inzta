// F-005 phase 1: canonical URLs, the JSON-LD serializer, the Article item, and source guards.
// Loads the real TS modules like tests/f001-content.cjs (in-memory Firestore for the sitemap, no network).
// Usage: npm run test:seo  (or: node tests/f005-seo.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const docs = new Map();
const snapshotOf = (col, filter) => {
  const entries = [...docs.entries()]
    .filter(([k]) => k.startsWith(col + '/'))
    .map(([k, v]) => ({ id: k.slice(col.length + 1), data: () => v }))
    .filter(d => !filter || filter(d.data()));
  return { docs: entries, empty: entries.length === 0 };
};
const fakeDb = {
  collection: (col) => ({
    get: async () => snapshotOf(col),
    where: (field, op, value) => ({ get: async () => snapshotOf(col, d => d[field] === value) }),
  }),
};
const stubs = {
  react: { cache: (fn) => fn },
  [path.join(ROOT, 'lib/firebaseAdmin')]: { getAdminDb: () => fakeDb, hasAdminCredentials: () => true },
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
  return stubs[resolved] || origLoad.call(this, request, parent, isMain);
};
require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

process.env.NEXT_PUBLIC_SITE_URL = 'https://inzta-git-preview.vercel.app'; // requirement 1.3: must not leak into canonicals
const seo = require(path.join(ROOT, 'lib/seo.ts'));
const { publicDate } = require(path.join(ROOT, 'lib/article-format.ts'));

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const IMG = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/sampul.jpg';
const BODY_IMG = 'https://res.cloudinary.com/dukddlp0b/image/upload/v1/isi.jpg';
const T1 = Date.parse('2026-10-28T08:38:14.262Z');
const T2 = Date.parse('2026-10-29T01:00:00.000Z');
const md = (over) => ({
  title: 'Gasber 16: Matic sampai Bigbike', slug: 'gasber-16', excerpt: 'Sub', content: 'Paragraf.', contentFormat: 'markdown',
  coverImage: IMG, showCover: true, author: 'Tim INZTA', createdAt: T1, publishedAt: T1, updatedAt: T2, ...over,
});
const plain = (over) => ({ title: 'Artikel lama', slug: 'artikel-lama', excerpt: 'x', content: 'Teks polos.', createdAt: T1, publishedAt: null, updatedAt: null, ...over });
const CONTROL = /[<>&\u2028\u2029]/;

(async () => {
  // --- canonicalUrl (1.2–1.4, 1.8) ---
  await check('canonicalUrl: root, sections, slug', () => {
    assert.strictEqual(seo.canonicalUrl(), 'https://inzta.id/');
    assert.strictEqual(seo.canonicalUrl('blog'), 'https://inzta.id/blog');
    assert.strictEqual(seo.canonicalUrl('produk'), 'https://inzta.id/produk');
    assert.strictEqual(seo.canonicalUrl('blog', 'gasber-16-indonesia-ride-adventure'), 'https://inzta.id/blog/gasber-16-indonesia-ride-adventure');
  });
  await check('canonicalUrl: ? # space / are encoded, empty segments dropped, never a query or fragment', () => {
    const u = seo.canonicalUrl('produk', 'a?aff=x#y z/w');
    assert.strictEqual(u, 'https://inzta.id/produk/a%3Faff%3Dx%23y%20z%2Fw');
    assert.ok(!u.includes('?') && !u.includes('#'));
    assert.strictEqual(seo.canonicalUrl('', 'blog', ''), 'https://inzta.id/blog');
  });
  await check('canonicalUrl ignores NEXT_PUBLIC_SITE_URL (Preview host)', () => {
    assert.ok(seo.canonicalUrl('blog').startsWith('https://inzta.id/'));
  });

  // --- serializeJsonLd (3.1–3.3) ---
  const nasty = { title: '</script><script>alert(1)</script><!-- x -->', amp: 'A &amp; B', emoji: 'Motor 🏍️ Banten–Bogor', sep: 'a\u2028b\u2029c' };
  await check('serializeJsonLd: no < > & U+2028 U+2029 in output', () => {
    assert.ok(!CONTROL.test(seo.serializeJsonLd(nasty)));
  });
  await check('serializeJsonLd: JSON.parse round-trips', () => {
    assert.deepStrictEqual(JSON.parse(seo.serializeJsonLd(nasty)), nasty);
  });
  await check('serializeJsonLd: wrapped in a script tag, exactly one </script>', () => {
    const html = `<script type="application/ld+json">${seo.serializeJsonLd(nasty)}</script>`;
    assert.strictEqual(html.split('</script>').length - 1, 1);
    assert.ok(!html.includes('<!--'));
  });

  // --- articleJsonLd fixtures (2.2–2.9) ---
  await check('Markdown with cover: full item', () => {
    const a = md();
    assert.deepStrictEqual(seo.articleJsonLd(a), {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': 'https://inzta.id/blog/gasber-16#article',
      mainEntityOfPage: 'https://inzta.id/blog/gasber-16',
      headline: a.title,
      image: [IMG],
      datePublished: '2026-10-28T08:38:14.262Z',
      dateModified: '2026-10-29T01:00:00.000Z',
      author: { '@type': 'Person', name: 'Tim INZTA' },
      publisher: seo.ORGANIZATION,
    });
  });
  await check('publisher is INZTA Moto with logo-inzta.png (Q-2)', () => {
    assert.deepStrictEqual(seo.ORGANIZATION, {
      '@type': 'Organization', '@id': 'https://inzta.id/#organization', name: 'INZTA Moto', url: 'https://inzta.id/',
      logo: { '@type': 'ImageObject', url: 'https://inzta.id/logo-inzta.png' },
    });
  });
  await check('showCover:false + allowed body image -> body image (Q-4)', () => {
    const a = md({ showCover: false, content: `Teks\n\n![foto](https://example.com/luar.jpg)\n\n![isi](${BODY_IMG})` });
    assert.deepStrictEqual(seo.articleJsonLd(a).image, [BODY_IMG]);
  });
  await check('showCover:false + no allowed body image -> cover (Q-4)', () => {
    assert.deepStrictEqual(seo.articleJsonLd(md({ showCover: false })).image, [IMG]);
  });
  await check('Markdown with no allowed image -> no image key', () => {
    assert.ok(!('image' in seo.articleJsonLd(md({ coverImage: '', content: '![x](https://example.com/a.jpg)' }))));
    assert.ok(!('image' in seo.articleJsonLd(md({ coverImage: 'https://example.com/a.jpg' }))));
  });
  await check('Plain legacy: images[0], datePublished = createdAt, no author', () => {
    const j = seo.articleJsonLd(plain({ images: ['https://res.cloudinary.com/x/a.jpg', 'https://b'] }));
    assert.deepStrictEqual(j.image, ['https://res.cloudinary.com/x/a.jpg']);
    assert.strictEqual(j.datePublished, new Date(T1).toISOString());
    assert.strictEqual(j.dateModified, j.datePublished);
    assert.ok(!('author' in j));
  });
  await check('Plain: imageUrl fallback, non-https image dropped', () => {
    assert.deepStrictEqual(seo.articleJsonLd(plain({ imageUrl: 'https://cdn/x.jpg' })).image, ['https://cdn/x.jpg']);
    assert.ok(!('image' in seo.articleJsonLd(plain({ images: ['/lokal.jpg'] }))));
  });
  await check('Plain with no date: no date keys', () => {
    const j = seo.articleJsonLd(plain({ createdAt: null }));
    assert.ok(!('datePublished' in j) && !('dateModified' in j));
  });
  await check('Author: empty -> Tim INZTA, other name -> Person (Q-3)', () => {
    assert.deepStrictEqual(seo.articleJsonLd(md({ author: '  ' })).author, { '@type': 'Person', name: 'Tim INZTA' });
    assert.deepStrictEqual(seo.articleJsonLd(md({ author: undefined })).author, { '@type': 'Person', name: 'Tim INZTA' });
    assert.deepStrictEqual(seo.articleJsonLd(md({ author: ' Raja Purnama ' })).author, { '@type': 'Person', name: 'Raja Purnama' });
  });
  await check('updatedAt before publishedAt -> dateModified = datePublished', () => {
    const j = seo.articleJsonLd(md({ updatedAt: T1 - 1000 }));
    assert.strictEqual(j.dateModified, j.datePublished);
    assert.strictEqual(seo.articleJsonLd(md({ updatedAt: null })).dateModified, j.datePublished);
  });
  await check('headline = title, datePublished = ArticleHead <time dateTime>', () => {
    const a = md({ publishedAt: T2, createdAt: T1 });
    const j = seo.articleJsonLd(a);
    assert.strictEqual(j.headline, a.title);
    assert.strictEqual(j.datePublished, new Date(publicDate(a)).toISOString());
  });
  await check('No empty values and no rating/FAQ/HowTo/SearchAction anywhere', () => {
    for (const a of [md(), md({ showCover: false, coverImage: '' }), plain(), plain({ createdAt: null })]) {
      const j = seo.articleJsonLd(a);
      for (const [k, v] of Object.entries(j)) assert.ok(v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length), k);
      assert.ok(!('description' in j));
      assert.ok(!/aggregateRating|review|FAQPage|HowTo|SearchAction/i.test(seo.serializeJsonLd(j)));
    }
  });
  await check('Title with </script> stays intact through the Article item', () => {
    const a = md({ title: 'Uji </script><!-- & > judul' });
    const out = seo.serializeJsonLd(seo.articleJsonLd(a));
    assert.ok(!CONTROL.test(out));
    assert.strictEqual(JSON.parse(out).headline, a.title);
  });

  // --- Source guards (1.5, 1.6, 2.10, 3.1) ---
  const appFiles = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) appFiles.push(p);
  });
  walk(path.join(ROOT, 'app'));
  const read = (p) => fs.readFileSync(p, 'utf8');
  await check('app/layout.tsx sets no canonical', () => {
    assert.ok(!/canonical/i.test(read(path.join(ROOT, 'app/layout.tsx'))));
  });
  await check('/admin/pratinjau renders no JSON-LD', () => {
    const src = read(path.join(ROOT, 'app/admin/pratinjau/[slug]/page.tsx'));
    assert.ok(!/JsonLd|articleJsonLd|canonical/.test(src));
  });
  await check('No file under app/ writes application/ld+json except via components/JsonLd.tsx', () => {
    const bad = appFiles.filter(f => read(f).includes('application/ld+json')).map(f => path.relative(ROOT, f));
    assert.deepStrictEqual(bad, []);
  });
  await check('Every canonical under app/ comes from canonicalUrl()', () => {
    const bad = appFiles.filter(f => /alternates\s*:|rel=["']canonical/.test(read(f)) && !read(f).includes('canonicalUrl(')).map(f => path.relative(ROOT, f));
    assert.deepStrictEqual(bad, []);
  });

  // --- Sitemap <loc> = canonical (1.7) ---
  await check('Every sitemap url equals the canonical of its page', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    docs.clear();
    docs.set('articles/gasber-16', { title: 'G', slug: 'gasber-16', excerpt: '', content: '', status: 'published', createdAt: '2026-10-28T00:00:00.000Z' });
    docs.set('articles/draf', { title: 'D', slug: 'draf', excerpt: '', content: '', status: 'draft' });
    docs.set('products/tas-aktif', { name: 'Tas', isActive: true, price: 1, stock: 1 });
    const sitemap = require(path.join(ROOT, 'app/sitemap.ts')).default;
    const urls = (await sitemap()).map(e => e.url);
    const expected = [seo.canonicalUrl(), seo.canonicalUrl('produk'), seo.canonicalUrl('blog'), seo.canonicalUrl('tentang') /* F-016 S8.7.3 */, seo.canonicalUrl('produk', 'tas-aktif'), seo.canonicalUrl('blog', 'gasber-16')];
    const strip = (u) => u.replace(/\/$/, '');
    assert.deepStrictEqual(urls.map(strip), expected.map(strip));
  });

  for (const [s, n] of results) console.log(`${s}  ${n}`);
  const failed = results.filter(([s]) => s === 'FAIL').length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
