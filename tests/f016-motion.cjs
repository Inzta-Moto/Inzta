// F-016 C5: pure helpers of the site motion (lib/v2/motion/links.ts, lib/v2/motion/boot.ts) and the v2 image URLs
// (lib/v2/image.ts). Usage: npm run test:motion  (or: node tests/f016-motion.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  else if (request.startsWith('.') && parent && parent.filename) request = path.resolve(path.dirname(parent.filename), request);
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

const L = require(path.join(ROOT, 'lib/v2/motion/links.ts'));
const B = require(path.join(ROOT, 'lib/v2/motion/boot.ts'));
const I = require(path.join(ROOT, 'lib/v2/image.ts'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}\n  ${e.message}`);
  }
}

const here = new URL('https://inzta.id/');
const click = over => ({ href: '/produk', target: null, download: false, button: 0, modified: false, optOut: false, defaultPrevented: false, ...over });
const target = (over, current = here) => {
  const url = L.transitionTarget(click(over), current);
  return url && url.pathname + url.search + url.hash;
};

test('a plain internal link to another page travels behind the curtain', () => {
  assert.strictEqual(target({}), '/produk');
  assert.strictEqual(target({ href: '/tas-motor/matic?x=1#produk' }), '/tas-motor/matic?x=1#produk');
  assert.strictEqual(target({ href: 'https://inzta.id/blog' }), '/blog');
});

test('new tabs, modified or non-primary clicks, downloads and opt-outs are left to the browser', () => {
  assert.strictEqual(target({ target: '_blank' }), null);
  assert.strictEqual(target({ modified: true }), null);
  assert.strictEqual(target({ button: 1 }), null);
  assert.strictEqual(target({ download: true }), null);
  assert.strictEqual(target({ optOut: true }), null);
  assert.strictEqual(target({ defaultPrevented: true }), null);
  assert.strictEqual(target({ target: '_self' }), '/produk');
});

test('hash-only, same-pathname, external, admin and non-http links never cover the page', () => {
  assert.strictEqual(target({ href: '#garasi' }), null);
  assert.strictEqual(target({ href: '/?posisi=side' }), null);
  assert.strictEqual(target({ href: '/produk?posisi=side' }, new URL('https://inzta.id/produk')), null);
  assert.strictEqual(target({ href: 'https://wa.me/628123' }), null);
  assert.strictEqual(target({ href: '/admin/produk' }), null);
  assert.strictEqual(target({ href: '/affiliate' }), null);
  assert.strictEqual(target({ href: 'mailto:hi@inzta.id' }), null);
  assert.strictEqual(target({ href: null }), null);
  assert.strictEqual(target({ href: 'http://[bad' }), null);
});

test('route labels name the destination', () => {
  assert.strictEqual(L.routeLabel('/'), 'Beranda');
  assert.strictEqual(L.routeLabel('/produk'), 'Semua tas');
  assert.strictEqual(L.routeLabel('/produk/tail-bag-inzta-tourmax-30'), 'Detail produk');
  assert.strictEqual(L.routeLabel('/blog/gasber-16'), 'Artikel');
  assert.strictEqual(L.routeLabel('/tentang'), 'Tentang INZTA');
  assert.strictEqual(L.routeLabel('/tas-motor/retro'), 'Motor Retro');
  assert.strictEqual(L.routeLabel('/tas-motor/unknown'), 'Pilih motor');
});

test('the boot script and isMotionRoute skip admin, affiliate and API routes only', () => {
  for (const p of ['/', '/produk', '/blog/x', '/tentang', '/tas-motor/matic', '/administrasi']) assert.strictEqual(B.isMotionRoute(p), true, p);
  for (const p of ['/admin', '/admin/produk', '/affiliate', '/affiliate/x', '/api/products']) assert.strictEqual(B.isMotionRoute(p), false, p);
  assert.ok(B.bootScript.includes('prefers-reduced-motion: reduce'));
  assert.ok(B.bootScript.includes(`'${B.CURTAIN_ATTR}'`));
  assert.ok(B.bootScript.includes(String(B.BOOT_FALLBACK_MS)));
  // The inline script must parse on its own.
  assert.doesNotThrow(() => new Function(B.bootScript));
});

test('Cloudinary photos are served as high-quality WebP without upscaling', () => {
  const src = 'https://res.cloudinary.com/demo/image/upload/v1/x/photo.jpg';
  assert.strictEqual(I.cldWebp(src, 800), 'https://res.cloudinary.com/demo/image/upload/f_webp,q_auto:best,c_limit,w_800/v1/x/photo.jpg');
  assert.strictEqual(I.cldWebp(src, 96, 96), 'https://res.cloudinary.com/demo/image/upload/f_webp,q_auto:best,c_fill,w_96,h_96/v1/x/photo.jpg');
  // Existing transforms are replaced, not stacked.
  assert.strictEqual(I.cldWebp('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_400/v1/p.png', 600), 'https://res.cloudinary.com/demo/image/upload/f_webp,q_auto:best,c_limit,w_600/v1/p.png');
  assert.strictEqual(I.cldWebp('/images/v2/local.jpg', 600), '/images/v2/local.jpg');
  assert.strictEqual(I.cldSrcSet(src, [480, 960]).split(', ').length, 2);
  assert.ok(I.cldSrcSet(src, [480]).endsWith(' 480w'));
  assert.strictEqual(I.isCloudinary(src), true);
  assert.strictEqual(I.isCloudinary(null), false);
  assert.ok(I.PHOTO_QUALITY >= 85);
});

console.log(`f016-motion: ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
