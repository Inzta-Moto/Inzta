// F-023 task T6: pure helpers of the affiliate dashboard (lib/affiliate/dashboard.ts). Link format, voucher chips and
// state, summary (same arithmetic as the pre-F-023 dashboard), monthly chart series and scale in WIB, transaction
// titles, filters, grouping, and the redirect-versus-error decision (E16). Example data only (INZ-CONTOH, "(contoh)").
// Usage: npm run test:affiliate  (or: node tests/f023-affiliate.cjs <repo-root>)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const assert = require('assert');

const ROOT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..'));
const ts = require(path.join(ROOT, 'node_modules/typescript'));

global.fetch = async (url) => { throw new Error(`real fetch called: ${url}`); };

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

const D = require(path.join(ROOT, 'lib/affiliate/dashboard.ts'));

const results = [];
function check(name, fn) {
  try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name + ': ' + (e && e.message)]); }
}

// WIB wall-clock time -> epoch ms (UTC+7, no DST).
const wib = (y, mo, d, h = 12, mi = 0) => Date.UTC(y, mo - 1, d, h - 7, mi);
const NOW = wib(2026, 11, 9, 10, 0);
const item = (productName, extra = {}) => ({ productName, quantity: 1, ...extra });
// Mirrors the FR-05 example list (amounts from the design, names marked "(contoh)").
const SAMPLE = [
  { id: 'c1', productName: 'Side bag XSR 155 (contoh)', items: [item('Side bag XSR 155 (contoh)', { selectedVariantLabel: 'Sepasang' })], productPrice: 520000, commissionAmount: 52000, isPaid: false, paidAt: null, createdAt: wib(2026, 11, 4, 14, 20), orderId: 'ORD-CONTOH-1' },
  { id: 'c2', productName: 'Tank bag magnet (contoh)', items: [item('Tank bag magnet (contoh)')], productPrice: 350000, commissionAmount: 35000, isPaid: false, paidAt: null, createdAt: wib(2026, 11, 1, 9, 5) },
  { id: 'c3', productName: 'Tail bag 30L (contoh)', items: [item('Tail bag 30L (contoh)', { selectedVariantLabel: 'Hitam' })], productPrice: 410000, commissionAmount: 41000, isPaid: true, paidAt: wib(2026, 11, 2), createdAt: wib(2026, 10, 28, 19, 42) },
  { id: 'c4', productName: 'Side bag universal (contoh)', items: [item('Side bag universal (contoh)', { selectedVariantLabel: 'Kiri', quantity: 2 })], productPrice: 300000, commissionAmount: 30000, isPaid: true, paidAt: wib(2026, 10, 25), createdAt: wib(2026, 10, 20, 11, 10) },
  { id: 'c5', productName: 'Tas tangki 15L (contoh)', items: [item('Tas tangki 15L (contoh)')], productPrice: 460000, commissionAmount: 46000, isPaid: true, paidAt: wib(2026, 9, 30), createdAt: wib(2026, 9, 22, 16, 30) },
  { id: 'c6', productName: 'Tail bag 20L (contoh)', items: [item('Tail bag 20L (contoh)', { selectedVariantLabel: 'Abu' })], productPrice: 280000, commissionAmount: 28000, isPaid: true, paidAt: wib(2026, 9, 15), createdAt: wib(2026, 9, 9, 8, 45) },
  { id: 'c7', productName: 'Side bag sepasang (contoh)', items: [item('Side bag sepasang (contoh)')], productPrice: 390000, commissionAmount: 39000, isPaid: true, paidAt: wib(2026, 8, 25), createdAt: wib(2026, 8, 18, 13, 15) },
];

