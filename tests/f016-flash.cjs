// F-016 requirement 24: pure flash-sale helpers in lib/v2/flash-time.ts (active rule, countdown, Asia/Jakarta dates).
// Usage: npm run test:flash  (or: node tests/f016-flash.cjs <repo-root>)
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

const { endsAtMs, isFlashActive, countdown, formatBarLong, formatBarShort, formatPanel } = require(path.join(ROOT, 'lib/v2/flash-time.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + e.message]); }
}

const END = '2026-10-31T16:59:00.000Z';
const END_MS = Date.parse(END);
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

check('24.1: active while isActive is true and endsAt is in the future', () => {
  assert.strictEqual(isFlashActive({ isActive: true, endsAt: END }, END_MS - 1), true);
  assert.strictEqual(isFlashActive({ isActive: true, endsAt: END }, END_MS - 3 * DAY), true);
});
check('24.1: inactive once endsAt has passed (and exactly at endsAt)', () => {
  assert.strictEqual(isFlashActive({ isActive: true, endsAt: END }, END_MS), false);
  assert.strictEqual(isFlashActive({ isActive: true, endsAt: END }, END_MS + 1), false);
});
check('24.1: endsAt null, empty, or unparsable counts as inactive', () => {
  for (const endsAt of [null, '', 'bukan tanggal', '2026-13-45T99:00:00Z']) {
    assert.strictEqual(isFlashActive({ isActive: true, endsAt }, 0), false, String(endsAt));
    assert.strictEqual(endsAtMs({ isActive: true, endsAt }), null, String(endsAt));
  }
});
check('24.1: isActive false (or not strictly true) counts as inactive', () => {
  assert.strictEqual(isFlashActive({ isActive: false, endsAt: END }, 0), false);
  assert.strictEqual(isFlashActive({ isActive: 'true', endsAt: END }, 0), false);
});
check('24.5: countdown splits the time left and rounds partial seconds down', () => {
  const left = 2 * DAY + 4 * 60 * MIN + 12 * MIN + 30 * 1000 + 999;
  assert.deepStrictEqual(countdown(END_MS, END_MS - left), { days: 2, hours: 4, minutes: 12, seconds: 30, ended: false });
  assert.deepStrictEqual(countdown(END_MS, END_MS - 999), { days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });
  assert.deepStrictEqual(countdown(END_MS, END_MS - 100 * DAY), { days: 100, hours: 0, minutes: 0, seconds: 0, ended: false });
});
check('24.6: countdown is zero and ended at or after endsAt, never negative', () => {
  const zero = { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  assert.deepStrictEqual(countdown(END_MS, END_MS), zero);
  assert.deepStrictEqual(countdown(END_MS, END_MS + 5 * DAY), zero);
});
check('24.3: promo bar dates in Asia/Jakarta, Indonesian locale', () => {
  assert.strictEqual(formatBarLong(END_MS), 'Sabtu, 31 Okt, 23.59');
  assert.strictEqual(formatBarShort(END_MS), '31 Okt, 23.59');
});
check('24.4: panel date in Asia/Jakarta with full month and year', () => {
  assert.strictEqual(formatPanel(END_MS), 'Sabtu, 31 Oktober 2026, 23.59');
});
check('24.3: the Jakarta date rolls over at 17:00 UTC and midnight prints as 00.00', () => {
  const ms = Date.parse('2026-10-31T17:00:00.000Z');
  assert.strictEqual(formatBarShort(ms), '1 Nov, 00.00');
  assert.strictEqual(formatPanel(ms), 'Minggu, 1 November 2026, 00.00');
});

const failed = results.filter(r => r[0] === 'FAIL');
for (const [status, name] of results) console.log(`${status}  ${name}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
