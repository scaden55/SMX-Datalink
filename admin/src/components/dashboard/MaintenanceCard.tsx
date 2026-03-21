import { memo } from 'react';
import { Heart } from 'lucide-react';
import type { MaintenanceSummary } from '@/types/dashboard';

// ── Section divider ──────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-quaternary)]">
        {children}
      </span>
      <div className="flex-1 h-px bg-[var(--divider)]" />
    </div>
  );
}

// ── Status dot ───────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 6, height: 6, background: color, flexShrink: 0 }}
    />
  );
}

// ── Progress bar (for check remaining %) ─────────────────────

function CheckProgress({ label, registration, hoursRemaining, pctRemaining }: {
  label: string;
  registration: string;
  hoursRemaining: number;
  pctRemaining: number;
}) {
  const barColor = pctRemaining <= 0
    ? 'var(--accent-red)'
    : pctRemaining < 15
      ? 'var(--accent-amber)'
      : 'var(--accent-blue)';
  const textColor = pctRemaining <= 0
    ? 'var(--accent-red)'
    : pctRemaining < 15
      ? 'var(--accent-amber)'
      : 'var(--text-quaternary)';
  const hoursLabel = Math.abs(hoursRemaining) >= 1000
    ? `${(hoursRemaining / 1000).toFixed(1)}Kh`
    : `${Math.round(hoursRemaining)}h`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">{registration}</span>
          <span className="text-[10px] text-[var(--text-quaternary)]">{label}</span>
        </div>
        <span className="font-mono text-[10px] tabular-nums" style={{ color: textColor }}>
          {hoursLabel} rem
        </span>
      </div>
      <div className="h-[3px] rounded-full bg-[var(--border-primary)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(Math.min(pctRemaining, 100), 2)}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Engine row ───────────────────────────────────────────────

interface EngineData {
  registration: string;
  position: string;
  tso: number;
  cso: number;
  hoursToShopVisit: number;
  cyclesToShopVisit: number;
}

function EngineRow({ engine }: { engine: EngineData }) {
  const urgency = engine.hoursToShopVisit < 200
    ? 'var(--accent-red)'
    : engine.hoursToShopVisit < 500
      ? 'var(--accent-amber)'
      : 'var(--text-secondary)';

  return (
    <div className="flex items-center justify-between py-[2px]">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[11px] text-[var(--text-secondary)]">{engine.registration}</span>
        <span className="text-[9px] text-[var(--text-quaternary)]">{engine.position}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <span className="font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
            {engine.tso.toLocaleString()}h / {engine.cso.toLocaleString()}c
          </span>
        </div>
        <div className="text-right" style={{ minWidth: 52 }}>
          <span className="font-mono text-[10px] tabular-nums font-medium" style={{ color: urgency }}>
            {engine.hoursToShopVisit.toLocaleString()}h rem
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Mock data ────────────────────────────────────────────────

const MOCK_ENGINES: EngineData[] = [
  { registration: 'N402SM', position: 'ENG 1', tso: 4810, cso: 2100, hoursToShopVisit: 190, cyclesToShopVisit: 100 },
  { registration: 'N402SM', position: 'ENG 2', tso: 4600, cso: 2020, hoursToShopVisit: 400, cyclesToShopVisit: 180 },
  { registration: 'N401SM', position: 'ENG 1', tso: 3420, cso: 1280, hoursToShopVisit: 1580, cyclesToShopVisit: 720 },
  { registration: 'N401SM', position: 'ENG 2', tso: 3380, cso: 1260, hoursToShopVisit: 1620, cyclesToShopVisit: 740 },
];

const MOCK_AD_COMPLIANCE = {
  openADs: 3,
  openSBs: 5,
  approachingDeadline: 1,
  pastDue: 0,
};

const MOCK_FLEET_STATUS = {
  airworthy: 8,
  melDispatch: 2,
  inCheck: 1,
  aog: 0,
};

const MOCK_NEXT_CHECKS = [
  { registration: 'N402SM', checkType: 'C', hoursRemaining: 120, intervalHours: 6000, pctRemaining: 2 },
  { registration: 'N405SM', checkType: 'A', hoursRemaining: 48, intervalHours: 500, pctRemaining: 9.6 },
  { registration: 'N401SM', checkType: 'B', hoursRemaining: 890, intervalHours: 4500, pctRemaining: 19.8 },
  { registration: 'N408SM', checkType: 'A', hoursRemaining: 310, intervalHours: 500, pctRemaining: 62 },
];

// ── Main component ───────────────────────────────────────────

interface MaintenanceCardProps {
  data: MaintenanceSummary;
}

export const MaintenanceCard = memo(function MaintenanceCard({ data }: MaintenanceCardProps) {
  const hasData = data.fleetStatus.airworthy > 0 || data.fleetStatus.melDispatch > 0 || data.fleetStatus.inCheck > 0 || data.fleetStatus.aog > 0;

  const fleet = hasData ? data.fleetStatus : MOCK_FLEET_STATUS;
  const nextChecks = [...(data.nextChecks.length > 0 ? data.nextChecks : MOCK_NEXT_CHECKS)]
    .sort((a, b) => a.pctRemaining - b.pctRemaining);
  const engines = [...MOCK_ENGINES]
    .sort((a, b) => a.hoursToShopVisit - b.hoursToShopVisit);
  const adCompliance = MOCK_AD_COMPLIANCE; // No AD summary endpoint yet — always mock

  const totalAircraft = fleet.airworthy + fleet.melDispatch + fleet.inCheck + fleet.aog;
  const healthPct = totalAircraft > 0 ? Math.round((fleet.airworthy / totalAircraft) * 100) : 0;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] p-3 flex flex-col gap-2">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Maintenance
        </h3>
        <Heart
          size={16}
          fill={healthPct >= 80 ? 'var(--accent-emerald)' : healthPct >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)'}
          stroke="none"
        />
      </div>

      {/* ── Fleet Health Summary ────────────────────────────── */}
      <SectionLabel>Fleet Health</SectionLabel>

      <div className="grid grid-cols-4 gap-2">
        {[
          { value: fleet.airworthy, label: 'Airworthy', color: 'var(--accent-emerald)' },
          { value: fleet.melDispatch, label: 'MEL', color: 'var(--accent-amber)' },
          { value: fleet.inCheck, label: 'In Check', color: 'var(--accent-cyan)' },
          { value: fleet.aog, label: 'AOG', color: 'var(--accent-red)' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-mono text-[16px] font-bold tabular-nums leading-none" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <StatusDot color={s.color} />
              <span className="text-[9px] text-[var(--text-quaternary)]">{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Upcoming Checks ────────────────────────────────── */}
      <SectionLabel>Upcoming Checks</SectionLabel>

      <div className="flex flex-col gap-2">
        {nextChecks.slice(0, 3).map((chk, i) => (
          <CheckProgress
            key={i}
            label={`${chk.checkType}-Check`}
            registration={chk.registration}
            hoursRemaining={chk.hoursRemaining}
            pctRemaining={chk.pctRemaining}
          />
        ))}
      </div>

      {/* ── Engine & APU Tracking ──────────────────────────── */}
      <SectionLabel>Engine &amp; APU Tracking</SectionLabel>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-[var(--text-quaternary)]">Tail / Position</span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-[var(--text-quaternary)]">TSO / CSO</span>
            <span className="text-[9px] text-[var(--text-quaternary)]" style={{ minWidth: 52, textAlign: 'right' }}>Next Shop</span>
          </div>
        </div>
        <div className="flex flex-col">
          {engines.map((eng, i) => (
            <EngineRow key={i} engine={eng} />
          ))}
        </div>
      </div>

      {/* ── AD & SB Compliance ─────────────────────────────── */}
      <SectionLabel>AD &amp; SB Compliance</SectionLabel>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)]">Open ADs</span>
          <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--text-secondary)]">
            {adCompliance.openADs}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)]">Open SBs</span>
          <span className="font-mono text-[12px] font-medium tabular-nums text-[var(--text-secondary)]">
            {adCompliance.openSBs}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)]">Approaching</span>
          <span className={`font-mono text-[12px] font-medium tabular-nums ${adCompliance.approachingDeadline > 0 ? 'text-[var(--accent-amber)]' : 'text-[var(--text-secondary)]'}`}>
            {adCompliance.approachingDeadline}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-tertiary)]">Past Due</span>
          <span className={`font-mono text-[12px] font-bold tabular-nums ${adCompliance.pastDue > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-emerald)]'}`}>
            {adCompliance.pastDue}
          </span>
        </div>
      </div>
    </div>
  );
});