// The pre-F-023 formulas from AffiliateDashboardClient.tsx, copied verbatim.
function oldSummary(commissions) {
  const totalPending = commissions.filter(c => !c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalPaid = commissions.filter(c => c.isPaid).reduce((s, c) => s + c.commissionAmount, 0);
  const totalAll = commissions.reduce((s, c) => s + c.commissionAmount, 0);
  return { totalAll, totalPaid, totalPending, pendingCount: commissions.filter(c => !c.isPaid).length };
}

check('affiliateLink / displayLink: home page with ?aff=, trimmed, encoded, empty code gives empty link', () => {
  assert.strictEqual(D.affiliateLink('INZ-CONTOH'), 'https://inzta.id/?aff=INZ-CONTOH');
  assert.strictEqual(D.displayLink('INZ-CONTOH'), 'inzta.id/?aff=INZ-CONTOH');
  assert.strictEqual(D.affiliateLink('  INZ-CONTOH  '), 'https://inzta.id/?aff=INZ-CONTOH');
  assert.strictEqual(D.affiliateLink('INZ CONTOH&x=1#a/b'), 'https://inzta.id/?aff=INZ%20CONTOH%26x%3D1%23a%2Fb');
  assert.strictEqual(D.displayLink('INZ CONTOH'), 'inzta.id/?aff=INZ%20CONTOH');
  assert.strictEqual(D.affiliateLink(''), '');
  assert.strictEqual(D.affiliateLink('   '), '');
  assert.strictEqual(D.displayLink(''), '');
  assert.strictEqual(D.SITE_ORIGIN, 'https://inzta.id');
});

check('affiliateLink matches the F-021 product share helper encoding (productShareUrl)', () => {
  const S = require(path.join(ROOT, 'components/v2/product/share.ts'));
  for (const code of ['INZ-CONTOH', 'INZ CONTOH', 'a&b=c']) {
    assert.strictEqual(D.affiliateLink(code), S.productShareUrl(D.SITE_ORIGIN, '/', code));
  }
});

check('formatRupiah: dots, no space, no decimals; 0, negative, NaN give Rp0', () => {
  assert.strictEqual(D.formatRupiah(87000), 'Rp87.000');
  assert.strictEqual(D.formatRupiah(0), 'Rp0');
  assert.strictEqual(D.formatRupiah(1250000), 'Rp1.250.000');
  assert.strictEqual(D.formatRupiah(999), 'Rp999');
  assert.strictEqual(D.formatRupiah(1234567.6), 'Rp1.234.568');
  assert.strictEqual(D.formatRupiah(-5000), 'Rp0');
  assert.strictEqual(D.formatRupiah(NaN), 'Rp0');
  assert.strictEqual(D.formatRupiah(undefined), 'Rp0');
});

check('date formats in WIB: short, date-time, day-month, month labels', () => {
  assert.strictEqual(D.formatDateShort(wib(2026, 11, 6)), '6 Nov 2026');
  assert.strictEqual(D.formatDateShort(null), '');
  assert.strictEqual(D.formatDateShort(undefined), '');
  assert.strictEqual(D.formatDateTime(wib(2026, 11, 4, 14, 20)), '4 Nov 2026, 14.20');
  assert.strictEqual(D.formatDateTime(wib(2026, 11, 1, 9, 5)), '1 Nov 2026, 09.05');
  assert.strictEqual(D.formatDayMonth(wib(2026, 8, 25)), '25 Agu');
  // 31 Dec 2026 23:30 WIB is still 31 Dec in WIB although it is 16:30 UTC.
  assert.strictEqual(D.formatDateShort(Date.UTC(2026, 11, 31, 16, 30)), '31 Des 2026');
  assert.strictEqual(D.formatDateShort(Date.UTC(2026, 11, 31, 17, 30)), '1 Jan 2027');
  assert.strictEqual(D.formatMonthLong('2026-11'), 'November 2026');
  assert.strictEqual(D.formatMonthLong('2026-08'), 'Agustus 2026');
  assert.strictEqual(D.formatMonthLong('tanpa-tanggal'), 'Tanpa tanggal');
  assert.strictEqual(D.formatMonthLong('2026-13'), '');
  assert.strictEqual(D.formatMonthShort('2026-08'), 'Agu');
  assert.strictEqual(D.monthKeyOf(wib(2026, 1, 1, 0, 5)), '2026-01');
});

check('toMillis: number, ISO string, {seconds}, {_seconds}, toMillis(), Date; invalid gives null', () => {
  const ms = Date.UTC(2026, 11, 31, 16, 59, 59);
  assert.strictEqual(D.toMillis(ms), ms);
  assert.strictEqual(D.toMillis(new Date(ms).toISOString()), ms);
  assert.strictEqual(D.toMillis({ seconds: ms / 1000, nanoseconds: 0 }), ms);
  assert.strictEqual(D.toMillis({ _seconds: ms / 1000, _nanoseconds: 500000000 }), ms + 500);
  assert.strictEqual(D.toMillis({ toMillis: () => ms }), ms);
  assert.strictEqual(D.toMillis(new Date(ms)), ms);
  for (const bad of [null, undefined, '', 'bukan tanggal', NaN, Infinity, {}, { seconds: 'x' }, true, { toMillis: () => { throw new Error('x'); } }]) {
    assert.strictEqual(D.toMillis(bad), null, String(bad));
  }
});

check('voucherDiscountLabel: percent, fixed, capped percent, 0, unknown type, null', () => {
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: 10 }), 'Potongan 10% untuk pembeli');
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: 7.5 }), 'Potongan 7,5% untuk pembeli');
  assert.strictEqual(D.voucherDiscountLabel({ type: 'fixed', value: 15000 }), 'Potongan Rp15.000 untuk pembeli');
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: 10, maxDiscount: 50000 }), 'Potongan 10% (maks Rp50.000) untuk pembeli');
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: 10, maxDiscount: 0 }), 'Potongan 10% untuk pembeli');
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: 0 }), null);
  assert.strictEqual(D.voucherDiscountLabel({ type: 'fixed', value: -1 }), null);
  assert.strictEqual(D.voucherDiscountLabel({ type: 'gratis-ongkir', value: 10 }), null);
  assert.strictEqual(D.voucherDiscountLabel({ type: 'percentage', value: '10' }), null);
  assert.strictEqual(D.voucherDiscountLabel({ value: 10 }), null);
  assert.strictEqual(D.voucherDiscountLabel(null), null);
});

