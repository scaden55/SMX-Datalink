import { memo, useRef, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { FinancialKPIs, PeriodPnlEntry } from '@/types/dashboard';
import { BarTrend } from './MiniCharts';

// ── Formatting helpers ───────────────────────────────────────

function fmt(n: number, prefix = '$'): string {
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

function fmtFull(n: number): string {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtAxis(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Smooth cubic bezier path builder ─────────────────────────

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  // Catmull-Rom → cubic bezier, very low tension for subtle rounding
  const d: string[] = [`M${pts[0][0]},${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const t = 0.05; // minimal tension — nearly straight with barely perceptible rounding
    const cp1x = p1[0] + (p2[0] - p0[0]) * t;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t;
    d.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`);
  }
  return d.join(' ');
}

// ── Nice Y-axis tick generation ──────────────────────────────

function niceScale(min: number, max: number, targetTicks = 5): number[] {
  const range = max - min || 1;
  const roughStep = range / targetTicks;
  // Find a "nice" step: 1, 2, 5, 10, 20, 50, 100, ...
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / mag;
  const niceStep = residual <= 1.5 ? mag : residual <= 3.5 ? 2 * mag : residual <= 7.5 ? 5 * mag : 10 * mag;

  const ticks: number[] = [];
  const start = Math.floor(min / niceStep) * niceStep;
  for (let v = start; v <= max + niceStep * 0.01; v += niceStep) {
    ticks.push(v);
  }
  return ticks;
}

// ── P&L Line Chart — smooth, polished, edge-to-edge ─────────

interface PLChartProps {
  netData: number[];
  labels: string[];
  height?: number;
}

function PLLineChart({ netData, labels, height = 140 }: PLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalW, setTotalW] = useState(400);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setTotalW(Math.round(entry.contentRect.width));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (netData.length < 2) {
    return (
      <div ref={containerRef} className="flex items-center justify-center rounded-md bg-[var(--surface-2)]" style={{ height }}>
        <span className="text-[11px] text-[var(--text-quaternary)]">No financial data yet</span>
      </div>
    );
  }

  const leftPad = 38;
  const rightPad = 6;
  const topPad = 10;
  const bottomPad = 18;
  const chartW = totalW - leftPad - rightPad;
  const chartH = height - topPad - bottomPad;

  const dataMin = Math.min(...netData);
  const dataMax = Math.max(...netData);
  // Pad range by 10% so the line doesn't kiss edges
  const pad = (dataMax - dataMin) * 0.1 || 500;
  const rangeMin = dataMin - pad;
  const rangeMax = dataMax + pad;
  const range = rangeMax - rangeMin;

  const toY = (v: number) => topPad + ((rangeMax - v) / range) * chartH;
  const toX = (i: number) => leftPad + (i / (netData.length - 1)) * chartW;

  // Build smooth bezier path
  const pts: [number, number][] = netData.map((v, i) => [toX(i), toY(v)]);
  const linePath = smoothPath(pts);

  // Fill path: line path + close back along chart bottom
  const baseY = topPad + chartH;
  const fillPath = `${linePath} L${pts[pts.length - 1][0]},${baseY} L${pts[0][0]},${baseY} Z`;

  // Y-axis ticks
  const ticks = niceScale(rangeMin, rangeMax, 4);

  // X-axis labels — evenly distributed
  const xLabelIndices: number[] = [];
  if (labels.length <= 7) {
    labels.forEach((_, i) => xLabelIndices.push(i));
  } else {
    const step = Math.ceil(labels.length / 6);
    for (let i = 0; i < labels.length; i += step) xLabelIndices.push(i);
    if (xLabelIndices[xLabelIndices.length - 1] !== labels.length - 1) {
      xLabelIndices.push(labels.length - 1);
    }
  }

  // Colors
  const posColor = 'var(--accent-emerald)';
  const negColor = 'var(--accent-red)';
  const endColor = netData[netData.length - 1] >= 0 ? posColor : negColor;

  // Zero-crossing points (for dots + fill split)
  const zeroY = toY(0);
  const zeroCrossings: { x: number; y: number }[] = [];
  for (let i = 0; i < netData.length - 1; i++) {
    if ((netData[i] >= 0 && netData[i + 1] < 0) || (netData[i] < 0 && netData[i + 1] >= 0)) {
      const t = netData[i] / (netData[i] - netData[i + 1]);
      const cx = toX(i) + t * (toX(i + 1) - toX(i));
      zeroCrossings.push({ x: cx, y: zeroY });
    }
  }

  // Build fill segments split at each crossing X (full height, colored by sign)
  const crossingXs = zeroCrossings.map(c => c.x);
  const segBounds = [0, ...crossingXs, totalW];
  const fillSegments: { x1: number; x2: number; positive: boolean }[] = [];
  for (let i = 0; i < segBounds.length - 1; i++) {
    const midX = (segBounds[i] + segBounds[i + 1]) / 2;
    // Sample data value at midX
    const midFrac = Math.max(0, Math.min(1, (midX - leftPad) / chartW));
    const midIdx = midFrac * (netData.length - 1);
    const lo = Math.floor(midIdx);
    const hi = Math.min(Math.ceil(midIdx), netData.length - 1);
    const f = midIdx - lo;
    const midVal = netData[lo] * (1 - f) + netData[hi] * f;
    fillSegments.push({ x1: segBounds[i], x2: segBounds[i + 1], positive: midVal >= 0 });
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${totalW} ${height}`}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="pl-fill-pos" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={posColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={posColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="pl-fill-neg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={negColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={negColor} stopOpacity="0" />
        </linearGradient>
        <clipPath id="clip-above-zero">
          <rect x="0" y="0" width={totalW} height={zeroY} />
        </clipPath>
        <clipPath id="clip-below-zero">
          <rect x="0" y={zeroY} width={totalW} height={height - zeroY} />
        </clipPath>
        {fillSegments.map((seg, i) => (
          <clipPath key={`fill-clip-${i}`} id={`fill-clip-${i}`}>
            <rect x={seg.x1} y="0" width={seg.x2 - seg.x1} height={height} />
          </clipPath>
        ))}
      </defs>

      {/* Horizontal grid lines + Y-axis labels */}
      {ticks.map((tick, i) => {
        const y = toY(tick);
        if (y < topPad - 2 || y > topPad + chartH + 2) return null;
        const isZero = tick === 0;
        return (
          <g key={i}>
            <line
              x1={leftPad} y1={y} x2={totalW - rightPad} y2={y}
              stroke={isZero ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}
              strokeWidth={isZero ? 0.75 : 0.5}
            />
            <text
              x={leftPad - 6} y={y + 3}
              textAnchor="end"
              fill="var(--text-quaternary)"
              fontSize="8"
              fontFamily="var(--font-mono)"
            >
              {fmtAxis(tick)}
            </text>
          </g>
        );
      })}

      {/* Gradient fills — split vertically at crossing X, full height each side */}
      {fillSegments.map((seg, i) => (
        <g key={`fill-${i}`} clipPath={`url(#fill-clip-${i})`}>
          <path d={fillPath} fill={seg.positive ? 'url(#pl-fill-pos)' : 'url(#pl-fill-neg)'} />
        </g>
      ))}

      {/* Line stroke — split horizontally at zero Y so color changes at crossing */}
      <g clipPath="url(#clip-above-zero)">
        <path d={linePath} fill="none" stroke={posColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g clipPath="url(#clip-below-zero)">
        <path d={linePath} fill="none" stroke={negColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Zero-crossing dots */}
      {zeroCrossings.map((c, i) => (
        <g key={`zero-${i}`}>
          <circle cx={c.x} cy={c.y} r="3.5" fill="white" opacity="0.08" />
          <circle cx={c.x} cy={c.y} r="2" fill="var(--text-secondary)" />
        </g>
      ))}

      {/* End dot */}
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={endColor}
        opacity="0.15"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="2"
        fill={endColor}
      />

      {/* X-axis labels */}
      {xLabelIndices.map((idx) => (
        <text
          key={idx}
          x={toX(idx)}
          y={height - 2}
          textAnchor="middle"
          fill="var(--text-quaternary)"
          fontSize="8"
          fontFamily="var(--font-mono)"
        >
          {labels[idx]}
        </text>
      ))}

      {/* Hover crosshair + tooltip */}
      {hoverIdx !== null && (
        <g>
          {/* Vertical crosshair line */}
          <line
            x1={toX(hoverIdx)} y1={topPad}
            x2={toX(hoverIdx)} y2={topPad + chartH}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1"
          />
          {/* Highlighted dot */}
          <circle
            cx={toX(hoverIdx)} cy={toY(netData[hoverIdx])}
            r="4" fill={netData[hoverIdx] >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
            opacity="0.25"
          />
          <circle
            cx={toX(hoverIdx)} cy={toY(netData[hoverIdx])}
            r="2.5" fill={netData[hoverIdx] >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
          />
          {/* Tooltip background + text */}
          {(() => {
            const flipLeft = hoverIdx > netData.length / 2;
            const rectX = flipLeft ? toX(hoverIdx) - 72 : toX(hoverIdx) + 8;
            const textX = rectX + 32;
            return (
              <>
                <rect
                  x={rectX}
                  y={toY(netData[hoverIdx]) - 24}
                  width="64" height="20" rx="3"
                  fill="var(--surface-3)" stroke="var(--border-secondary)" strokeWidth="0.5"
                />
                <text
                  x={textX}
                  y={toY(netData[hoverIdx]) - 11}
                  textAnchor="middle"
                  fill={netData[hoverIdx] >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'}
                  fontSize="9" fontFamily="var(--font-mono)" fontWeight="600"
                >
                  {netData[hoverIdx] >= 0 ? '+' : ''}{fmtFull(netData[hoverIdx])}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Invisible hover zones for each data point */}
      {netData.map((_, i) => {
        const sliceW = chartW / (netData.length - 1);
        return (
          <rect
            key={i}
            x={toX(i) - sliceW / 2}
            y={0}
            width={sliceW}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{ cursor: 'crosshair' }}
          />
        );
      })}
    </svg>
    </div>
  );
}

// ── RATM/CATM thin bar chart (hairline bars, two rows) ──────

function RatmCatmBars({ ratmData, catmData, height = 80 }: { ratmData: number[]; catmData: number[]; height?: number }) {
  const len = Math.max(ratmData.length, catmData.length);
  if (len === 0) return null;

  const rowH = Math.floor(height / 2);
  const rMax = Math.max(...ratmData, 0.01);
  const cMax = Math.max(...catmData, 0.01);

  const BarRow = ({ data, max, color, opacity, flip }: {
    data: number[]; max: number; color: string; opacity: number; flip?: boolean;
  }) => (
    <div className="flex justify-center" style={{ height: rowH, gap: '2px', alignItems: flip ? 'flex-start' : 'flex-end' }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${(v / max) * 100}%`,
            background: color,
            opacity,
            minHeight: v > 0 ? 1 : 0,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );

  return (
    <div>
      <BarRow data={ratmData} max={rMax} color="var(--accent-emerald)" opacity={0.6} />
      <BarRow data={catmData} max={cMax} color="var(--accent-blue)" opacity={0.4} flip />
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-quaternary)] font-display">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--divider)]" />
    </div>
  );
}

// ── Metric row ───────────────────────────────────────────────

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[12px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
      <span className="font-mono text-[13px] font-medium tabular-nums" style={{ color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Cost bar ─────────────────────────────────────────────────

function CostBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">{value}</span>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--border-primary)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

interface FinanceCardProps {
  data: FinancialKPIs;
  periodPnl?: PeriodPnlEntry[];
}

export const FinanceCard = memo(function FinanceCard({ data, periodPnl }: FinanceCardProps) {
  const { balance, costs, profitability } = data;

  // Period P&L: ordered DESC from API, reverse for chronological charts
  const chronoPnl = periodPnl ? [...periodPnl].reverse() : [];
  const latestPeriod = periodPnl && periodPnl.length > 0 ? periodPnl[0] : null;
  const prevPeriod = periodPnl && periodPnl.length > 1 ? periodPnl[1] : null;

  // ── P&L headline numbers ─────────────────────────────────
  const hasAnyData = latestPeriod || balance.totalIncome > 0 || balance.totalExpenses > 0;
  const totalRevenue = latestPeriod ? latestPeriod.totalRevenue : balance.totalIncome > 0 ? balance.totalIncome : 33100;
  const totalExpenses = latestPeriod ? (latestPeriod.totalDoc + latestPeriod.totalFixed) : balance.totalExpenses > 0 ? balance.totalExpenses : 26800;
  const netPL = totalRevenue - totalExpenses;

  // Revenue trend direction
  const prevRevenue = prevPeriod ? prevPeriod.totalRevenue : hasAnyData ? 0 : 27800;
  const revenueDelta = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // ── Chart data (with mock fallback) ─────────────────────────
  // Mock data — realistic cargo airline net P&L with natural trends
  // Slow recovery from a rough Q2, steady climb through peak season, slight dip at year-end
  const MOCK_NET    = [-1200, -800, -1400, -400, 600, 1100, 1800, 2400, 3100, 2700, 4200, 6300];
  const MOCK_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  const netData = chronoPnl.length > 0
    ? chronoPnl.map(p => p.netIncome)
    : balance.months.length > 0
      ? balance.months.map(m => m.income - m.expenses)
      : MOCK_NET;
  const chartLabels = chronoPnl.length > 0
    ? chronoPnl.map(p => p.periodKey)
    : balance.months.length > 0
      ? balance.months.map(m => m.label)
      : MOCK_LABELS;

  // ── Cost breakdown ────────────────────────────────────────
  const totalFlights = latestPeriod?.totalFlights ?? (data.revenue.totalFlights || 47);
  const avgBlockHrs = latestPeriod?.avgUtilizationHrs ?? 3;

  const fuelCostCalc = costs.fuelPerBlockHour * totalFlights * avgBlockHrs;
  const crewCostCalc = costs.crewPerBlockHour * totalFlights * avgBlockHrs;
  const maintCostCalc = costs.maintByTail.reduce((sum, t) => sum + t.costPerCycle * t.cycles, 0);

  // Use calculated values or mock data
  const fuelCost = fuelCostCalc > 0 ? fuelCostCalc : 11200;
  const crewCost = crewCostCalc > 0 ? crewCostCalc : 6400;
  const maintCost = maintCostCalc > 0 ? maintCostCalc : 4800;
  const landingHandling = fuelCostCalc > 0
    ? Math.max(0, totalExpenses - (fuelCostCalc + crewCostCalc + maintCostCalc))
    : 4400;
  const maxCost = Math.max(fuelCost, crewCost, maintCost, landingHandling, 1);

  // ── RATM / CATM ──────────────────────────────────────────
  const ratm = (latestPeriod && latestPeriod.ratm > 0 ? latestPeriod.ratm : profitability.ratm) || 0.42;
  const catm = (latestPeriod && latestPeriod.catm > 0 ? latestPeriod.catm : profitability.catm) || 0.34;
  const spread = ratm - catm;

  // Per-flight granular mock data — ~50 flights for dense thin bars
  const MOCK_RATM_TREND = [
    0.31, 0.35, 0.28, 0.38, 0.33, 0.29, 0.36, 0.40, 0.34, 0.27,
    0.39, 0.32, 0.41, 0.30, 0.37, 0.44, 0.35, 0.29, 0.42, 0.38,
    0.33, 0.45, 0.36, 0.31, 0.40, 0.43, 0.37, 0.47, 0.34, 0.41,
    0.39, 0.46, 0.35, 0.42, 0.48, 0.38, 0.44, 0.40, 0.50, 0.43,
    0.37, 0.46, 0.41, 0.49, 0.44, 0.39, 0.47, 0.42, 0.45, 0.42,
  ];
  const MOCK_CATM_TREND = [
    0.36, 0.33, 0.38, 0.31, 0.35, 0.39, 0.32, 0.30, 0.37, 0.41,
    0.34, 0.36, 0.29, 0.38, 0.33, 0.27, 0.35, 0.40, 0.32, 0.34,
    0.37, 0.28, 0.33, 0.39, 0.31, 0.30, 0.35, 0.26, 0.34, 0.32,
    0.33, 0.27, 0.36, 0.31, 0.25, 0.34, 0.29, 0.33, 0.24, 0.30,
    0.35, 0.28, 0.32, 0.26, 0.30, 0.34, 0.27, 0.31, 0.29, 0.34,
  ];
  const ratmTrend = chronoPnl.length > 0 ? chronoPnl.map(p => p.ratm) : (profitability.ratmTrend?.length ? profitability.ratmTrend : MOCK_RATM_TREND);
  const catmTrend = chronoPnl.length > 0 ? chronoPnl.map(p => p.catm) : (profitability.catmTrend?.length ? profitability.catmTrend : MOCK_CATM_TREND);

  // ── Cash position / burn rate ─────────────────────────────
  const cashBalance = balance.netBalance || 142800;
  const monthlyBurn = chronoPnl.length >= 2
    ? chronoPnl.reduce((sum, p) => sum + (p.totalDoc + p.totalFixed - p.totalRevenue), 0) / chronoPnl.length
    : totalExpenses - totalRevenue;
  const burnRate = monthlyBurn > 0 ? monthlyBurn : 0;
  const runwayMonths = burnRate > 0 ? Math.floor(cashBalance / burnRate) : null;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-display font-display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
            Finance
          </h3>
          {!latestPeriod && <span className="font-mono text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Sample</span>}
        </div>
        <span className="text-[10px] text-[var(--text-quaternary)] font-mono tabular-nums">
          {latestPeriod?.periodKey ?? new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </span>
      </div>

      {/* ── Balance headline + revenue/expenses + chart ─────── */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-[10px] text-[var(--text-quaternary)]" style={{ fontFamily: 'var(--font-display)' }}>Balance</span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[18px] font-bold tabular-nums leading-tight text-[var(--text-primary)]">
              ${Math.abs(cashBalance).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            {burnRate > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--accent-red)]">
                <TrendingDown size={10} />
                <span className="font-mono tabular-nums">{fmt(burnRate)}/mo</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--accent-emerald)]">
                <TrendingUp size={10} />
                <span style={{ fontFamily: 'var(--font-display)' }}>Net positive</span>
              </span>
            )}
          </div>
        </div>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: 'auto auto auto' }}>
          <span className="text-[10px] text-[var(--text-tertiary)] self-center" style={{ fontFamily: 'var(--font-display)' }}>Revenue</span>
          <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--accent-emerald)] self-center">
            {fmt(totalRevenue)}
          </span>
          <span className="self-center">
            {revenueDelta !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono tabular-nums ${revenueDelta > 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
                {revenueDelta > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {Math.abs(revenueDelta).toFixed(0)}%
              </span>
            )}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] self-center" style={{ fontFamily: 'var(--font-display)' }}>Expenses</span>
          <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--accent-red)] self-center">
            {fmt(totalExpenses)}
          </span>
          <span />
        </div>
      </div>
      <div style={{ marginLeft: -8, marginRight: -8 }}>
        <PLLineChart
          netData={netData}
          labels={chartLabels}
          height={110}
        />
      </div>

      {/* ── Cost Breakdown ─────────────────────────────────── */}
      <SectionLabel>Cost Breakdown</SectionLabel>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <CostBar label="Fuel" value={fmt(fuelCost)} pct={(fuelCost / maxCost) * 100} color="var(--accent-amber)" />
        <CostBar label="Maintenance" value={fmt(maintCost)} pct={(maintCost / maxCost) * 100} color="var(--accent-cyan)" />
        <CostBar label="Crew" value={fmt(crewCost)} pct={(crewCost / maxCost) * 100} color="var(--accent-blue)" />
        <CostBar label="Landing / Handling" value={fmt(landingHandling)} pct={(landingHandling / maxCost) * 100} color="var(--text-tertiary)" />
      </div>

      {/* ── Per-Flight Economics (inline layout) ────────── */}
      <SectionLabel>Per-Flight Economics</SectionLabel>

      <div className="flex items-center gap-3">
        {/* Left: RATM */}
        <div className="flex-shrink-0">
          <div className="font-mono text-[14px] font-bold tabular-nums text-[var(--accent-emerald)] leading-none">
            ${ratm.toFixed(2)}
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>RATM</span>
        </div>

        {/* Center: Bar chart */}
        <div className="flex-1 min-w-0">
          <RatmCatmBars ratmData={ratmTrend} catmData={catmTrend} height={40} />
        </div>

        {/* Right: CATM */}
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[14px] font-bold tabular-nums text-[var(--accent-blue)] leading-none">
            ${catm.toFixed(2)}
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--font-display)' }}>CATM</span>
        </div>
      </div>

      {/* Spread (small, beneath) */}
      <div className="flex justify-center">
        <span className={`font-mono text-[11px] font-medium tabular-nums ${spread >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-red)]'}`}>
          {spread >= 0 ? '+' : ''}${spread.toFixed(2)}/tm
        </span>
      </div>

    </div>
  );
});
