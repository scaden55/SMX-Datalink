import { memo } from 'react';
import type { PilotActivityEntry, FleetUtilizationEntry, FinancialKPIs } from '@/types/dashboard';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

interface OpsFleetColumnProps {
  pendingPireps: number;
  onTimePct: number;
  pilotsOnline: number;
  pilotActivity: PilotActivityEntry[];
  fleetUtilization: FleetUtilizationEntry[];
  kpis: FinancialKPIs;
}

export const OpsFleetColumn = memo(function OpsFleetColumn({
  pendingPireps,
  onTimePct,
  pilotsOnline,
  pilotActivity,
  fleetUtilization,
  kpis,
}: OpsFleetColumnProps) {
  // Fleet util: relative bar (max tail = 100%)
  const maxHours = Math.max(...fleetUtilization.map((f) => f.totalHours), 1);

  // Top routes by RTM
  const topRoutes = [...kpis.revenue.yieldByRoute]
    .sort((a, b) => b.rtm - a.rtm)
    .slice(0, 3);

  // Fleet util percentage
  const activeCount = fleetUtilization.filter((f) => f.totalHours > 0).length;
  const fleetUtilPct = fleetUtilization.length > 0
    ? Math.round((activeCount / fleetUtilization.length) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 overflow-hidden pt-0.5">
      {/* Header */}
      <div>
        <div className="font-semibold" style={{ color: '#f0f0f0', fontSize: 18, lineHeight: 1.15 }}>
          Operations<br />&amp; Fleet
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3" style={{ gap: '8px 10px' }}>
        <div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>PIREPs</div>
          <div className="font-mono font-semibold" style={{ color: pendingPireps > 0 ? '#fbbf24' : '#4ade80', fontSize: 20, lineHeight: 1 }}>
            {pendingPireps}
          </div>
        </div>
        <div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>On-Time</div>
          <div className="font-mono font-semibold" style={{ color: onTimePct >= 90 ? '#4ade80' : onTimePct >= 75 ? '#fbbf24' : '#f87171', fontSize: 20, lineHeight: 1 }}>
            {onTimePct}%
          </div>
        </div>
        <div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>Online</div>
          <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 20, lineHeight: 1 }}>
            {pilotsOnline}
          </div>
        </div>
      </div>

      <Divider />

      {/* Pilot Activity */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>
          Pilot Activity
        </div>
        <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
          {pilotActivity.slice(0, 5).map((p) => (
            <div key={p.callsign} className="flex justify-between">
              <span style={{ color: '#8a8a8a' }}>{p.callsign}</span>
              <span style={{ color: '#f0f0f0' }}>{p.hoursThisMonth}h</span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Fleet & Cargo */}
      <div className="grid grid-cols-2" style={{ gap: '8px 16px' }}>
        <div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>Fleet Util</div>
          <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 20, lineHeight: 1 }}>
            {fleetUtilPct}%
          </div>
        </div>
        <div>
          <div style={{ color: '#4a4a4a', fontSize: 9 }}>Avg Load Factor</div>
          <div className="font-mono font-semibold" style={{ color: '#f0f0f0', fontSize: 20, lineHeight: 1 }}>
            {Math.round(kpis.revenue.fleetAvgLoadFactor)}%
          </div>
        </div>
      </div>

      <Divider />

      {/* Top Routes by RTM */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>
          Top Routes (RTM)
        </div>
        <div className="font-mono flex flex-col gap-1" style={{ fontSize: 12 }}>
          {topRoutes.map((r) => (
            <div key={r.route} className="flex justify-between">
              <span style={{ color: '#8a8a8a' }}>{r.route}</span>
              <span style={{ color: '#22d3ee' }}>
                {r.rtm >= 1_000_000 ? `${(r.rtm / 1_000_000).toFixed(1)}M` : `${(r.rtm / 1_000).toFixed(0)}K`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Utilization by Tail */}
      <div>
        <div className="uppercase" style={{ color: '#4a4a4a', fontSize: 9, letterSpacing: 0.5, marginBottom: 6 }}>
          Utilization by Tail
        </div>
        <div className="font-mono flex flex-col gap-1.5" style={{ fontSize: 12 }}>
          {fleetUtilization.slice(0, 5).map((f) => {
            const pct = Math.round((f.totalHours / maxHours) * 100);
            const color = pct >= 80 ? '#4ade80' : pct >= 50 ? '#60a5fa' : '#fbbf24';
            return (
              <div key={f.registration} className="flex items-center justify-between">
                <span style={{ color: '#8a8a8a' }}>{f.registration}</span>
                <div className="flex items-center gap-2">
                  <div style={{ width: 50, height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
                  </div>
                  <span style={{ color: '#f0f0f0', fontSize: 10, width: 28, textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