check('voucherExpiryLabel: WIB date of expiresAt; null when empty or unreadable', () => {
  assert.strictEqual(D.voucherExpiryLabel({ expiresAt: wib(2026, 12, 31, 23, 59) }), 'Berlaku s.d. 31 Des 2026');
  assert.strictEqual(D.voucherExpiryLabel({ expiresAt: '2026-12-31T16:59:00.000Z' }), 'Berlaku s.d. 31 Des 2026');
  assert.strictEqual(D.voucherExpiryLabel({ expiresAt: null }), null);
  assert.strictEqual(D.voucherExpiryLabel({}), null);
  assert.strictEqual(D.voucherExpiryLabel({ expiresAt: 'x' }), null);
  assert.strictEqual(D.voucherExpiryLabel(null), null);
});

check('voucherState: active, expired, inactive, missing, expired wins over inactive', () => {
  const future = NOW + 86400000;
  const past = NOW - 1000;
  assert.strictEqual(D.voucherState('INZ-CONTOH', { code: 'INZ-CONTOH', isActive: true, expiresAt: future }, NOW), 'active');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { code: 'INZ-CONTOH', isActive: true, expiresAt: null }, NOW), 'active');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { isActive: true, expiresAt: past }, NOW), 'expired');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { isActive: true, expiresAt: new Date(past).toISOString() }, NOW), 'expired');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { isActive: true, expiresAt: { _seconds: Math.floor(past / 1000) } }, NOW), 'expired');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { isActive: false, expiresAt: future }, NOW), 'inactive');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { expiresAt: null }, NOW), 'inactive');
  assert.strictEqual(D.voucherState('INZ-CONTOH', { isActive: false, expiresAt: past }, NOW), 'expired');
  assert.strictEqual(D.voucherState('', { isActive: true }, NOW), 'missing');
  assert.strictEqual(D.voucherState('  ', { isActive: true }, NOW), 'missing');
  assert.strictEqual(D.voucherState('INZ-CONTOH', null, NOW), 'missing');
});

check('summarize: same totals as the pre-F-023 dashboard on the example list', () => {
  const s = D.summarize(SAMPLE);
  const old = oldSummary(SAMPLE);
  assert.strictEqual(s.total, old.totalAll);
  assert.strictEqual(s.paid, old.totalPaid);
  assert.strictEqual(s.pending, old.totalPending);
  assert.strictEqual(s.pendingCount, old.pendingCount);
  assert.deepStrictEqual(s, { total: 271000, paid: 184000, pending: 87000, pendingCount: 2, count: 7, firstMonthKey: '2026-08' });
  assert.strictEqual(D.summaryCaption(s), 'Dari 7 transaksi sejak Agustus 2026');
});

check('summarize: empty list and missing or non-numeric amounts count as 0', () => {
  const empty = D.summarize([]);
  assert.deepStrictEqual(empty, { total: 0, paid: 0, pending: 0, pendingCount: 0, count: 0, firstMonthKey: null });
  assert.strictEqual(D.summaryCaption(empty), 'Belum ada komisi tercatat.');
  const s = D.summarize([{ id: 'a', isPaid: true }, { id: 'b', commissionAmount: '5000' }, { id: 'c', commissionAmount: NaN }, { id: 'd', commissionAmount: 1000 }]);
  assert.deepStrictEqual(s, { total: 1000, paid: 0, pending: 1000, pendingCount: 3, count: 4, firstMonthKey: null });
  assert.strictEqual(D.summaryCaption(s), 'Dari 4 transaksi');
});

