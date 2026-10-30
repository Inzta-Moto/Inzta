// F-016 C5: pure helpers of the site motion (lib/v2/motion/links.ts, lib/v2/motion/boot.ts, lib/v2/motion/tier.ts) and the v2 image URLs
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

test('product detail pages open without the curtain; leaving them still travels', () => {
  assert.strictEqual(target({ href: '/produk/tankbag-inzta-tk-11' }), null);
  assert.strictEqual(target({ href: '/produk/tankbag-inzta-tk-11?varian=hitam' }, new URL('https://inzta.id/produk')), null);
  assert.strictEqual(target({ href: '/produk' }, new URL('https://inzta.id/produk/tankbag-inzta-tk-11')), '/produk');
  assert.strictEqual(target({ href: '/' }, new URL('https://inzta.id/produk/tankbag-inzta-tk-11')), '/');
});

test('a link to the page that is open replays the intro; other links do not', () => {
  const page = new URL('https://inzta.id/');
  assert.strictEqual(L.samePage(click({ href: '/' }), page), true);
  assert.strictEqual(L.samePage(click({ href: '/#garasi' }), page), false);
  assert.strictEqual(L.samePage(click({ href: '/?posisi=side' }), page), false);
  assert.strictEqual(L.samePage(click({ href: '/produk' }), page), false);
  assert.strictEqual(L.samePage(click({ href: '/', modified: true }), page), false);
  assert.strictEqual(L.samePage(click({ href: '/admin' }), new URL('https://inzta.id/admin')), false);
});

