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

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Finance</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CurrencyDollar size={14} weight="duotone" />
          <span className="font-mono font-medium text-foreground">{formatRevenue(monthlyRevenue)}</span>
          <span>this month</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No financial data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dashFillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashFillCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashFillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2e',
                  border: '1px solid #2a2e3f',
                  borderRadius: '6px',
                  color: '#e8eaed',
                  fontSize: 12,
                }}
                formatter={(value: number | string | undefined) => [
                  `$${Number(value ?? 0).toLocaleString()}`,
                ]}
                labelStyle={{ color: '#8b8fa3' }}
              />
              <Area type="monotone" dataKey="income" stroke="#3b82f6" fill="url(#dashFillIncome)" strokeWidth={2} name="Income" />
              <Area type="monotone" dataKey="costs" stroke="#ef4444" fill="url(#dashFillCosts)" strokeWidth={2} name="Costs" />
              <Area type="monotone" dataKey="profit" stroke="#22c55e" fill="url(#dashFillProfit)" strokeWidth={2} name="Profit" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