check('splitRatio: fractions of paid and pending, both 0 when total is 0', () => {
  const r = D.splitRatio(D.summarize(SAMPLE));
  assert.ok(Math.abs(r.paid - 184000 / 271000) < 1e-12);
  assert.ok(Math.abs(r.pending - 87000 / 271000) < 1e-12);
  assert.deepStrictEqual(D.splitRatio(D.summarize([])), { paid: 0, pending: 0 });
  assert.deepStrictEqual(D.splitRatio(D.summarize([{ id: 'x', isPaid: true, commissionAmount: 1 }])), { paid: 1, pending: 0 });
});

check('monthlySeries: FR-05 example gives Agu..Nov with stacked paid/pending and the current month flagged', () => {
  const s = D.monthlySeries(SAMPLE, NOW);
  assert.deepStrictEqual(s.map(b => b.label), ['Agu', 'Sep', 'Okt', 'Nov']);
  assert.deepStrictEqual(s.map(b => [b.paid, b.pending]), [[39000, 0], [74000, 0], [71000, 0], [0, 87000]]);
  assert.deepStrictEqual(s.map(b => b.isCurrent), [false, false, false, true]);
  assert.strictEqual(D.seriesRangeLabel(s), 'Agustus–November 2026');
  assert.deepStrictEqual(D.currentMonthHeadline(s), { amount: 87000, note: 'bulan ini · belum cair' });
});

