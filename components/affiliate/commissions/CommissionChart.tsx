'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { currentMonthHeadline, formatMonthLong, formatRupiah, seriesRangeLabel, type MonthBar } from '@/lib/affiliate/dashboard';
import { CHART_H, chartLayout, roundedTopPath } from './model';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Monthly commission chart (E10): stacked bars per WIB month (paid green at the bottom, unpaid kuning on top), Rp axis
 * on the left, dashed gridlines, a solid baseline, month names (current month bold), and a dark value pill over the
 * current month. No growth percentages. The SVG is drawn in measured pixels so 12 px labels stay 12 px at 320 px and
 * at 1440 px; it is hidden from screen readers, which get the table underneath instead.
 *
 * `series` comes from monthlySeries(commissions, now) with `now` from the server render, so the server and the first
 * client render agree on the current month. An empty series shows the dashed placeholder of E14.
 */
export default function CommissionChart({ series }: { series: MonthBar[] }) {
  if (!series.length) {
    return (
      <div className="iz-aff-card iz-aff-chart">
        <div className="iz-aff-chart__head">
          <div className="iz-aff-chart__titles">
            <h3 className="iz-aff-chart__title">Komisi per bulan</h3>
          </div>
        </div>
        <div className="iz-aff-chart__empty">
          <p className="iz-aff-chart__empty-title">Grafik muncul setelah komisi pertama tercatat.</p>
          <p className="iz-aff-chart__empty-sub">Setiap batang = total komisi satu bulan.</p>
        </div>
      </div>
    );
  }
  return <FilledChart series={series} />;
}

function FilledChart({ series }: { series: MonthBar[] }) {
  const plotRef = useRef<HTMLDivElement>(null);
  // 0 until measured: the server render and the hydration render draw only the reserved box, then the layout effect
  // measures before the first paint.
  const [width, setWidth] = useState(0);

  useIsoLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => chartLayout(series, width), [series, width]);
  const headline = currentMonthHeadline(series);

  return (
    <div className="iz-aff-card iz-aff-chart">
      <div className="iz-aff-chart__head">
        <div className="iz-aff-chart__titles">
          <h3 className="iz-aff-chart__title">Komisi per bulan</h3>
          <p className="iz-aff-chart__range">{seriesRangeLabel(series)}</p>
        </div>
        <ul className="iz-aff-chart__legend" aria-hidden="true">
          <li>
            <span className="iz-aff-chart__key iz-aff-chart__key--paid" />
            Cair
          </li>
          <li>
            <span className="iz-aff-chart__key iz-aff-chart__key--pending" />
            Belum
          </li>
        </ul>
      </div>

      <p className="iz-aff-chart__headline">
        <span className="iz-aff-chart__amount iz-aff-num">{formatRupiah(headline.amount)}</span>{' '}
        <span className="iz-aff-chart__note">{headline.note}</span>
      </p>

      <div ref={plotRef} className="iz-aff-chart__plot" style={{ height: CHART_H }}>
        {layout.width > 0 && (
          <svg className="iz-aff-chart__svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
            {layout.ticks.map((t) => (
              <g key={t.value}>
                <line
                  className={t.value === 0 ? 'iz-aff-chart__base' : 'iz-aff-chart__grid'}
                  x1={layout.labelW}
                  x2={layout.width}
                  y1={t.y + 0.5}
                  y2={t.y + 0.5}
                />
                <text className="iz-aff-chart__axis" x={0} y={t.y + 4}>
                  {t.label}
                </text>
              </g>
            ))}
            {layout.bars.map((b) => (
              <g key={b.key}>
                {b.paidH > 0 && (
                  b.pendingH > 0 ? (
                    <rect className={`iz-aff-chart__bar-paid${b.isCurrent ? '' : ' iz-aff-chart__bar--past'}`} x={b.x} y={b.paidY} width={b.w} height={b.paidH} />
                  ) : (
                    <path className={`iz-aff-chart__bar-paid${b.isCurrent ? '' : ' iz-aff-chart__bar--past'}`} d={roundedTopPath(b.x, b.paidY, b.w, b.paidH)} />
                  )
                )}
                {b.pendingH > 0 && <path className="iz-aff-chart__bar-pending" d={roundedTopPath(b.x, b.pendingY, b.w, b.pendingH)} />}
                <text className={`iz-aff-chart__month${b.isCurrent ? ' iz-aff-chart__month--current' : ''}`} x={b.cx} y={layout.baseY + 24} textAnchor="middle">
                  {b.label}
                </text>
              </g>
            ))}
            {layout.pill && (
              <g>
                <rect className="iz-aff-chart__pill" x={layout.pill.x} y={layout.pill.y} width={layout.pill.w} height={26} rx={8} />
                <text className="iz-aff-chart__pill-text" x={layout.pill.x + layout.pill.w / 2} y={layout.pill.y + 17} textAnchor="middle">
                  {layout.pill.label}
                </text>
              </g>
            )}
          </svg>
        )}
      </div>

      <table className="iz-aff-sr-only">
        <caption>Komisi per bulan, {seriesRangeLabel(series)}</caption>
        <thead>
          <tr>
            <th scope="col">Bulan</th>
            <th scope="col">Sudah cair</th>
            <th scope="col">Belum cair</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {series.map((b) => (
            <tr key={b.key}>
              <th scope="row">
                {formatMonthLong(b.key)}
                {b.isCurrent ? ' (bulan ini)' : ''}
              </th>
              <td>{formatRupiah(b.paid)}</td>
              <td>{formatRupiah(b.pending)}</td>
              <td>{formatRupiah(b.paid + b.pending)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
