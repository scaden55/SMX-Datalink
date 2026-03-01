import { Users } from '@phosphor-icons/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PilotActivity {
  callsign: string;
  firstName: string;
  lastName: string;
  hoursThisMonth: number;
}

interface PilotsPanelProps {
  pilotActivity: PilotActivity[];
}

export function PilotsPanel({ pilotActivity }: PilotsPanelProps) {
  const chartData = pilotActivity.slice(0, 10).map((p) => ({
    name: p.callsign || `${p.firstName} ${p.lastName}`,
    hours: p.hoursThisMonth,
  }));

  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Pilots</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users size={14} weight="duotone" />
          <span>hours this month</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-2 pb-4">
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pilot activity data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#8b8fa3', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#e8eaed', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1d2e',
                  border: '1px solid #2a2e3f',
                  borderRadius: '6px',
                  color: '#e8eaed',
                  fontSize: 12,
                }}
                formatter={(value: number | string | undefined) => [`${Number(value ?? 0).toFixed(1)} hrs`, 'Hours']}
                labelStyle={{ color: '#8b8fa3' }}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