check('monthlySeries: empty months in the middle stay as 0, and the series runs to the current month', () => {
  const list = [
    { id: 'a', commissionAmount: 10000, isPaid: true, createdAt: wib(2026, 7, 10) },
    { id: 'b', commissionAmount: 20000, isPaid: false, createdAt: wib(2026, 9, 10) },
  ];
  const s = D.monthlySeries(list, NOW);
  assert.deepStrictEqual(s.map(b => b.key), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.deepStrictEqual(s.map(b => b.paid + b.pending), [10000, 0, 20000, 0, 0]);
  assert.strictEqual(s[4].isCurrent, true);
  assert.deepStrictEqual(D.currentMonthHeadline(s), { amount: 0, note: 'bulan ini' });
});

check('monthlySeries: at most the last 6 months; maxMonths respected; undated and future rows have no bar; [] for none', () => {
  const list = [
    { id: 'old', commissionAmount: 1000, isPaid: true, createdAt: wib(2025, 12, 5) },
    { id: 'may', commissionAmount: 2000, isPaid: true, createdAt: wib(2026, 6, 5) },
    { id: 'nodate', commissionAmount: 3000, isPaid: false, createdAt: null },
    { id: 'future', commissionAmount: 4000, isPaid: false, createdAt: wib(2026, 12, 2) },
  ];
  const s = D.monthlySeries(list, NOW);
  assert.deepStrictEqual(s.map(b => b.label), ['Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov']);
  assert.strictEqual(s[0].paid, 2000);
  assert.strictEqual(s.reduce((t, b) => t + b.paid + b.pending, 0), 2000);
  assert.deepStrictEqual(D.monthlySeries(list, NOW, 3).map(b => b.key), ['2026-09', '2026-10', '2026-11']);
  assert.deepStrictEqual(D.monthlySeries([], NOW), []);
  assert.deepStrictEqual(D.monthlySeries([{ id: 'n', commissionAmount: 5, createdAt: null }], NOW), []);
  const across = D.monthlySeries([{ id: 'y', commissionAmount: 5, isPaid: true, createdAt: wib(2025, 12, 20) }], wib(2026, 1, 3));
  assert.deepStrictEqual(across.map(b => b.label), ['Des', 'Jan']);
  assert.strictEqual(D.seriesRangeLabel(across), 'Desember 2025–Januari 2026');
  assert.strictEqual(D.seriesRangeLabel(D.monthlySeries([{ id: 'z', commissionAmount: 5, createdAt: wib(2026, 11, 1) }], NOW)), 'November 2026');
  assert.strictEqual(D.seriesRangeLabel([]), '');
});

check('monthlySeries: month boundary in WIB (31 Okt 23:30 WIB in Oktober, 1 Nov 00:30 WIB in November)', () => {
  const lateOct = Date.UTC(2026, 9, 31, 16, 30); // 31 Okt 23:30 WIB
  const earlyNov = Date.UTC(2026, 9, 31, 17, 30); // 1 Nov 00:30 WIB
  const s = D.monthlySeries([
    { id: 'a', commissionAmount: 1000, isPaid: false, createdAt: lateOct },
    { id: 'b', commissionAmount: 2000, isPaid: false, createdAt: earlyNov },
  ], NOW);
  assert.deepStrictEqual(s.map(b => [b.key, b.pending]), [['2026-10', 1000], ['2026-11', 2000]]);
  assert.strictEqual(D.monthKeyOf(lateOct), '2026-10');
  assert.strictEqual(D.monthKeyOf(earlyNov), '2026-11');
  // "now" just after midnight WIB on 1 Nov already counts November as the current month.
  const s2 = D.monthlySeries([{ id: 'a', commissionAmount: 1000, createdAt: lateOct }], earlyNov);
  assert.deepStrictEqual(s2.map(b => [b.key, b.isCurrent]), [['2026-10', false], ['2026-11', true]]);
});

check('currentMonthHeadline: paid-only and mixed current months', () => {
  const bar = (paid, pending) => [{ key: '2026-11', label: 'Nov', paid, pending, isCurrent: true }];
  assert.deepStrictEqual(D.currentMonthHeadline(bar(41000, 0)), { amount: 41000, note: 'bulan ini · sudah cair' });
  assert.deepStrictEqual(D.currentMonthHeadline(bar(41000, 35000)), { amount: 76000, note: 'bulan ini · Rp35.000 belum cair' });
  assert.deepStrictEqual(D.currentMonthHeadline([]), { amount: 0, note: 'bulan ini' });
});

check('chartScale: rounded-up whole-rupiah steps, evenly spaced ticks, 0 gives a single tick', () => {
  assert.deepStrictEqual(D.chartScale(0), { max: 0, ticks: [0] });
  assert.deepStrictEqual(D.chartScale(-5), { max: 0, ticks: [0] });
  assert.deepStrictEqual(D.chartScale(NaN), { max: 0, ticks: [0] });
  assert.deepStrictEqual(D.chartScale(87000), { max: 90000, ticks: [0, 30000, 60000, 90000] });
  assert.deepStrictEqual(D.chartScale(1234567), { max: 1500000, ticks: [0, 500000, 1000000, 1500000] });
  assert.deepStrictEqual(D.chartScale(1), { max: 3, ticks: [0, 1, 2, 3] });
  assert.deepStrictEqual(D.chartScale(5), { max: 6, ticks: [0, 2, 4, 6] });
  assert.deepStrictEqual(D.chartScale(7000), { max: 7500, ticks: [0, 2500, 5000, 7500] });
  assert.deepStrictEqual(D.chartScale(90000), { max: 90000, ticks: [0, 30000, 60000, 90000] });
  assert.deepStrictEqual(D.chartScale(52000, 3), { max: 60000, ticks: [0, 30000, 60000] });
  for (const v of [1, 7, 99, 1000, 12345, 87000, 99999, 271000, 1234567, 9876543]) {
    const { max, ticks } = D.chartScale(v);
    assert.ok(max >= v, `max ${max} >= ${v}`);
    assert.ok(max < v * 2 + 3, `max ${max} not far above ${v}`);
    assert.strictEqual(ticks.length, 4);
    assert.ok(ticks.every(t => Number.isInteger(t)), `whole rupiah ${ticks}`);
    const step = ticks[1];
    assert.ok(ticks.every((t, i) => t === step * i), `even ticks ${ticks}`);
  }
});

check('formatAxisRupiah: compact axis labels as drawn in FR-04/FR-05', () => {
  assert.strictEqual(D.formatAxisRupiah(0), 'Rp0');
  assert.strictEqual(D.formatAxisRupiah(500), 'Rp500');
  assert.strictEqual(D.formatAxisRupiah(30000), 'Rp30 rb');
  assert.strictEqual(D.formatAxisRupiah(90000), 'Rp90 rb');
  assert.strictEqual(D.formatAxisRupiah(87000), 'Rp87 rb');
  assert.strictEqual(D.formatAxisRupiah(2500), 'Rp2,5 rb');
  assert.strictEqual(D.formatAxisRupiah(1000000), 'Rp1 jt');
  assert.strictEqual(D.formatAxisRupiah(1500000), 'Rp1,5 jt');
  assert.strictEqual(D.formatAxisRupiah(1250000), 'Rp1,25 jt');
  assert.strictEqual(D.formatAxisRupiah(999999), 'Rp1 jt');
  assert.strictEqual(D.formatAxisRupiah(2000000000), 'Rp2 M');
  assert.strictEqual(D.formatAxisRupiah(-1), 'Rp0');
  for (const t of D.chartScale(87000).ticks) assert.ok(/^Rp\d/.test(D.formatAxisRupiah(t)));
});

check('commissionTitle / commissionMeta: single item, multi item, legacy name, no items', () => {
  const [c1, , c3, c4] = SAMPLE;
  assert.strictEqual(D.commissionTitle(c1), 'Side bag XSR 155 (contoh)');
  assert.strictEqual(D.commissionMeta(c1), 'Sepasang · 1 pcs');
  assert.strictEqual(D.commissionMeta(c3), 'Hitam · 1 pcs');
  assert.strictEqual(D.commissionMeta(c4), 'Kiri · 2 pcs');
  assert.strictEqual(D.commissionMeta(SAMPLE[1]), '1 pcs');
  const multi = { id: 'm', productName: 'Tail bag 30L (contoh)', items: [item('Tail bag 30L (contoh)', { selectedVariantLabel: 'Hitam', quantity: 1 }), item('Tas botol (contoh)', { quantity: 2 }), item('Strap (contoh)')] };
  assert.strictEqual(D.commissionTitle(multi), 'Tail bag 30L (contoh) +2 produk lain');
  assert.strictEqual(D.commissionMeta(multi), 'Hitam · 4 pcs');
  const legacy = { id: 'l', items: [{ name: 'Tank bag lama (contoh)', quantity: 1 }] };
  assert.strictEqual(D.commissionTitle(legacy), 'Tank bag lama (contoh)');
  const emptyName = { id: 'e', productName: 'Produk induk (contoh)', items: [{ productName: '  ', name: 'Nama cadangan (contoh)' }] };
  assert.strictEqual(D.commissionTitle(emptyName), 'Nama cadangan (contoh)');
  const noItems = { id: 'n', productName: 'Side bag lama (contoh)' };
  assert.strictEqual(D.commissionTitle(noItems), 'Side bag lama (contoh)');
  assert.strictEqual(D.commissionMeta(noItems), '');
  assert.strictEqual(D.commissionTitle({ id: 'x' }), 'Produk');
  assert.strictEqual(D.commissionTitle({ id: 'x', items: [] }), 'Produk');
  assert.strictEqual(D.commissionMeta({ id: 'x', items: [{ productName: 'A (contoh)' }] }), '');
});

check('commissionLines and commissionQuestionText for the transaction detail', () => {
  const multi = { id: 'm', items: [item('Tail bag 30L (contoh)', { selectedVariantLabel: 'Hitam' }), item('Tas botol (contoh)', { quantity: 2 })], createdAt: wib(2026, 11, 4, 14, 20), orderId: 'ORD-CONTOH-1' };
  assert.deepStrictEqual(D.commissionLines(multi), [{ name: 'Tail bag 30L (contoh)', meta: 'Hitam · 1 pcs' }, { name: 'Tas botol (contoh)', meta: '2 pcs' }]);
  assert.deepStrictEqual(D.commissionLines({ id: 'n', productName: 'Side bag lama (contoh)' }), [{ name: 'Side bag lama (contoh)', meta: '' }]);
  assert.strictEqual(D.commissionQuestionText(multi, 'INZ-CONTOH'),
    'Halo Admin INZTA, saya affiliate dengan kode INZ-CONTOH. Saya ingin bertanya soal transaksi Tail bag 30L (contoh) +1 produk lain (Order ID #ORD-CONTOH-1), 4 Nov 2026, 14.20.');
  assert.strictEqual(D.commissionQuestionText({ id: 'x' }, ''), 'Halo Admin INZTA, saya affiliate. Saya ingin bertanya soal transaksi Produk.');
  assert.strictEqual(D.whatsappUrl('620000', 'Halo & tanya?'), 'https://wa.me/620000?text=Halo%20%26%20tanya%3F');
});

check('statusCounts: all, pending, paid', () => {
  assert.deepStrictEqual(D.statusCounts(SAMPLE), { all: 7, pending: 2, paid: 5 });
  assert.deepStrictEqual(D.statusCounts([]), { all: 0, pending: 0, paid: 0 });
});

check('filterCommissions: partial case-insensitive query, status, month, combinations, order kept', () => {
  const ids = (f) => D.filterCommissions(SAMPLE, { ...D.EMPTY_FILTERS, ...f }).map(c => c.id);
  assert.deepStrictEqual(ids({}), ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
  assert.deepStrictEqual(ids({ query: 'SIDE bag' }), ['c1', 'c4', 'c7']);
  assert.deepStrictEqual(ids({ query: '  tail  ' }), ['c3', 'c6']);
  assert.deepStrictEqual(ids({ query: 'tidak ada' }), []);
  assert.deepStrictEqual(ids({ status: 'pending' }), ['c1', 'c2']);
  assert.deepStrictEqual(ids({ status: 'paid' }), ['c3', 'c4', 'c5', 'c6', 'c7']);
  assert.deepStrictEqual(ids({ month: '2026-10' }), ['c3', 'c4']);
  assert.deepStrictEqual(ids({ month: '2026-11', status: 'paid' }), []);
  assert.deepStrictEqual(ids({ month: '2026-09', status: 'paid', query: '20l' }), ['c6']);
  // Order follows the input, not the date.
  const reversed = D.filterCommissions([...SAMPLE].reverse(), { query: 'side', status: 'all', month: 'all' }).map(c => c.id);
  assert.deepStrictEqual(reversed, ['c7', 'c4', 'c1']);
  // Search covers every item name, the legacy `name`, and productName.
  const multi = [{ id: 'm', productName: 'Utama (contoh)', items: [{ productName: 'Utama (contoh)' }, { name: 'Tas Botol (contoh)' }] }, { id: 'p', productName: 'Strap (contoh)' }];
  assert.deepStrictEqual(D.filterCommissions(multi, { query: 'botol', status: 'all', month: 'all' }).map(c => c.id), ['m']);
  assert.deepStrictEqual(D.filterCommissions(multi, { query: 'strap', status: 'all', month: 'all' }).map(c => c.id), ['p']);
  // Undated rows: only under "all" or the no-date group key.
  const nodate = [{ id: 'n', createdAt: null }];
  assert.deepStrictEqual(D.filterCommissions(nodate, { query: '', status: 'all', month: '2026-11' }), []);
  assert.deepStrictEqual(D.filterCommissions(nodate, { query: '', status: 'all', month: D.NO_DATE_KEY }).map(c => c.id), ['n']);
});

check('isFiltered and EMPTY_FILTERS', () => {
  assert.deepStrictEqual({ ...D.EMPTY_FILTERS }, { query: '', status: 'all', month: 'all' });
  assert.strictEqual(D.isFiltered(D.EMPTY_FILTERS), false);
  assert.strictEqual(D.isFiltered({ ...D.EMPTY_FILTERS, query: '   ' }), false);
  assert.strictEqual(D.isFiltered({ ...D.EMPTY_FILTERS, query: 'tas' }), true);
  assert.strictEqual(D.isFiltered({ ...D.EMPTY_FILTERS, status: 'paid' }), true);
  assert.strictEqual(D.isFiltered({ ...D.EMPTY_FILTERS, month: '2026-11' }), true);
  assert.strictEqual(D.PAGE_SIZE, 20);
});

check('monthOptions: months with commissions, newest first, long labels and counts (FR-14)', () => {
  assert.deepStrictEqual(D.monthOptions(SAMPLE), [
    { key: '2026-11', label: 'November 2026', count: 2 },
    { key: '2026-10', label: 'Oktober 2026', count: 2 },
    { key: '2026-09', label: 'September 2026', count: 2 },
    { key: '2026-08', label: 'Agustus 2026', count: 1 },
  ]);
  assert.deepStrictEqual(D.monthOptions([{ id: 'n', createdAt: null }]), []);
  assert.deepStrictEqual(D.monthOptions([]), []);
});

check('groupByMonth: newest first, subtotals, undated rows last under "Tanpa tanggal"', () => {
  const groups = D.groupByMonth(SAMPLE);
  assert.deepStrictEqual(groups.map(g => [g.label, g.subtotal, g.items.map(c => c.id)]), [
    ['November 2026', 87000, ['c1', 'c2']],
    ['Oktober 2026', 71000, ['c3', 'c4']],
    ['September 2026', 74000, ['c5', 'c6']],
    ['Agustus 2026', 39000, ['c7']],
  ]);
  const mixed = D.groupByMonth([{ id: 'n', commissionAmount: 5000, createdAt: null }, { id: 'a', commissionAmount: 'x', createdAt: wib(2026, 1, 2) }, { id: 'b', commissionAmount: 1000, createdAt: wib(2026, 3, 2) }]);
  assert.deepStrictEqual(mixed.map(g => [g.key, g.label, g.subtotal]), [['2026-03', 'Maret 2026', 1000], ['2026-01', 'Januari 2026', 0], ['tanpa-tanggal', 'Tanpa tanggal', 5000]]);
  assert.deepStrictEqual(D.groupByMonth([]), []);
});

check('isSessionError: Firebase Auth errors redirect to login; Firestore, network, plain errors do not', () => {
  const authErr = (code) => Object.assign(new Error('auth failed'), { code });
  assert.strictEqual(D.isSessionError(authErr('auth/session-cookie-expired')), true);
  assert.strictEqual(D.isSessionError(authErr('auth/session-cookie-revoked')), true);
  assert.strictEqual(D.isSessionError(authErr('auth/argument-error')), true);
  assert.strictEqual(D.isSessionError({ errorInfo: { code: 'auth/user-disabled' } }), true);
  assert.strictEqual(D.isSessionError(Object.assign(new Error('UNAVAILABLE'), { code: 14 })), false);
  assert.strictEqual(D.isSessionError({ code: 'unavailable' }), false);
  assert.strictEqual(D.isSessionError({ code: 'permission-denied' }), false);
  assert.strictEqual(D.isSessionError(new Error('network down')), false);
  assert.strictEqual(D.isSessionError(null), false);
  assert.strictEqual(D.isSessionError(undefined), false);
  assert.strictEqual(D.isSessionError('auth/session-cookie-expired'), false);
});

// REV-01: with loading.tsx a redirect from the dashboard is a 200 meta refresh, and the middleware sends
// /affiliate/login back to the dashboard while affiliate_session exists. So once the cookie is known to exist, the
// page must leave through /affiliate/sesi-habis, which clears it. Static check of the source files.
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

check('REV-01 sesi-habis route: GET, dynamic, clears affiliate_session on path / and redirects to /affiliate/login', () => {
  const rel = 'app/affiliate/sesi-habis/route.ts';
  assert.ok(fs.existsSync(path.join(ROOT, rel)), `${rel} is missing`);
  const src = stripComments(read(rel));
  assert.match(src, /export\s+(async\s+)?function\s+GET\s*\(/);
  assert.match(src, /export\s+const\s+dynamic\s*=\s*'force-dynamic'/);
  assert.match(src, /NextResponse\.redirect\(\s*new URL\(\s*'\/affiliate\/login'\s*,\s*request\.url\s*\)\s*\)/);
  assert.match(src, /cookies\.set\(\s*'affiliate_session'\s*,\s*''\s*,\s*\{[^}]*maxAge:\s*0[^}]*path:\s*'\/'/);
  assert.doesNotMatch(src, /firebase|firestore|getAdmin/i, 'the route must not touch Firebase');
});

check('REV-01 dashboard page: /affiliate/login only when there is no cookie; invalid session and unknown uid go to sesi-habis', () => {
  const src = stripComments(read('app/affiliate/(panel)/dashboard/page.tsx'));
  const loginRedirects = src.match(/redirect\(\s*'\/affiliate\/login'\s*\)/g) || [];
  assert.strictEqual(loginRedirects.length, 1, 'exactly one redirect to /affiliate/login');
  assert.match(src, /if\s*\(\s*!sessionCookie\s*\)\s*redirect\(\s*'\/affiliate\/login'\s*\)/, 'the login redirect sits on the no-cookie branch');
  assert.match(src, /SESSION_ENDED_URL\s*=\s*'\/affiliate\/sesi-habis'/);
  assert.match(src, /if\s*\(\s*isSessionError\(err\)\s*\)\s*redirect\(\s*SESSION_ENDED_URL\s*\)/);
  assert.match(src, /if\s*\(\s*!data\s*\)\s*redirect\(\s*SESSION_ENDED_URL\s*\)/);
  const redirects = src.match(/redirect\(/g) || [];
  assert.strictEqual(redirects.length, 3, 'no other redirect paths');
});

check('REV-01 middleware unchanged in shape: /affiliate/sesi-habis is not the login path, so it passes with a cookie', () => {
  const src = read('middleware.ts');
  assert.match(src, /pathname === '\/affiliate\/login'/);
  assert.ok(!src.includes('sesi-habis'), 'middleware needs no special case for sesi-habis');
});

// REV-02: a commission document is only written when the admin completes the order, so pending means "not paid out".
check('REV-02 status texts: no "menunggu dicek admin"; "Dicek admin" is always done in the detail timeline', () => {
  const files = ['CommissionsSection.tsx', 'CommissionSummary.tsx', 'CommissionDetail.tsx'].map((f) => read(`components/affiliate/commissions/${f}`));
  for (const src of files) assert.doesNotMatch(src, /menunggu dicek admin/i);
  assert.ok(files[0].includes('Pending: komisi tercatat, menunggu dicairkan admin. Cair: komisi sudah dibayar.'));
  assert.strictEqual((files[1].match(/Menunggu dicairkan/g) || []).length, 2);
  assert.match(files[2], /\{\s*state:\s*'done',\s*title:\s*'Dicek admin'/);
  assert.match(files[2], /title:\s*'Komisi cair'[^\n]*'Menunggu dicairkan'/);
});

let failed = 0;
for (const [s, n] of results) {
  if (s === 'FAIL') failed++;
  console.log(`${s}  ${n}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
