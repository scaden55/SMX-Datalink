import { memo } from 'react';
import type { FinancialKPIs, PeriodPnlEntry, RouteMarginEntry } from '../../types/dashboard';
import { AreaChart, BarTrend, Sparkline } from './MiniCharts';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

function fmt(n: number, prefix = '$'): string {
  if (Math.abs(n) >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

interface FinanceColumnProps {
  data: FinancialKPIs;
  periodPnl?: PeriodPnlEntry[];
  routeMargins?: RouteMarginEntry[];
}

export const FinanceColumn = memo(function FinanceColumn({ data, periodPnl, routeMargins }: FinanceColumnProps) {
  const { balance, revenue, costs, profitability, network } = data;

  // Use period P&L data when available (pre-computed RATM/CATM from finance_period_pnl)
  const latestPeriod = periodPnl && periodPnl.length > 0 ? periodPnl[0] : null;
  // Period P&L is ordered DESC, reverse for chronological sparklines
  const chronologicalPnl = periodPnl ? [...periodPnl].reverse() : [];

  // RATM / CATM: prefer period P&L values, fall back to computed
  const ratmValue = latestPeriod && latestPeriod.ratm > 0
    ? latestPeriod.ratm
    : (profitability.ratm > 0 ? balance.totalIncome / profitability.ratm : 0);
  const catmValue = latestPeriod && latestPeriod.catm > 0
    ? latestPeriod.catm
    : (profitability.catm > 0 ? balance.totalExpenses / profitability.catm : 0);
  const spread = ratmValue - catmValue;
  const spreadPct = ratmValue > 0 ? (spread / ratmValue) * 100 : 0;

  // RATM/CATM trend from period P&L history
  const ratmTrendData = chronologicalPnl.length > 0
    ? chronologicalPnl.map(p => p.ratm)
    : (profitability.ratmTrend ?? []);
  const catmTrendData = chronologicalPnl.length > 0
    ? chronologicalPnl.map(p => p.catm)
    : (profitability.catmTrend ?? []);

  // Route margins: prefer dashboard routeMargins, fall back to profitability.marginByRoute
  let displayRoutes: { route: string; marginPct: number }[];
  if (routeMargins && routeMargins.length > 0) {
    // Show top 2 + bottom 2
    const top2 = routeMargins.slice(0, 2).map(r => ({
      route: `${r.depIcao}-${r.arrIcao}`,
      marginPct: r.avgMarginPct,
    }));
    const bottom2 = routeMargins.slice(-2).map(r => ({
      route: `${r.depIcao}-${r.arrIcao}`,
      marginPct: r.avgMarginPct,
    }));
    // Deduplicate if fewer than 4 routes
    const seen = new Set<string>();
    displayRoutes = [...top2, ...bottom2].filter(r => {
      if (seen.has(r.route)) return false;
      seen.add(r.route);
      return true;
    }).slice(0, 4);
  } else {
    const sorted = [...profitability.marginByRoute].sort((a, b) => b.marginPct - a.marginPct);
    displayRoutes = [...sorted.slice(0, 2), ...sorted.slice(-2)]
      .slice(0, 4)
      .map(r => ({ route: r.route, marginPct: r.marginPct }));
  }

  // Yield trend: prefer period P&L revenue for sparkline, fall back to network yieldTrend
  const yieldData = chronologicalPnl.length > 0
    ? chronologicalPnl.map(p => p.totalRevenue)
    : network.yieldTrend.map(y => y.yield);
  const yieldLabels = chronologicalPnl.length > 0
    ? [chronologicalPnl[0].periodKey, chronologicalPnl[chronologicalPnl.length - 1].periodKey]
    : network.yieldTrend.length > 0
      ? [network.yieldTrend[0].label, network.yieldTrend[network.yieldTrend.length - 1].label]
      : [];

  // Key metrics: prefer period P&L values when available
  const totalFlights = latestPeriod ? latestPeriod.totalFlights : revenue.totalFlights;
  const loadFactor = latestPeriod && latestPeriod.avgLoadFactor > 0
    ? latestPeriod.avgLoadFactor
    : revenue.fleetAvgLoadFactor;

  return (
    <div className="flex flex-col gap-4 overflow-hidden pt-0.5">
      {/* Header */}
      <div>
        <div className="font-semibold" style={{ color: '#f0f0f0', fontSize: 18, lineHeight: 1.15 }}>
          Airline<br />Performance
        </div>
        <div className="mt-1" style={{ color: '#4a4a4a', fontSize: 11 }}>
          {new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
        </div>
      </div>

      {/* Balance */}
      <div>
        <AreaChart data={balance.months.map(m => m.income - m.expenses)} height={48} />
        <div className="mt-1.5" style={{ color: '#5a5a5a', fontSize: 10 }}>Balance</div>
        <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 24, lineHeight: 1 }}>
          {fmt(balance.netBalance)}
        </div>
        <div className="flex gap-3 mt-1">
          <div>
            <span style={{ color: '#4a4a4a', fontSize: 9 }}>Income</span>
            <div className="font-mono" style={{ color: '#4ade80', fontSize: 13 }}>+{fmt(balance.totalIncome)}</div>
          </div>
          <div>
            <span style={{ color: '#4a4a4a', fontSize: 9 }}>Expenses</span>
            <div className="font-mono" style={{ color: '#f87171', fontSize: 13 }}>-{fmt(balance.totalExpenses)}</div>
          </div>
        </div>
      </div>

      {/* RATM + CATM side by side */}
      <div className="flex gap-4">
        <div className="flex-1">
          <BarTrend data={ratmTrendData} color="#4ade80" height={32} />
          <div className="mt-1.5" style={{ color: '#5a5a5a', fontSize: 10 }}>RATM</div>
          <div className="font-mono font-semibold" style={{ color: '#4ade80', fontSize: 20, lineHeight: 1 }}>
            ${ratmValue.toFixed(2)}
          </div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>/ton-mi</div>
        </div>
        <div className="flex-1">
          <BarTrend data={catmTrendData} color="#4F6CCD" height={32} />
          <div className="mt-1.5" style={{ color: '#5a5a5a', fontSize: 10 }}>CATM</div>
          <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 20, lineHeight: 1 }}>
            ${catmValue.toFixed(2)}
          </div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>/ton-mi</div>
        </div>
      </div>

      {/* Spread */}
      <div>
        <div style={{ color: '#5a5a5a', fontSize: 10 }}>Spread</div>
        <div className="font-mono font-semibold" style={{ color: spread >= 0 ? '#4ade80' : '#f87171', fontSize: 17, lineHeight: 1 }}>
          {spread >= 0 ? '+' : ''}{fmt(spread)}{' '}
          <span style={{ color: '#4a4a4a', fontSize: 10, fontWeight: 400 }}>/tm · {spreadPct.toFixed(1)}%</span>
        </div>
      </div>

      <Divider />

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3" style={{ gap: '8px 10px' }}>
        {[
          { label: 'RTM', value: fmt(revenue.totalRtm, '') },
          { label: 'Fleet LF', value: fmtPct(loadFactor) },
          { label: 'Flights', value: String(totalFlights) },
          { label: 'Fuel/BH', value: fmt(costs.fuelPerBlockHour) },
          { label: 'Crew/BH', value: fmt(costs.crewPerBlockHour) },
          { label: 'Fuel Srchg', value: fmtPct(revenue.fuelSurchargeRecovery) },
        ].map(m => (
          <div key={m.label}>
            <div style={{ color: '#4a4a4a', fontSize: 9 }}>{m.label}</div>
            <div className="font-mono font-medium" style={{ color: '#f0f0f0', fontSize: 15 }}>{m.value}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Route Margins */}
      <div className="flex-1">
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>Route Margins</div>
        <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
          {displayRoutes.map(r => (
            <div key={r.route} className="flex justify-between">
              <span style={{ color: '#8a8a8a' }}>{r.route}</span>
              <span style={{ color: r.marginPct >= 0 ? '#4ade80' : '#f87171' }}>
                {r.marginPct >= 0 ? '+' : ''}{r.marginPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Yield Trend */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5 }}>
          {chronologicalPnl.length > 0 ? 'Revenue Trend' : 'Yield Trend'}
        </div>
        <div className="mt-1">
          <Sparkline data={yieldData} height={24} />
        </div>
        {yieldLabels.length === 2 && (
          <div className="flex justify-between mt-0.5">
            <span style={{ color: '#4a4a4a', fontSize: 9 }}>{yieldLabels[0]}</span>
            <span style={{ color: '#4a4a4a', fontSize: 9 }}>{yieldLabels[1]}</span>
          </div>
        )}
      </div>
    </div>
  );
});
