import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

const CLR_CLIMB = '#d2a8ff';   // purple/magenta
const CLR_CRUISE = '#58a6ff';  // blue
const CLR_DESCENT = '#3fb950'; // green

/** Generate SVG polygon points string for a hexagon centered at (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

/** Find TOC/TOD indices by locating the cruise band (≥90% of max altitude). */
function findPhases(data: { altitude: number }[]) {
  const maxAlt = Math.max(...data.map((d) => d.altitude));
  const threshold = maxAlt * 0.90;

  let tocIndex = 0;
  let todIndex = data.length - 1;

  for (let i = 0; i < data.length; i++) {
    if (data[i].altitude >= threshold) { tocIndex = i; break; }
  }
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].altitude >= threshold) { todIndex = i; break; }
  }

  return { tocIndex, todIndex };
}

export function PlanningAltitudeProfile() {
  const { steps } = useFlightPlanStore();
  const hasSteps = steps.length >= 2;

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

  const baseData = steps.map((s) => ({
    distance: Math.round(s.distanceFromOriginNm),
    altitude: s.altitudeFt,
    ident: s.ident,
    fixType: s.fixType ?? 'wpt',
  }));

  const { tocIndex, todIndex } = findPhases(baseData);

  // Build segmented data — each point gets climb/cruise/descent altitude.
  // Overlap at TOC and TOD so segments connect seamlessly.
  const data = baseData.map((d, i) => ({
    ...d,
    climbAlt:   i <= tocIndex ? d.altitude : undefined as number | undefined,
    cruiseAlt:  i >= tocIndex && i <= todIndex ? d.altitude : undefined as number | undefined,
    descentAlt: i >= todIndex ? d.altitude : undefined as number | undefined,
  }));

  const maxLabels = 12;
  const labelInterval = Math.max(1, Math.ceil(data.length / maxLabels));

  const maxAlt = Math.max(...baseData.map((d) => d.altitude));
  const yCeiling = maxAlt + 10000;

  // Determine dot color per index
  const dotColor = (i: number) =>
    i < tocIndex ? CLR_CLIMB : i > todIndex ? CLR_DESCENT : CLR_CRUISE;

  // Custom dot renderer — shape depends on waypoint type, color on phase
  const renderDot = (props: any) => {
    const { cx, cy, index } = props;
    if (cx == null || cy == null) return null;
    const color = dotColor(index);
    const ft = data[index]?.fixType ?? 'wpt';
    const r = 4;
    const fill = '#161b22';
    const sw = 1.5;

    switch (ft) {
      case 'apt': // Square — airport
        return <rect key={`dot-${index}`} x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fill} stroke={color} strokeWidth={sw} />;
      case 'vor': // Hexagon — VOR
        return <polygon key={`dot-${index}`} points={hexPoints(cx, cy, r)} fill={fill} stroke={color} strokeWidth={sw} />;
      case 'ndb': // Circle — NDB
        return <circle key={`dot-${index}`} cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={sw} />;
      case 'ltlg': // Diamond — GPS/lat-lon
        return <polygon key={`dot-${index}`} points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={color} strokeWidth={sw} />;
      default: // Triangle — intersection/fix/wpt/toc/tod
        return <polygon key={`dot-${index}`} points={`${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`} fill={fill} stroke={color} strokeWidth={sw} />;
    }
  };

  return (
    <div className="h-[140px] min-w-0 border-t border-acars-border bg-acars-panel px-2 pt-1 overflow-hidden">
      {canRender && (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CLR_CLIMB} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CLR_CLIMB} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="cruiseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CLR_CRUISE} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CLR_CRUISE} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="descentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CLR_DESCENT} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CLR_DESCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ident"
              tick={{ fontSize: 8, fill: '#8b949e', fontFamily: 'monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              interval={labelInterval - 1}
            />
            <YAxis
              domain={[0, yCeiling]}
              tick={{ fontSize: 9, fill: '#8b949e' }}
              tickLine={false}
              axisLine={{ stroke: '#30363d' }}
              tickFormatter={(v) => `FL${Math.round(v / 100)}`}
              width={42}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const pt = payload[0]?.payload;
                if (!pt) return null;
                const idx = data.indexOf(pt);
                const color = idx < tocIndex ? CLR_CLIMB : idx > todIndex ? CLR_DESCENT : CLR_CRUISE;
                const alt = pt.altitude as number;
                const dist = pt.distance as number;
                return (
                  <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '4px 8px', fontSize: 10 }}>
                    <div style={{ color: '#8b949e' }}>{pt.ident} ({dist} nm)</div>
                    <div style={{ color, fontWeight: 600 }}>{alt.toLocaleString()} ft</div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="climbAlt"
              stroke={CLR_CLIMB}
              strokeWidth={1.5}
              fill="url(#climbGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#161b22', stroke: CLR_CLIMB, strokeWidth: 2 }}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="cruiseAlt"
              stroke={CLR_CRUISE}
              strokeWidth={1.5}
              fill="url(#cruiseGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#161b22', stroke: CLR_CRUISE, strokeWidth: 2 }}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="descentAlt"
              stroke={CLR_DESCENT}
              strokeWidth={1.5}
              fill="url(#descentGrad)"
              dot={false}
              activeDot={{ r: 5, fill: '#161b22', stroke: CLR_DESCENT, strokeWidth: 2 }}
              connectNulls={false}
            />
            {/* Phase-colored dots rendered as a single layer on top */}
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="none"
              fill="none"
              dot={renderDot}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
