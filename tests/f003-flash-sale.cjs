// F-003: flash sale guard. The banner may only show when endsAt is valid and in the future,
// and the first countdown value must be the real remaining time (no 00:00:00:00 flash).
// Usage: npm run test:flash-sale  (or: node tests/f003-flash-sale.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  m._compile(out.outputText, filename);
};

const { getFlashSaleTimeLeft } = require(path.join(ROOT, 'lib/flash-sale.ts'));

const NOW = Date.parse('2026-10-27T10:00:00.000Z');
const MIN = 60 * 1000;

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

check('expired: the live endsAt (2026-10-03, 24 days ago) hides the banner', () => {
  assert.strictEqual(getFlashSaleTimeLeft('2026-10-03T04:04:32.877Z', NOW), null);
});
check('expired: endsAt exactly now hides the banner', () => {
  assert.strictEqual(getFlashSaleTimeLeft(new Date(NOW).toISOString(), NOW), null);
});
check('expired: endsAt one second ago hides the banner', () => {
  assert.strictEqual(getFlashSaleTimeLeft(new Date(NOW - 1000).toISOString(), NOW), null);
});
check('invalid: null, undefined, empty string, and garbage hide the banner', () => {
  for (const v of [null, undefined, '', 'bukan-tanggal', 'NaN', {}, [], true]) {
    assert.strictEqual(getFlashSaleTimeLeft(v, NOW), null, `value ${JSON.stringify(v)}`);
  }
});
check('active: endsAt +10 minutes shows 00:00:10:00 on first paint', () => {
  assert.deepStrictEqual(getFlashSaleTimeLeft(new Date(NOW + 10 * MIN).toISOString(), NOW), { days: 0, hours: 0, minutes: 10, seconds: 0 });
});
check('active: endsAt +10 minutes, half a second later, shows 00:00:09:59', () => {
  assert.deepStrictEqual(getFlashSaleTimeLeft(new Date(NOW + 10 * MIN).toISOString(), NOW + 500), { days: 0, hours: 0, minutes: 9, seconds: 59 });
});
check('active: endsAt +1 day 2 h 3 min 4 s splits into all units', () => {
  const ms = ((24 + 2) * 60 + 3) * MIN + 4000;
  assert.deepStrictEqual(getFlashSaleTimeLeft(new Date(NOW + ms).toISOString(), NOW), { days: 1, hours: 2, minutes: 3, seconds: 4 });
});
check('active: a numeric epoch endsAt is accepted', () => {
  assert.deepStrictEqual(getFlashSaleTimeLeft(NOW + 90 * 1000, NOW), { days: 0, hours: 0, minutes: 1, seconds: 30 });
});
check('active: now defaults to Date.now()', () => {
  const left = getFlashSaleTimeLeft(new Date(Date.now() + 10 * MIN).toISOString());
  assert.ok(left && left.minutes >= 9 && left.days === 0 && left.hours === 0);
});

for (const [s, n] of results) console.log(`${s}  ${n}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
