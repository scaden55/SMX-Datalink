import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

interface FinancialOverviewWidgetProps {
  data: FinancialSummary;
}

export function FinancialOverviewWidget({ data }: FinancialOverviewWidgetProps) {
  const chartData = data.months.map((month, i) => ({
    month,
    income: data.income[i] ?? 0,
    costs: data.costs[i] ?? 0,
    profit: data.profit[i] ?? 0,
  }));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Financial Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No financial data available
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
              <XAxis
                dataKey="month"
                tick={{ fill: '#8b8fa3', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                tick={{ fill: '#8b8fa3', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
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
              <Area
                type="monotone"
                dataKey="income"
                stroke="#3b82f6"
                fill="url(#fillIncome)"
                strokeWidth={2}
                name="Income"
              />
              <Area
                type="monotone"
                dataKey="costs"
                stroke="#ef4444"
                fill="url(#fillCosts)"
                strokeWidth={2}
                name="Costs"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#22c55e"
                fill="url(#fillProfit)"
                strokeWidth={2}
                name="Profit"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
