import { memo } from 'react';

// ── Section divider ──────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-0.5">
      <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-quaternary)] font-display">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--divider)]" />
    </div>
  );
}

// ── Compact route row ────────────────────────────────────────

function RouteRow({ dep, arr, demand, fill, flag }: {
  dep: string; arr: string; demand: string; fill: number; flag?: 'over' | 'under';
}) {
  const fillColor = flag === 'over'
    ? 'var(--accent-amber)'
    : flag === 'under'
      ? 'var(--accent-red)'
      : 'var(--accent-blue)';

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] text-[var(--text-secondary)] w-[90px] flex-shrink-0">
        {dep} → {arr}
      </span>
      <div className="flex-1 h-[3px] rounded-full bg-[var(--border-primary)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(fill, 100)}%`, background: fillColor }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-quaternary)] w-[32px] text-right">
        {fill}%
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--text-quaternary)] w-[36px] text-right">
        {demand}
      </span>
    </div>
  );
}

// ── Mock data ────────────────────────────────────────────────

const MOCK = {
  activeRoutes: 24,
  totalFrequencies: 87,
  demandCoverage: 72,
  pendingDemand: { tons: 142, volume: 18400 },
  coveredDemand: { tons: 102, volume: 13200 },
  uncoveredDemand: { tons: 40, volume: 5200 },
  topRoutes: [
    { dep: 'KMEM', arr: 'KJFK', demand: '18t', fill: 94, flag: 'over' as const },
    { dep: 'KMEM', arr: 'KLAX', demand: '14t', fill: 87 },
    { dep: 'KMEM', arr: 'KORD', demand: '12t', fill: 76 },
    { dep: 'PANC', arr: 'KMEM', demand: '9t', fill: 42, flag: 'under' as const },
  ],
  unserved: [
    { dep: 'KMEM', arr: 'KSDF', tons: '8t' },
    { dep: 'KJFK', arr: 'EGLL', tons: '6t' },
    { dep: 'PANC', arr: 'RJTT', tons: '4t' },
  ],
  hubStats: [
    { icao: 'KMEM', flights: 18, tonnage: '94t', utilization: 88 },
    { icao: 'PANC', flights: 6, tonnage: '48t', utilization: 62 },
  ],
  cargoMix: [
    { cls: '1US', label: 'Standard', pct: 64 },
    { cls: '1UN', label: 'Non-Std', pct: 22 },
    { cls: '1HX', label: 'Hazmat', pct: 14 },
  ],
  nextDepartures: [
    { flight: 'SMX1009', route: 'TJSJ–KIAH', dep: '15:45', type: 'B738' },
    { flight: 'SMX1019', route: 'KSBA–MMSD', dep: '13:00', type: 'B738' },
    { flight: 'SMX1034', route: 'KSTL–KTYS', dep: '06:45', type: 'B77F' },
    { flight: 'SMX1048', route: 'PARY–KPDX', dep: '16:15', type: 'B77F' },
  ],
};

// ── Main component ───────────────────────────────────────────

