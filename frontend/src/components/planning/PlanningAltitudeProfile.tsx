import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningAltitudeProfile() {
  const { steps } = useFlightPlanStore();
  const hasSteps = steps.length >= 2;

  // Delay chart render by one frame after steps become available,
  // so the flex layout has settled and ResponsiveContainer gets valid dimensions.
  const [canRender, setCanRender] = useState(false);
  useEffect(() => {
    if (!hasSteps) {
      setCanRender(false);
      return;
    }
    const id = requestAnimationFrame(() => setCanRender(true));
    return () => cancelAnimationFrame(id);
  }, [hasSteps]);

  if (!hasSteps) {
    return (
      <div className="h-[140px] border-t border-acars-border flex items-center justify-center bg-acars-panel">
        <span className="text-[10px] text-acars-muted">Generate OFP to see altitude profile</span>
      </div>
    );
  }

  const data = steps.map((s) => ({
    distance: Math.round(s.distanceFromOriginNm),
    altitude: s.altitudeFt,
    ident: s.ident,
  }));

  return (
    <div className="h-[140px] min-w-0 border-t border-acars-border bg-acars-panel px-2 pt-1 overflow-hidden">
      {canRender && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="altGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#58a6ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distance"
              tick={{ fontSize: 9, fill: '#8b949e' }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#8b949e' }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              tickFormatter={(v) => `FL${Math.round(v / 100)}`}
              width={42}
            />
            <Tooltip
              contentStyle={{
                background: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '6px',
                fontSize: '10px',
                color: '#e6edf3',
              }}
              formatter={(value: number | undefined) => [`${(value ?? 0).toLocaleString()} ft`, 'Altitude']}
              labelFormatter={(label) => `${label} nm`}
            />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="#58a6ff"
              strokeWidth={1.5}
              fill="url(#altGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
