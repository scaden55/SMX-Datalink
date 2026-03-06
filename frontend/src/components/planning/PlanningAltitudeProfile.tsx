import { useState, useEffect, useRef, useMemo, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

/** Resolve a CSS custom property from :root to its computed value. */
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Find TOC/TOD indices by locating the cruise band (>=90% of max altitude). */
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

/** Local error boundary so a chart crash doesn't take down the whole app. */
class ChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[AltitudeProfile] Chart render error:', error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center">
          <span className="text-[11px] text-acars-muted">Chart unavailable</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Hook: observe element size via ResizeObserver, returning [width, height]. */
function useSize(ref: React.RefObject<HTMLElement | null>): [number, number] {
  const [size, setSize] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize((prev) => (prev[0] === width && prev[1] === height ? prev : [width, height]));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

export function PlanningAltitudeProfile() {
  const { steps } = useFlightPlanStore();
  const hasSteps = steps.length >= 2;
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartW, chartH] = useSize(chartRef);

  // Resolve CSS custom properties once for SVG/Recharts rendering.
  // MUST be before any early return — React requires the same hooks every render.
  const clr = useMemo(() => ({
    cruise:      getCssVar('--purple'),
    bottom:      getCssVar('--purple-fill'),
    border:      getCssVar('--border-section'),
    textLabel:   getCssVar('--text-label'),
    textPrimary: getCssVar('--text-primary'),
    textSecondary: getCssVar('--text-secondary'),
    bgTooltip:   getCssVar('--bg-tooltip'),
    borderPanel: getCssVar('--border-panel'),
    bgApp:       getCssVar('--bg-app'),
  }), []);

  if (!hasSteps) {
    return (
      <div className="flex-[1] min-h-[60px] border-t border-white/[0.06] flex items-center justify-center">
        <span className="text-[11px] text-acars-muted">Generate OFP to see altitude profile</span>
      </div>
    );
  }

  const baseData = steps.map((s) => ({
    distance: Math.round(s.distanceFromOriginNm),
    altitude: s.altitudeFt,
    ident: typeof s.ident === 'string' ? s.ident : String(s.ident ?? ''),
    fixType: s.fixType ?? 'wpt',
  }));

  const data = baseData;

  const maxLabels = 14;
  const labelInterval = Math.max(1, Math.ceil(data.length / maxLabels));

  const maxAlt = Math.max(...baseData.map((d) => d.altitude));
  const yCeiling = maxAlt + 10000;

  const canDraw = chartW > 0 && chartH > 0;

  return (
    <div className="flex-[1] min-h-[60px] min-w-0 border-t border-white/[0.06] overflow-hidden relative">
      {/* Waypoint ident labels pinned to top */}
      <div className="absolute top-0 left-[42px] right-[8px] h-[16px] z-10 pointer-events-none overflow-hidden">
        {data.map((d, i) => {
          if (i % labelInterval !== 0) return null;
          const pct = data.length > 1 ? (i / (data.length - 1)) * 100 : 0;
          return (
            <span
              key={i}
              className="absolute text-[10px] tabular-nums whitespace-nowrap"
              style={{
                color: 'var(--text-label)',
                left: `${pct}%`,
                transform: 'translateX(-50%)',
                top: 0,
              }}
            >
              {d.ident}
            </span>
          );
        })}
      </div>

      {/* Chart fills entire container via absolute positioning */}
      <div ref={chartRef} className="absolute inset-0 pt-[16px]">
        {canDraw && (
          <ChartErrorBoundary>
            <AreaChart
              data={data}
              width={chartW}
              height={chartH - 16}
              margin={{ top: 2, right: 8, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="altGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={clr.cruise} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={clr.bottom} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ident"
                tick={false}
                tickLine={false}
                axisLine={{ stroke: clr.border }}
                height={0}
              />
              <YAxis
                domain={[0, yCeiling]}
                tick={{ fontSize: 10, fill: clr.textLabel }}
                tickLine={false}
                axisLine={{ stroke: clr.border }}
                tickFormatter={(v) => `FL${Math.round(v / 100)}`}
                width={42}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0]?.payload;
                  if (!pt) return null;
                  const alt = pt.altitude as number;
                  const dist = pt.distance as number;
                  return (
                    <div style={{
                      background: clr.bgTooltip,
                      border: `1px solid ${clr.borderPanel}`,
                      borderRadius: 2,
                      padding: '6px 10px',
                      fontSize: 11,
                    }}>
                      <div style={{ color: clr.textPrimary, fontWeight: 600 }}>{pt.ident}</div>
                      <div style={{ color: clr.textSecondary }}>Alt: {alt.toLocaleString()} ft</div>
                      <div style={{ color: clr.textSecondary }}>Dist: {dist} nm</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="altitude"
                stroke={clr.cruise}
                strokeWidth={1.5}
                fill="url(#altGrad)"
                dot={false}
                activeDot={{ r: 4, fill: clr.bgApp, stroke: clr.cruise, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartErrorBoundary>
        )}
      </div>
    </div>
  );
}