test('route labels name the destination', () => {
  assert.strictEqual(L.routeLabel('/'), 'Beranda');
  assert.strictEqual(L.routeLabel('/produk'), 'Semua tas');
  assert.strictEqual(L.routeLabel('/produk', '?posisi=tank'), 'Tank bag');
  assert.strictEqual(L.routeLabel('/produk', '?posisi=aksesori'), 'Aksesori touring');
  assert.strictEqual(L.routeLabel('/produk', '?posisi=side,tail'), 'Semua tas');
  assert.strictEqual(L.routeLabel('/produk', '?posisi=x'), 'Semua tas');
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

// Motion tiers (lib/v2/motion/tier.ts and the inline boot script that mirrors it).
const T = require(path.join(ROOT, 'lib/v2/motion/tier.ts'));
const vm = require('vm');
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 30, 8, 0, 0);
const base = { reduced: false, saveData: false, override: null, probe: null };

test('the ?motion= override parses full, lite, minimal and auto only', () => {
  assert.strictEqual(T.parseOverride('?motion=lite'), 'lite');
  assert.strictEqual(T.parseOverride('?x=1&motion=minimal'), 'minimal');
  assert.strictEqual(T.parseOverride('?motion=full&y=2'), 'full');
  assert.strictEqual(T.parseOverride('?motion=auto'), 'auto');
  assert.strictEqual(T.parseOverride('?motion=fast'), null);
  assert.strictEqual(T.parseOverride('?motion=lite2'), null);
  assert.strictEqual(T.parseOverride('?promotion=lite'), null);
  assert.strictEqual(T.parseOverride(''), null);
});

test('a stored probe verdict holds for 14 days and nothing else counts', () => {
  assert.strictEqual(T.readProbe(T.encodeProbe(NOW), NOW), 'lite');
  assert.strictEqual(T.readProbe(T.encodeProbe(NOW - 13 * DAY), NOW), 'lite');
  assert.strictEqual(T.readProbe(T.encodeProbe(NOW - 14 * DAY), NOW), null);
  assert.strictEqual(T.readProbe(T.encodeProbe(NOW + DAY), NOW), null);
  assert.strictEqual(T.readProbe('lite', NOW), null);
  assert.strictEqual(T.readProbe('full:123', NOW), null);
  assert.strictEqual(T.readProbe(null, NOW), null);
});

test('device and network hints point at lite; missing APIs are no hint', () => {
  assert.strictEqual(T.liteHints({}), false);
  assert.strictEqual(T.liteHints({ deviceMemory: 4 }), true);
  assert.strictEqual(T.liteHints({ deviceMemory: 8, cores: 8 }), false);
  assert.strictEqual(T.liteHints({ cores: 4, deviceMemory: 8 }), true);
  // Safari caps the core count it reports and has no deviceMemory: no hint, the frame probe decides.
  assert.strictEqual(T.liteHints({ cores: 4 }), false, 'Safari-like profile');
  assert.strictEqual(T.liteHints({ cores: 2 }), false, 'Safari-like profile');
  assert.strictEqual(T.liteHints({ cores: 6, deviceMemory: 8 }), false);
  assert.strictEqual(T.liteHints({ cores: 0, deviceMemory: 8 }), false);
  for (const et of ['slow-2g', '2g', '3g']) assert.strictEqual(T.liteHints({ effectiveType: et }), true, et);
  assert.strictEqual(T.liteHints({ effectiveType: '4g' }), false);
});

test('decideTier: reduced motion, override, Save-Data, probe, hints, then full', () => {
  const d = over => T.decideTier({ ...base, ...over });
  assert.deepStrictEqual(d({}), { tier: 'full', source: 'default' });
  assert.deepStrictEqual(d({ reduced: true, override: 'full' }), { tier: 'minimal', source: 'reduced' });
  assert.deepStrictEqual(d({ override: 'full', saveData: true, probe: 'lite', cores: 2 }), { tier: 'full', source: 'override' });
  assert.deepStrictEqual(d({ override: 'minimal' }), { tier: 'minimal', source: 'override' });
  assert.deepStrictEqual(d({ saveData: true, probe: 'lite' }), { tier: 'minimal', source: 'save-data' });
  assert.deepStrictEqual(d({ probe: 'lite', deviceMemory: 8 }), { tier: 'lite', source: 'probe' });
  assert.deepStrictEqual(d({ deviceMemory: 2 }), { tier: 'lite', source: 'hints' });
});

test('the tier only ever goes down within a session', () => {
  assert.strictEqual(T.downgrade('full', 'lite'), 'lite');
  assert.strictEqual(T.downgrade('full', 'minimal'), 'minimal');
  assert.strictEqual(T.downgrade('lite', 'full'), 'lite');
  assert.strictEqual(T.downgrade('minimal', 'lite'), 'minimal');
  assert.strictEqual(T.downgrade('lite', 'lite'), 'lite');
});

test('the frame probe says lite only for slow frames with enough samples', () => {
  const frames = (n, ms) => Array(n).fill(ms);
  assert.strictEqual(T.probeSaysLite(frames(90, 16.7)), false);
  assert.strictEqual(T.probeSaysLite(frames(180, 8.3)), false);
  assert.strictEqual(T.probeSaysLite(frames(45, 33.4)), true, 'steady 30 fps');
  // p75 fine but one frame in five drops two refreshes.
  assert.strictEqual(T.probeSaysLite([...frames(80, 16.7), ...frames(20, 40)]), true);
  assert.strictEqual(T.probeSaysLite([...frames(85, 16.7), ...frames(15, 40)]), false);
  assert.strictEqual(T.probeSaysLite(frames(10, 50)), false, 'too few samples');
  // A hidden tab (seconds-long gap) is not jank.
  assert.strictEqual(T.probeSaysLite([...frames(60, 16.7), 4000, 9000]), false);
});

// Runs the inline boot script against a fake page; returns what it wrote.
function boot({ path: pathname = '/', search = '', reduced = false, matchMedia = true, store = {}, storageThrows = false, nav = {} } = {}) {
  const attrs = {};
  const classes = new Set();
  const data = { ...store };
  const blocked = () => {
    throw new Error('blocked');
  };
  const storage = {
    getItem: k => (storageThrows ? blocked() : k in data ? data[k] : null),
    setItem: (k, v) => (storageThrows ? blocked() : (data[k] = String(v))),
    removeItem: k => (storageThrows ? blocked() : delete data[k]),
  };
  const documentElement = {
    classList: { add: c => classes.add(c) },
    setAttribute: (k, v) => (attrs[k] = v),
    getAttribute: k => (k in attrs ? attrs[k] : null),
    removeAttribute: k => delete attrs[k],
  };
  const win = {};
  if (matchMedia) win.matchMedia = q => ({ matches: q.includes('reduce') ? reduced : !reduced });
  Object.defineProperty(win, 'localStorage', { get: () => (storageThrows === 'getter' ? blocked() : storage) });
  const sandbox = { window: win, document: { documentElement }, location: { pathname, search }, navigator: nav, setTimeout: () => 0, Date: { now: () => NOW } };
  vm.runInNewContext(B.bootScript, sandbox);
  return { tier: attrs[T.TIER_ATTR] ?? null, curtain: attrs[B.CURTAIN_ATTR] ?? null, classes, store: data };
}

test('the boot script writes the same tier as decideTier over the signal matrix', () => {
  const overrides = [null, 'full', 'lite', 'minimal'];
  const probes = [null, T.encodeProbe(NOW - DAY), T.encodeProbe(NOW - 20 * DAY)];
  const navs = [
    {},
    { deviceMemory: 2 },
    { hardwareConcurrency: 8, deviceMemory: 8 },
    { hardwareConcurrency: 4, deviceMemory: 8 },
    { hardwareConcurrency: 4 },
    { connection: { effectiveType: '3g' } },
    { connection: { saveData: true } },
  ];
  let cases = 0;
  for (const reduced of [false, true])
    for (const override of overrides)
      for (const probe of probes)
        for (const nav of navs) {
          const store = {};
          if (override) store[T.OVERRIDE_KEY] = override;
          if (probe) store[T.PROBE_KEY] = probe;
          const got = boot({ reduced, store, nav });
          const want = T.decideTier({
            reduced,
            override,
            saveData: !!(nav.connection && nav.connection.saveData),
            probe: T.readProbe(probe, NOW),
            deviceMemory: nav.deviceMemory,
            cores: nav.hardwareConcurrency,
            effectiveType: nav.connection && nav.connection.effectiveType,
          }).tier;
          assert.strictEqual(got.tier, want, JSON.stringify({ reduced, override, probe, nav }));
          // The curtain and html.iz-js only come with a tier above minimal.
          assert.strictEqual(got.classes.has('iz-js'), want !== 'minimal');
          assert.strictEqual(got.curtain, want === 'minimal' ? null : 'load');
          assert.ok(got.classes.has('iz-v2'));
          cases++;
        }
  assert.strictEqual(cases, 168);
});

test('the boot script stores and clears the QA override and drops an expired probe verdict', () => {
  const set = boot({ search: '?motion=lite' });
  assert.strictEqual(set.tier, 'lite');
  assert.strictEqual(set.store[T.OVERRIDE_KEY], 'lite');
  assert.strictEqual(boot({ store: { [T.OVERRIDE_KEY]: 'minimal' } }).tier, 'minimal');
  const cleared = boot({ search: '?motion=auto', store: { [T.OVERRIDE_KEY]: 'lite' }, nav: { hardwareConcurrency: 12 } });
  assert.strictEqual(cleared.tier, 'full');
  assert.ok(!(T.OVERRIDE_KEY in cleared.store));
  assert.strictEqual(boot({ store: { [T.OVERRIDE_KEY]: 'turbo' } }).tier, 'full');
  const expired = boot({ store: { [T.PROBE_KEY]: T.encodeProbe(NOW - 15 * DAY) } });
  assert.strictEqual(expired.tier, 'full');
  assert.ok(!(T.PROBE_KEY in expired.store));
});

test('the boot script survives blocked storage, a missing matchMedia and skipped routes', () => {
  // The URL override holds for its own page even when it cannot be stored.
  assert.strictEqual(boot({ storageThrows: true, search: '?motion=lite' }).tier, 'lite');
  assert.strictEqual(boot({ storageThrows: 'getter', search: '?motion=minimal' }).tier, 'minimal');
  assert.strictEqual(boot({ storageThrows: true }).tier, 'full');
  assert.strictEqual(boot({ storageThrows: 'getter' }).tier, 'full');
  // A Safari-like profile (capped core count, no deviceMemory) is not sent to lite by the hint.
  assert.strictEqual(boot({ nav: { hardwareConcurrency: 4 } }).tier, 'full');
  const noMm = boot({ matchMedia: false });
  assert.strictEqual(noMm.tier, 'minimal');
  assert.ok(!noMm.classes.has('iz-js'));
  for (const p of ['/admin', '/affiliate/x', '/api/orders']) {
    const r = boot({ path: p });
    assert.strictEqual(r.tier, null, p);
    assert.strictEqual(r.classes.size, 0, p);
  }
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
