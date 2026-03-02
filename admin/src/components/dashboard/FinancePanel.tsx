import { CurrencyDollar } from '@phosphor-icons/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FinancialSummary {
  months: string[];
  income: number[];
  costs: number[];
  profit: number[];
}

interface FinancePanelProps {
  monthlyRevenue: number;
  financialSummary: FinancialSummary;
}

function formatRevenue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString()}`;
}

export function FinancePanel({ monthlyRevenue, financialSummary }: FinancePanelProps) {
  const chartData = financialSummary.months.map((month, i) => ({
    month,
    income: financialSummary.income[i] ?? 0,
    costs: financialSummary.costs[i] ?? 0,
    profit: financialSummary.profit[i] ?? 0,
  }));

  // Latest month totals for the summary row
  const lastIdx = financialSummary.months.length - 1;
  const latestIncome = lastIdx >= 0 ? financialSummary.income[lastIdx] ?? 0 : 0;
  const latestCosts = lastIdx >= 0 ? financialSummary.costs[lastIdx] ?? 0 : 0;
  const latestProfit = lastIdx >= 0 ? financialSummary.profit[lastIdx] ?? 0 : 0;

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CurrencyDollar size={12} weight="duotone" className="text-cyan-400" />
          <span className="font-mono font-medium text-foreground">{formatRevenue(monthlyRevenue)}</span>
          <span>/ mo</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Chart */}
      <div className="px-1 pt-2 pb-2">
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No financial data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="dashFillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashFillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8b8fa3', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                tick={{ fill: '#8b8fa3', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                width={35}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2e',
                  border: '1px solid #2a2e3f',
                  borderRadius: '6px',
                  color: '#e8eaed',
                  fontSize: 11,
                  padding: '6px 10px',
                }}
                formatter={(value: number | string | undefined) => [
                  `$${Number(value ?? 0).toLocaleString()}`,
                ]}
                labelStyle={{ color: '#8b8fa3' }}
              />
              <Area type="monotone" dataKey="income" stroke="#3b82f6" fill="url(#dashFillIncome)" strokeWidth={1.5} name="Income" />
              <Area type="monotone" dataKey="costs" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Costs" />
              <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#dashFillProfit)" strokeWidth={1.5} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary stat blocks */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
          <div className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-blue-300/60">Income</p>
            <p className="text-xs font-mono font-bold text-blue-400 mt-0.5">{formatRevenue(latestIncome)}</p>
          </div>
          <div className="rounded bg-red-500/10 border border-red-500/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-red-300/60">Costs</p>
            <p className="text-xs font-mono font-bold text-red-400 mt-0.5">{formatRevenue(latestCosts)}</p>
          </div>
          <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-wider text-emerald-300/60">Profit</p>
            <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">{formatRevenue(latestProfit)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
