// F-016 task A5: the local fixture (lib/v2/dev-fixture.ts) is off in production and when F016_FIXTURE is unset.
// Usage: npm run test:fixture  (or: node tests/f016-fixture.cjs <repo-root>)
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

const os = require('os');
const fx = require(path.join(ROOT, 'lib/v2/dev-fixture.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const file = path.join(os.tmpdir(), `f016-fixture-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify({
  products: [
    { slug: 'a', name: 'A', price: 100000, isActive: true, createdAt: '2026-10-01T00:00:00.000Z' },
    { slug: 'b', name: 'B', price: 200000, isActive: false },
  ],
  articles: [
    { slug: 'k-1', title: 'Satu', content: 'x', status: 'published', publishedAt: '2026-10-02T00:00:00.000Z' },
    { slug: 'k-2', title: 'Dua', content: 'y', status: 'draft' },
    { slug: 'k-3', title: 'Tiga', content: 'z' },
  ],
}));

check('A5: off in production even when F016_FIXTURE is set', () => {
  const env = { NODE_ENV: 'production', F016_FIXTURE: file };
  assert.strictEqual(fx.devFixtureEnabled(env), false);
  assert.strictEqual(fx.fixtureProducts(env), undefined);
  assert.strictEqual(fx.fixtureArticles(env), undefined);
  assert.strictEqual(fx.fixtureArticle('k-1', env), undefined);
  assert.strictEqual(fx.fixtureFlash(env), undefined);
});
check('A5: off in development when F016_FIXTURE is unset', () => {
  assert.strictEqual(fx.fixtureProducts({ NODE_ENV: 'development' }), undefined);
});
check('A5: products keep only active ones, with slug and ms dates', () => {
  const list = fx.fixtureProducts({ NODE_ENV: 'development', F016_FIXTURE: file });
  assert.deepStrictEqual(list.map(p => p.slug), ['a']);
  assert.strictEqual(list[0].createdAt, Date.parse('2026-10-01T00:00:00.000Z'));
});
check('A5: articles drop drafts, legacy without status is published, F016_ARTICLES limits', () => {
  const env = { NODE_ENV: 'development', F016_FIXTURE: file };
  assert.deepStrictEqual(fx.fixtureArticles(env).map(a => a.slug), ['k-1', 'k-3']);
  assert.deepStrictEqual(fx.fixtureArticles({ ...env, F016_ARTICLES: '1' }).map(a => a.slug), ['k-1']);
  assert.deepStrictEqual(fx.fixtureArticles({ ...env, F016_ARTICLES: '0' }), []);
  assert.strictEqual(fx.fixtureArticle('k-2', env), null);
});
check('A5: F016_STATE=empty returns empty lists, F016_STATE=error throws', () => {
  const env = { NODE_ENV: 'development', F016_FIXTURE: file };
  assert.deepStrictEqual(fx.fixtureProducts({ ...env, F016_STATE: 'empty' }), []);
  assert.throws(() => fx.fixtureProducts({ ...env, F016_STATE: 'error' }), /forced error/);
});
check('A5/VF-03: F016_KATEGORI=draft adds the draft mapping only when kategoriMotor is missing', () => {
  const env = { NODE_ENV: 'development', F016_FIXTURE: file };
  assert.strictEqual(fx.fixtureProducts(env)[0].kategoriMotor, undefined);
  assert.ok(Array.isArray(fx.fixtureProducts({ ...env, F016_KATEGORI: 'draft' })[0].kategoriMotor));
});
check('A5: flash modes', () => {
  const env = { NODE_ENV: 'development', F016_FIXTURE: file };
  const now = Date.parse('2026-10-29T00:00:00.000Z');
  assert.deepStrictEqual(fx.fixtureFlash(env, now), { isActive: false, endsAt: null });
  assert.strictEqual(Date.parse(fx.fixtureFlash({ ...env, F016_FLASH: 'soon' }, now).endsAt) - now, 70000);
  assert.ok(Date.parse(fx.fixtureFlash({ ...env, F016_FLASH: 'expired' }, now).endsAt) < now);
});

fs.unlinkSync(file);
const failed = results.filter(r => r[0] === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
