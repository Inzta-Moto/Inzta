// F-023 E10-E12: small pure helpers for the commission components (status wording, row meta, chart geometry). Kept out
// of lib/affiliate/dashboard.ts, which the helpers task owns; no React, Firebase, or window here either.
import {
  chartScale,
  commissionMeta,
  formatAxisRupiah,
  formatDayMonth,
  formatRupiah,
  type AffCommission,
  type MonthBar,
} from '@/lib/affiliate/dashboard';

/** Right-hand status text in phone rows: 'Pending' or 'Cair 2 Nov' ('Cair' when paidAt is missing). */
export function rowStatusText(c: AffCommission): string {
  if (!c.isPaid) return 'Pending';
  const day = formatDayMonth(c.paidAt);
  return day ? `Cair ${day}` : 'Cair';
}

/** Table chip text: 'Pending' or 'Cair · 2 Nov' ('Cair' when paidAt is missing). */
export function chipStatusText(c: AffCommission): string {
  if (!c.isPaid) return 'Pending';
  const day = formatDayMonth(c.paidAt);
  return day ? `Cair · ${day}` : 'Cair';
}

/** Phone row meta: variant and quantity, then the order day ('Sepasang · 1 pcs · 4 Nov'). */
export function rowMeta(c: AffCommission): string {
  return [commissionMeta(c), formatDayMonth(c.createdAt)].filter(Boolean).join(' · ');
}

/** Item price, or an en dash when the record has none (Rp0 would read as a free product). */
export function priceText(c: AffCommission): string {
  return typeof c.productPrice === 'number' && Number.isFinite(c.productPrice) && c.productPrice > 0 ? formatRupiah(c.productPrice) : '–';
}

export const CHART_TOP = 34;
export const CHART_PLOT_H = 150;
export const CHART_H = CHART_TOP + CHART_PLOT_H + 34;
/** Below this plot width the value pill uses the short 'Rp87 rb' form and the legend stacks (design narrowChart). */
export const CHART_NARROW = 320;

export type ChartBar = {
  key: string;
  label: string;
  isCurrent: boolean;
  /** Centre of the month slot, for the month label. */
  cx: number;
  x: number;
  w: number;
  /** Paid segment (bottom); h 0 when nothing is paid. */
  paidY: number;
  paidH: number;
  /** Unpaid segment (top); h 0 when nothing is unpaid. */
  pendingY: number;
  pendingH: number;
};

export type ChartLayout = {
  width: number;
  height: number;
  labelW: number;
  baseY: number;
  ticks: { value: number; label: string; y: number }[];
  bars: ChartBar[];
  pill: { x: number; y: number; w: number; label: string } | null;
  narrow: boolean;
};

/** Rough advance width of 12 px Figtree semibold digits and letters; only sizes the axis column and the pill. */
function approxWidth(text: string, perChar: number): number {
  return text.length * perChar;
}

/**
 * Pixel geometry of the stacked month bars for a measured width (FR-04/FR-05 numbers from build-figcraft.mjs: 34 px
 * headroom for the value pill, 150 px plot, bars at most 44 px or 46% of a slot). Width 0 gives an empty layout, so
 * the server render and the first client render match before the chart is measured.
 */
export function chartLayout(series: MonthBar[], width: number): ChartLayout {
  const w = Math.max(0, Math.floor(width));
  const baseY = CHART_TOP + CHART_PLOT_H;
  const empty: ChartLayout = { width: w, height: CHART_H, labelW: 0, baseY, ticks: [], bars: [], pill: null, narrow: w < CHART_NARROW };
  if (!w || !series.length) return empty;

  const maxTotal = Math.max(0, ...series.map((b) => b.paid + b.pending));
  const scale = chartScale(maxTotal);
  const max = scale.max > 0 ? scale.max : 1;
  const yOf = (v: number) => baseY - Math.round((CHART_PLOT_H * v) / max);
  const ticks = scale.ticks.map((value) => ({ value, label: formatAxisRupiah(value), y: yOf(value) }));
  const labelW = Math.min(76, Math.max(40, Math.round(Math.max(...ticks.map((t) => approxWidth(t.label, 6.2))) + 8)));
  const plotW = Math.max(0, w - labelW);
  const slot = plotW / series.length;
  const bw = Math.max(8, Math.min(44, Math.round(slot * 0.46)));
  const narrow = w < CHART_NARROW;
  // A non-zero value never disappears into the baseline.
  const hOf = (v: number) => (v > 0 ? Math.max(2, Math.round((CHART_PLOT_H * v) / max)) : 0);

  const bars: ChartBar[] = series.map((b, i) => {
    const x = Math.round(labelW + i * slot + (slot - bw) / 2);
    const paidH = hOf(b.paid);
    const pendingH = hOf(b.pending);
    return {
      key: b.key,
      label: b.label,
      isCurrent: b.isCurrent,
      cx: Math.round(labelW + i * slot + slot / 2),
      x,
      w: bw,
      paidY: baseY - paidH,
      paidH,
      pendingY: baseY - paidH - pendingH,
      pendingH,
    };
  });

  let pill: ChartLayout['pill'] = null;
  const ci = series.findIndex((b) => b.isCurrent);
  if (ci >= 0) {
    const total = series[ci].paid + series[ci].pending;
    if (total > 0) {
      const label = narrow ? formatAxisRupiah(total) : formatRupiah(total);
      const pw = Math.round(narrow ? approxWidth(label, 6.8) + 16 : approxWidth(label, 7.2) + 26);
      const bar = bars[ci];
      const x = Math.max(labelW, Math.min(Math.round(bar.x + bar.w / 2 - pw / 2), w - pw));
      pill = { x, y: bar.pendingY - 34, w: pw, label };
    }
  }

  return { width: w, height: CHART_H, labelW, baseY, ticks, bars, pill, narrow };
}

/** SVG path of a bar with rounded top corners (radius 10 at most) and a square bottom on the baseline. */
export function roundedTopPath(x: number, y: number, w: number, h: number, radius = 10): string {
  const r = Math.max(0, Math.min(radius, w / 2, h));
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
