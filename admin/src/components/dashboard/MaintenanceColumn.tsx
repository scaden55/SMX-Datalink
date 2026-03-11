import { memo } from 'react';
import type { MaintenanceSummary } from '../../types/dashboard';

const Divider = () => <div style={{ height: 1, background: 'rgba(255,255,255,0.04)' }} />;

interface MaintenanceColumnProps {
  data: MaintenanceSummary;
  network: { hubLoadFactor: number; outstationLoadFactor: number; revenuePerDeparture: number };
}

export const MaintenanceColumn = memo(function MaintenanceColumn({ data, network }: MaintenanceColumnProps) {
  const { fleetStatus, criticalMel, nextChecks } = data;

  return (
    <div className="flex flex-col gap-2.5 overflow-hidden pt-0.5">
      {/* Fleet Status */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 8 }}>
          Fleet Status
        </div>
        <div className="grid grid-cols-2" style={{ gap: '4px 12px' }}>
          {[
            { value: fleetStatus.airworthy, label: 'Airworthy', color: '#4ade80' },
            { value: fleetStatus.melDispatch, label: 'MEL Dispatch', color: '#fbbf24' },
            { value: fleetStatus.inCheck, label: 'In Check', color: '#22d3ee' },
            { value: fleetStatus.aog, label: 'AOG', color: '#f87171' },
          ].map((s, i) => (
            <div key={s.label} style={{ marginTop: i >= 2 ? 4 : 0 }}>
              <div className="font-mono font-semibold" style={{ color: s.color, fontSize: 20, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: '#4a4a4a', fontSize: 7 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* Critical MEL <48h */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Critical MEL &lt;48h
        </div>
        {criticalMel.length === 0 ? (
          <div className="font-mono" style={{ color: '#3a3a3a', fontSize: 9 }}>No critical MELs</div>
        ) : (
          <div className="font-mono flex flex-col gap-1" style={{ fontSize: 9 }}>
            {criticalMel.map((mel, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span style={{ color: '#f0f0f0' }}>{mel.registration}</span>
                  <span style={{ color: mel.hoursRemaining < 12 ? '#f87171' : '#fbbf24', fontSize: 8 }}>
                    {Math.round(mel.hoursRemaining)}h left
                  </span>
                </div>
                <div style={{ color: '#4a4a4a', fontSize: 7 }}>Cat {mel.category} · {mel.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider />

      {/* Next Checks */}
      <div>
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Next Checks
        </div>
        <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
          {nextChecks.slice(0, 4).map((chk, i) => {
            const color = chk.pctRemaining <= 0 ? '#f87171' : chk.pctRemaining < 20 ? '#fbbf24' : '#f0f0f0';
            const hoursLabel = Math.abs(chk.hoursRemaining) >= 1000
              ? `${(chk.hoursRemaining / 1000).toFixed(1)}Kh`
              : `${Math.round(chk.hoursRemaining)}h`;
            return (
              <div key={i} className="flex justify-between">
                <span style={{ color: '#7a7a7a' }}>{chk.registration}</span>
                <span style={{ color }}>{chk.checkType}-Chk {hoursLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Network Health (pushed to bottom) */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="uppercase" style={{ color: '#3a3a3a', fontSize: 7, letterSpacing: 0.5, marginBottom: 6 }}>
          Network
        </div>
        <div className="font-mono flex flex-col gap-0.5" style={{ fontSize: 9 }}>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Hub LF</span>
            <span style={{ color: '#f0f0f0' }}>{Math.round(network.hubLoadFactor)}%</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Outstation LF</span>
            <span style={{ color: '#f0f0f0' }}>{Math.round(network.outstationLoadFactor)}%</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#4a4a4a' }}>Rev/Dep</span>
            <span style={{ color: '#f0f0f0' }}>
              ${network.revenuePerDeparture >= 1000
                ? `${(network.revenuePerDeparture / 1000).toFixed(1)}K`
                : Math.round(network.revenuePerDeparture)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
