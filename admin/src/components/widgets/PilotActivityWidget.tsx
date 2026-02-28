import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

interface PilotActivityWidgetProps {
  data: PilotActivity[];
}

export function PilotActivityWidget({ data }: PilotActivityWidgetProps) {
  const chartData = data.map((p) => ({
    name: p.callsign || `${p.firstName} ${p.lastName}`,
    hours: p.hoursThisMonth,
  }));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pilot Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No pilot activity data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2a2e3f"
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fill: '#8b8fa3', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2e3f' }}
                label={{
                  value: 'Hours',
                  position: 'insideBottomRight',
                  offset: -5,
                  fill: '#8b8fa3',
                  fontSize: 11,
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#e8eaed', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={80}
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
              <Bar
                dataKey="hours"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