export const SchedulesCard = memo(function SchedulesCard() {
  const d = MOCK;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-display font-display" style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
            Schedules
          </h3>
          <span className="font-mono text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Sample</span>
        </div>
        <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--text-secondary)]">
          {d.activeRoutes} routes
        </span>
      </div>

      {/* ── Demand Pipeline (inline) ───────────────────────── */}
      <SectionLabel>Demand Pipeline</SectionLabel>

      <div className="flex items-center gap-3">
        {/* Coverage gauge */}
        <div className="flex-shrink-0 text-center" style={{ width: 48 }}>
          <div className={`font-mono text-[18px] font-bold tabular-nums leading-none ${d.demandCoverage >= 80 ? 'text-[var(--accent-emerald)]' : d.demandCoverage >= 60 ? 'text-[var(--accent-amber)]' : 'text-[var(--accent-red)]'}`}>
            {d.demandCoverage}%
          </div>
          <span className="text-[10px] text-[var(--text-quaternary)]" style={{ fontFamily: 'var(--font-display)' }}>covered</span>
        </div>

        {/* Stacked bar showing covered vs uncovered */}
        <div className="flex-1 min-w-0">
          <div className="flex h-[6px] rounded-full overflow-hidden bg-[var(--border-primary)]">
            <div
              className="h-full"
              style={{ width: `${d.demandCoverage}%`, background: 'var(--accent-emerald)', opacity: 0.6 }}
            />
            <div
              className="h-full"
              style={{ width: `${100 - d.demandCoverage}%`, background: 'var(--accent-red)', opacity: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[var(--text-quaternary)]">
              <span className="font-mono tabular-nums">{d.coveredDemand.tons}t</span> <span style={{ fontFamily: 'var(--font-display)' }}>scheduled</span>
            </span>
            <span className="text-[10px] text-[var(--accent-red)]" style={{ opacity: 0.7 }}>
              <span className="font-mono tabular-nums">{d.uncoveredDemand.tons}t</span> <span style={{ fontFamily: 'var(--font-display)' }}>unassigned</span>
            </span>
          </div>
        </div>

        {/* Total pending */}
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[13px] font-medium tabular-nums text-[var(--text-secondary)] leading-none">
            {d.pendingDemand.tons}t
          </div>
          <span className="text-[10px] text-[var(--text-quaternary)]" style={{ fontFamily: 'var(--font-display)' }}>pending</span>
        </div>
      </div>

      {/* ── Route Performance ──────────────────────────────── */}
      <SectionLabel>Route Performance</SectionLabel>

      <div className="flex flex-col gap-1">
        {d.topRoutes.map((r, i) => (
          <RouteRow key={i} {...r} />
        ))}
      </div>

      {/* ── Unserved Demand ────────────────────────────────── */}
      <SectionLabel>Unserved Demand</SectionLabel>

      <div className="flex gap-2 flex-wrap">
        {d.unserved.map((u, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 px-1.5 py-0.5"
            style={{ background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red-ring)' }}
          >
            <span className="font-mono text-[10px] text-[var(--accent-red)]">
              {u.dep}→{u.arr}
            </span>
            <span className="font-mono text-[10px] font-medium tabular-nums text-[var(--accent-red)]">
              {u.tons}
            </span>
          </div>
        ))}
      </div>

      {/* ── Hub Coverage ─────────────────────────────────────── */}
      <SectionLabel>Hub Coverage</SectionLabel>

      <div className="flex flex-col gap-1.5">
        {d.hubStats.map((h) => (
          <div key={h.icao} className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] w-[48px] flex-shrink-0">
              {h.icao}
            </span>
            <div className="flex-1 min-w-0">
              <div className="h-[3px] bg-[var(--border-primary)]">
                <div
                  className="h-full"
                  style={{
                    width: `${h.utilization}%`,
                    background: h.utilization >= 80 ? 'var(--accent-emerald)' : h.utilization >= 60 ? 'var(--accent-blue)' : 'var(--accent-amber)',
                  }}
                />
              </div>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-quaternary)] w-[28px] text-right">
              {h.utilization}%
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-tertiary)] w-[28px] text-right">
              {h.tonnage}
            </span>
          </div>
        ))}
      </div>

      {/* ── Cargo Mix ────────────────────────────────────────── */}
      <SectionLabel>Cargo Class Mix</SectionLabel>

      <div className="flex gap-1 h-[4px]">
        {d.cargoMix.map((c) => (
          <div
            key={c.cls}
            className="h-full"
            style={{
              width: `${c.pct}%`,
              background: c.cls === '1US' ? 'var(--accent-blue)' : c.cls === '1UN' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {d.cargoMix.map((c) => (
          <div key={c.cls} className="flex items-center gap-1">
            <span
              style={{
                width: 6,
                height: 6,
                background: c.cls === '1US' ? 'var(--accent-blue)' : c.cls === '1UN' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                opacity: 0.7,
                flexShrink: 0,
              }}
            />
            <span className="text-[10px] text-[var(--text-quaternary)]">
              <span style={{ fontFamily: 'var(--font-display)' }}>{c.label}</span> <span className="font-mono tabular-nums">{c.pct}%</span>
            </span>
          </div>
        ))}
      </div>

      {/* ── Next Departures ──────────────────────────────────── */}
      <SectionLabel>Next Departures</SectionLabel>

      <div className="flex flex-col gap-1">
        {d.nextDepartures.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-[var(--text-primary)] w-[70px] flex-shrink-0">
              {f.flight}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-tertiary)] flex-1 min-w-0 truncate">
              {f.route}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-quaternary)] w-[36px] text-right">
              {f.dep}
            </span>
            <span className="text-[10px] text-[var(--text-quaternary)] w-[32px] text-right">
              {f.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
