// F-023: pure helpers for the affiliate dashboard (link, voucher, summary, monthly chart, transaction filters). No
// React, Firebase, or window, so the server page, client components, and tests share one implementation. Dates are
// epoch ms; every calendar computation uses a fixed WIB offset (UTC+7, no DST) instead of the machine zone, so the
// server (UTC on Vercel) and the buyer's phone print the same day and month.

export type AffCommissionItem = {
  productName?: string;
  name?: string;
  selectedVariantLabel?: string | null;
  quantity?: number;
};

export type AffCommission = {
  id: string;
  productName?: string;
  items?: AffCommissionItem[];
  productPrice?: number;
  commissionAmount?: number;
  isPaid?: boolean;
  paidAt?: number | null;
  createdAt?: number | null;
  orderId?: string;
};

export type AffVoucher = {
  code?: string;
  type?: 'percentage' | 'fixed' | string;
  value?: number;
  /** Cap of a percentage voucher in rupiah (0 or missing: no cap). */
  maxDiscount?: number;
  isActive?: boolean;
  expiresAt?: number | string | null;
} | null;

export type StatusFilter = 'all' | 'pending' | 'paid';

export const SITE_ORIGIN = 'https://inzta.id';
export const PAGE_SIZE = 20;
/** Month key of commissions without a usable createdAt (groupByMonth, filterCommissions). */
export const NO_DATE_KEY = 'tanpa-tanggal';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Non-numbers, NaN, and Infinity count as 0, so one bad document cannot turn every total into NaN. */
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function wibParts(ms: number) {
  const d = new Date(ms + WIB_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}

function validMs(ms: number | null | undefined): ms is number {
  return typeof ms === 'number' && Number.isFinite(ms);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Link for the dashboard (D-8): the home page with ?aff=<code>; '' when there is no code. */
export function affiliateLink(code: string): string {
  const c = (code ?? '').trim();
  return c ? `${SITE_ORIGIN}/?aff=${encodeURIComponent(c)}` : '';
}

/** The same link without the scheme, so a manual long-press copy (E8 copy failure) still yields a working link. */
export function displayLink(code: string): string {
  return affiliateLink(code).replace(/^https:\/\//, '');
}

/** 'Rp87.000': dots for thousands, no space, no decimals; negative or invalid input gives 'Rp0'. */
export function formatRupiah(n: number): string {
  const v = num(n);
  if (v <= 0) return 'Rp0';
  return `Rp${groupThousands(Math.round(v))}`;
}

/** '6 Nov 2026' in WIB; '' for a missing or invalid date. */
export function formatDateShort(ms: number | null | undefined): string {
  if (!validMs(ms)) return '';
  const p = wibParts(ms);
  return `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}`;
}

/** '4 Nov 2026, 14.20' in WIB (table column and transaction detail); '' for a missing date. */
export function formatDateTime(ms: number | null | undefined): string {
  if (!validMs(ms)) return '';
  const p = wibParts(ms);
  return `${p.d} ${MONTHS_SHORT[p.m]} ${p.y}, ${pad2(p.h)}.${pad2(p.min)}`;
}

/** '4 Nov' in WIB (status chip "Cair · 2 Nov" and the date in phone rows); '' for a missing date. */
export function formatDayMonth(ms: number | null | undefined): string {
  if (!validMs(ms)) return '';
  const p = wibParts(ms);
  return `${p.d} ${MONTHS_SHORT[p.m]}`;
}

/** 'YYYY-MM' of the WIB calendar month. */
export function monthKeyOf(ms: number): string {
  const p = wibParts(ms);
  return `${p.y}-${pad2(p.m + 1)}`;
}

function parseKey(key: string): { y: number; m: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? '');
  if (!match) return null;
  const m = Number(match[2]) - 1;
  return m >= 0 && m < 12 ? { y: Number(match[1]), m } : null;
}

/** '2026-11' -> 'November 2026'; 'tanpa-tanggal' -> 'Tanpa tanggal'; '' for anything else. */
export function formatMonthLong(key: string): string {
  if (key === NO_DATE_KEY) return 'Tanpa tanggal';
  const p = parseKey(key);
  return p ? `${MONTHS_LONG[p.m]} ${p.y}` : '';
}

/** '2026-08' -> 'Agu' (chart axis); '' for an invalid key. */
export function formatMonthShort(key: string): string {
  const p = parseKey(key);
  return p ? MONTHS_SHORT[p.m] : '';
}

function addMonths(key: string, delta: number): string {
  const p = parseKey(key)!;
  const total = p.y * 12 + p.m + delta;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

/**
 * Epoch ms from the shapes stored in Firestore and passed by page.tsx: number, ISO string, Date, Timestamp-like
 * `{seconds}` / `{_seconds}` (serialized Admin SDK), or anything with toMillis(). Invalid input gives null.
 */
export function toMillis(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    if (!v.trim()) return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.toMillis === 'function') {
      try {
        const ms = (o.toMillis as () => unknown)();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    const secs = typeof o.seconds === 'number' ? o.seconds : typeof o._seconds === 'number' ? o._seconds : null;
    if (secs !== null && Number.isFinite(secs)) {
      const nanos = typeof o.nanoseconds === 'number' ? o.nanoseconds : typeof o._nanoseconds === 'number' ? o._nanoseconds : 0;
      return secs * 1000 + Math.floor(num(nanos) / 1e6);
    }
  }
  return null;
}

/** '10%' or '7,5%' with the Indonesian decimal comma. */
function formatPercent(v: number): string {
  return `${String(Math.round(v * 100) / 100).replace('.', ',')}%`;
}

/**
 * Chip text from the voucher type and value (E8). A capped percentage voucher says so, because the affiliate repeats
 * this line to buyers. Null for value <= 0 or an unknown type.
 */
export function voucherDiscountLabel(v: AffVoucher): string | null {
  if (!v) return null;
  const value = num(v.value);
  if (value <= 0) return null;
  if (v.type === 'percentage') {
    const cap = num(v.maxDiscount);
    return cap > 0
      ? `Potongan ${formatPercent(value)} (maks ${formatRupiah(cap)}) untuk pembeli`
      : `Potongan ${formatPercent(value)} untuk pembeli`;
  }
  if (v.type === 'fixed') return `Potongan ${formatRupiah(value)} untuk pembeli`;
  return null;
}

/** 'Berlaku s.d. 31 Des 2026' (WIB); null when expiresAt is empty or unreadable. */
export function voucherExpiryLabel(v: AffVoucher): string | null {
  if (!v) return null;
  const ms = toMillis(v.expiresAt);
  if (ms === null || ms <= 0) return null;
  return `Berlaku s.d. ${formatDateShort(ms)}`;
}

export type VoucherState = 'active' | 'expired' | 'inactive' | 'missing';

/**
 * Matches the old isVoucherExpired()/isActive check, plus numeric expiresAt (page.tsx converts Timestamps to ms,
 * which the old check silently treated as "not expired"). A missing isActive counts as inactive, like the old
 * `!voucherData.isActive`. Expired wins over inactive.
 */
export function voucherState(ownCode: string, v: AffVoucher, now: number): VoucherState {
  if (!(ownCode ?? '').trim() || !v) return 'missing';
  const exp = toMillis(v.expiresAt);
  if (exp !== null && exp > 0 && exp < now) return 'expired';
  if (!v.isActive) return 'inactive';
  return 'active';
}

export type Summary = { total: number; paid: number; pending: number; pendingCount: number; count: number; firstMonthKey: string | null };

/** Same arithmetic as the pre-F-023 dashboard (totalAll, totalPaid, totalPending, pending count). */
export function summarize(list: AffCommission[]): Summary {
  let total = 0;
  let paid = 0;
  let pending = 0;
  let pendingCount = 0;
  let first: number | null = null;
  for (const c of list ?? []) {
    const amount = num(c.commissionAmount);
    total += amount;
    if (c.isPaid) paid += amount;
    else {
      pending += amount;
      pendingCount++;
    }
    if (validMs(c.createdAt) && (first === null || c.createdAt < first)) first = c.createdAt;
  }
  return { total, paid, pending, pendingCount, count: (list ?? []).length, firstMonthKey: first === null ? null : monthKeyOf(first) };
}

/** 'Dari 7 transaksi sejak Agustus 2026'; 'Belum ada komisi tercatat.' for none (FR-06a). */
export function summaryCaption(s: Summary): string {
  if (s.count === 0) return 'Belum ada komisi tercatat.';
  return s.firstMonthKey ? `Dari ${s.count} transaksi sejak ${formatMonthLong(s.firstMonthKey)}` : `Dari ${s.count} transaksi`;
}

/** Fractions 0..1 of the split bar; both 0 when there is nothing to split. */
export function splitRatio(s: Summary): { paid: number; pending: number } {
  const paid = Math.max(0, s.paid);
  const pending = Math.max(0, s.pending);
  const total = paid + pending;
  if (total <= 0) return { paid: 0, pending: 0 };
  return { paid: paid / total, pending: pending / total };
}

export type MonthBar = { key: string; label: string; paid: number; pending: number; isCurrent: boolean };

/**
 * One bar per WIB month from the first dated commission up to the current month, empty months kept as 0, at most the
 * last `maxMonths`. Commissions without createdAt, or dated after the current month, have no bar. [] when no
 * commission falls in that range.
 */
export function monthlySeries(list: AffCommission[], now: number, maxMonths = 6): MonthBar[] {
  const current = monthKeyOf(now);
  const sums = new Map<string, { paid: number; pending: number }>();
  let first: string | null = null;
  for (const c of list ?? []) {
    if (!validMs(c.createdAt)) continue;
    const key = monthKeyOf(c.createdAt);
    if (key > current) continue;
    if (first === null || key < first) first = key;
    const s = sums.get(key) ?? { paid: 0, pending: 0 };
    if (c.isPaid) s.paid += num(c.commissionAmount);
    else s.pending += num(c.commissionAmount);
    sums.set(key, s);
  }
  if (first === null || maxMonths < 1) return [];
  const span = (() => {
    const a = parseKey(first)!;
    const b = parseKey(current)!;
    return (b.y - a.y) * 12 + (b.m - a.m) + 1;
  })();
  const count = Math.min(span, Math.floor(maxMonths));
  const bars: MonthBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const key = addMonths(current, -i);
    const s = sums.get(key) ?? { paid: 0, pending: 0 };
    bars.push({ key, label: formatMonthShort(key), paid: s.paid, pending: s.pending, isCurrent: key === current });
  }
  return bars;
}

/** Chart subtitle: 'Agustus–November 2026', 'Desember 2025–Januari 2026', or one month; '' for no bars. */
export function seriesRangeLabel(series: MonthBar[]): string {
  if (!series.length) return '';
  const a = parseKey(series[0].key)!;
  const b = parseKey(series[series.length - 1].key)!;
  if (series.length === 1) return formatMonthLong(series[0].key);
  if (a.y === b.y) return `${MONTHS_LONG[a.m]}–${MONTHS_LONG[b.m]} ${b.y}`;
  return `${formatMonthLong(series[0].key)}–${formatMonthLong(series[series.length - 1].key)}`;
}

/**
 * Headline next to the chart title (E10): the current month's total and a short note, e.g. amount 87000 with
 * 'bulan ini · belum cair'. Mixed months name the unpaid part: 'bulan ini · Rp35.000 belum cair'.
 */
export function currentMonthHeadline(series: MonthBar[]): { amount: number; note: string } {
  const bar = series.find(b => b.isCurrent);
  const paid = bar ? bar.paid : 0;
  const pending = bar ? bar.pending : 0;
  let note = 'bulan ini';
  if (pending > 0 && paid > 0) note += ` · ${formatRupiah(pending)} belum cair`;
  else if (pending > 0) note += ' · belum cair';
  else if (paid > 0) note += ' · sudah cair';
  return { amount: paid + pending, note };
}

/**
 * Axis scale: the tick step is rounded up to 1, 2, 2.5, 3, or 5 x 10^n so the top tick sits just above the tallest
 * bar (87.000 -> 0/30rb/60rb/90rb as in FR-04/FR-05). Steps stay whole rupiah. maxValue <= 0 gives a single 0 tick.
 */
export function chartScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  const v = num(maxValue);
  if (v <= 0) return { max: 0, ticks: [0] };
  const intervals = Math.max(1, Math.floor(num(tickCount)) - 1);
  const raw = v / intervals;
  let step = 1;
  if (raw > 1) {
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const multipliers = mag >= 10 ? [1, 2, 2.5, 3, 5, 10] : [1, 2, 3, 5, 10];
    for (const m of multipliers) {
      const candidate = Math.round(m * mag);
      if (candidate >= raw) {
        step = candidate;
        break;
      }
    }
  }
  const ticks: number[] = [];
  for (let i = 0; i <= intervals; i++) ticks.push(step * i);
  return { max: step * intervals, ticks };
}

function compactNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Compact axis label as drawn in FR-04/FR-05: 'Rp0', 'Rp500', 'Rp90 rb', 'Rp2,5 rb', 'Rp1,5 jt', 'Rp1,2 M'. */
export function formatAxisRupiah(n: number): string {
  const v = Math.round(num(n));
  if (v <= 0) return 'Rp0';
  if (v < 1000) return `Rp${v}`;
  const units: [number, string][] = [[1e9, 'M'], [1e6, 'jt'], [1e3, 'rb']];
  for (let i = 0; i < units.length; i++) {
    const [size, suffix] = units[i];
    if (v < size) continue;
    const scaled = Math.round((v / size) * 100) / 100;
    // 999.999 rounds to "1000 rb"; show it in the next unit instead.
    if (scaled >= 1000 && i > 0) return `Rp${compactNumber(Math.round((v / units[i - 1][0]) * 100) / 100)} ${units[i - 1][1]}`;
    return `Rp${compactNumber(scaled)} ${suffix}`;
  }
  return `Rp${v}`;
}

function itemName(item: AffCommissionItem | undefined): string {
  if (!item) return '';
  const a = typeof item.productName === 'string' ? item.productName.trim() : '';
  if (a) return a;
  return typeof item.name === 'string' ? item.name.trim() : '';
}

function itemQuantity(item: AffCommissionItem): number {
  const q = num(item.quantity);
  return q > 0 ? q : 0;
}

/** Row title: first item name (productName, then legacy `name`), else productName, else 'Produk'; '+n produk lain' for more items. */
export function commissionTitle(c: AffCommission): string {
  const items = Array.isArray(c.items) ? c.items : [];
  const top = typeof c.productName === 'string' ? c.productName.trim() : '';
  const first = itemName(items[0]) || top || 'Produk';
  return items.length > 1 ? `${first} +${items.length - 1} produk lain` : first;
}

/** 'Hitam · 1 pcs': variant of the first item, then total quantity of all items; '' when neither is known. */
export function commissionMeta(c: AffCommission): string {
  const items = Array.isArray(c.items) ? c.items : [];
  if (!items.length) return '';
  const variant = typeof items[0].selectedVariantLabel === 'string' ? items[0].selectedVariantLabel.trim() : '';
  const qty = items.reduce((s, it) => s + itemQuantity(it), 0);
  return [variant, qty > 0 ? `${qty} pcs` : ''].filter(Boolean).join(' · ');
}

/** One line per item for the transaction detail (E12): name and 'Varian · n pcs'; a single line for item-less records. */
export function commissionLines(c: AffCommission): { name: string; meta: string }[] {
  const items = Array.isArray(c.items) ? c.items : [];
  if (!items.length) return [{ name: commissionTitle(c), meta: '' }];
  return items.map(it => {
    const variant = typeof it.selectedVariantLabel === 'string' ? it.selectedVariantLabel.trim() : '';
    const qty = itemQuantity(it);
    return {
      name: itemName(it) || (typeof c.productName === 'string' && c.productName.trim()) || 'Produk',
      meta: [variant, qty > 0 ? `${qty} pcs` : ''].filter(Boolean).join(' · '),
    };
  });
}

/** Message for "Tanya admin soal transaksi ini" (E12); the Order ID lets the admin find the order (D-10). */
export function commissionQuestionText(c: AffCommission, code: string): string {
  const parts = [`Halo Admin INZTA, saya affiliate${(code ?? '').trim() ? ` dengan kode ${code.trim()}` : ''}.`];
  let line = `Saya ingin bertanya soal transaksi ${commissionTitle(c)}`;
  if (c.orderId) line += ` (Order ID #${c.orderId})`;
  const when = formatDateTime(c.createdAt);
  if (when) line += `, ${when}`;
  parts.push(`${line}.`);
  return parts.join(' ');
}

/** wa.me link with a prefilled message, the same shape as the existing links (`https://wa.me/${WA_NUMBER}?text=...`). */
export function whatsappUrl(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function statusCounts(list: AffCommission[]): { all: number; pending: number; paid: number } {
  let paid = 0;
  for (const c of list ?? []) if (c.isPaid) paid++;
  const all = (list ?? []).length;
  return { all, pending: all - paid, paid };
}

export type Filters = { query: string; status: StatusFilter; month: string /* 'all' | 'YYYY-MM' | 'tanpa-tanggal' */ };
export const EMPTY_FILTERS: Filters = Object.freeze({ query: '', status: 'all', month: 'all' }) as Filters;

function commissionMonthKey(c: AffCommission): string {
  return validMs(c.createdAt) ? monthKeyOf(c.createdAt) : NO_DATE_KEY;
}

function searchText(c: AffCommission): string {
  const names = (Array.isArray(c.items) ? c.items : []).flatMap(it => [it?.productName, it?.name]);
  names.push(c.productName);
  return names.filter((n): n is string => typeof n === 'string').join('\n').toLowerCase();
}

/** Client-side filter of the loaded list (E11): partial, case-insensitive product search, status, and month; input order kept. */
export function filterCommissions(list: AffCommission[], f: Filters): AffCommission[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return (list ?? []).filter(c => {
    if (f.status === 'pending' && c.isPaid) return false;
    if (f.status === 'paid' && !c.isPaid) return false;
    if (f.month && f.month !== 'all' && commissionMonthKey(c) !== f.month) return false;
    if (q && !searchText(c).includes(q)) return false;
    return true;
  });
}

export function isFiltered(f: Filters): boolean {
  return (f.query ?? '').trim() !== '' || f.status !== 'all' || (f.month ?? 'all') !== 'all';
}

/** Months that have commissions, newest first, for the month filter (E13). Undated commissions only appear under "Semua bulan". */
export function monthOptions(list: AffCommission[]): { key: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of list ?? []) {
    if (!validMs(c.createdAt)) continue;
    const key = monthKeyOf(c.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map(([key, count]) => ({ key, label: formatMonthLong(key), count }));
}

export type MonthGroup = { key: string; label: string; subtotal: number; items: AffCommission[] };

/** Rows grouped by WIB month with a commission subtotal, newest month first; undated rows last under 'Tanpa tanggal'. */
export function groupByMonth(list: AffCommission[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const c of list ?? []) {
    const key = commissionMonthKey(c);
    let g = groups.get(key);
    if (!g) {
      g = { key, label: formatMonthLong(key), subtotal: 0, items: [] };
      groups.set(key, g);
    }
    g.subtotal += num(c.commissionAmount);
    g.items.push(c);
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === NO_DATE_KEY) return 1;
    if (b.key === NO_DATE_KEY) return -1;
    return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
  });
}

/**
 * E16: true for Firebase Auth errors (code 'auth/...', e.g. an expired, revoked, or malformed session cookie), which
 * send the affiliate back to /affiliate/login. Firestore or network failures (code 14 / 'unavailable', plain Error)
 * return false and go to error.tsx, so a read failure no longer looks like a logout.
 */
export function isSessionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; errorInfo?: { code?: unknown } };
  const code = typeof e.code === 'string' ? e.code : typeof e.errorInfo?.code === 'string' ? e.errorInfo.code : '';
  return code.startsWith('auth/');
}
