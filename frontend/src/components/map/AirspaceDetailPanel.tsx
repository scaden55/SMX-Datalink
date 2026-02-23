import { useState, useMemo } from 'react';
import { X, Plane, Radio, ChevronDown, Clock } from 'lucide-react';
import type { VatsimControllerWithPosition, VatsimPilot, VatsimAtis, VatsimFacilityType } from '@acars/shared';
import { pilotsInAirspace } from '../../lib/geo-utils';

// ── Types ────────────────────────────────────────────────────

interface Props {
  airspaceId: string;
  airspaceType: 'fir' | 'tracon';
  feature: GeoJSON.Feature;
  controllers: VatsimControllerWithPosition[];
  pilots: VatsimPilot[];
  atis: VatsimAtis[];
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

const FACILITY_NAMES: Record<VatsimFacilityType, string> = {
  0: 'OBS', 1: 'FSS', 2: 'DEL', 3: 'GND', 4: 'TWR', 5: 'APP', 6: 'CTR',
};

const FACILITY_COLORS: Record<VatsimFacilityType, string> = {
  0: '#6b7280', 1: '#3b82f6', 2: '#60a5fa', 3: '#22c55e',
  4: '#ef4444', 5: '#f59e0b', 6: '#22d3ee',
};

function formatLogonDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function deriveStatus(pilot: VatsimPilot) {
  const gs = pilot.groundspeed;
  const alt = pilot.altitude;
  if (gs < 50) return { label: 'On Ground', color: '#8e939b' };
  if (alt < 10000 && gs >= 50 && gs < 250) return { label: 'Departing', color: '#3fb950' };
  if (alt >= 25000 && gs >= 200) return { label: 'Cruising', color: '#79c0ff' };
  if (alt >= 10000) return { label: 'En Route', color: '#58a6ff' };
  return { label: 'Arriving', color: '#f0883e' };
}

function formatAltitude(pilot: VatsimPilot): string {
  if (pilot.groundspeed < 50) return 'GND';
  return `FL${Math.round(pilot.altitude / 100).toString().padStart(3, '0')}`;
}

// ── Tabs ─────────────────────────────────────────────────────

type Tab = 'traffic' | 'controller';

// ── Component ────────────────────────────────────────────────

export function AirspaceDetailPanel({
  airspaceId,
  airspaceType,
  feature,
  controllers,
  pilots,
  atis,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('traffic');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (section: string) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

  const accentColor = airspaceType === 'fir' ? '#22d3ee' : '#f59e0b';
  const typeLabel = airspaceType === 'fir' ? 'FIR / Center' : 'TRACON / Approach';
  const airspaceName =
    feature.properties?.name || feature.properties?.NAME || airspaceId;

  // Pilots inside the airspace boundary
  const insidePilots = useMemo(
    () => pilotsInAirspace(pilots, feature),
    [pilots, feature],
  );

  // Controllers assigned to this airspace
  const airspaceControllers = useMemo(
    () => controllers.filter((c) => c.boundaryId === airspaceId),
    [controllers, airspaceId],
  );

  // ATIS entries matching any controller prefix in this airspace
  const airspaceAtis = useMemo(() => {
    const prefixes = new Set(airspaceControllers.map((c) => c.parsed.prefix));
    return atis.filter((a) => {
      const atisPrefix = a.callsign.split('_')[0];
      return prefixes.has(atisPrefix);
    });
  }, [airspaceControllers, atis]);

  return (
    <div className="absolute top-3 right-3 bottom-3 w-[350px] z-[1000] bg-acars-panel rounded-md border border-acars-border flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* ── Sticky Header ── */}
      <div className="px-4 py-3 border-b border-acars-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex items-start gap-2">
            {/* Accent left indicator */}
            <div
              className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
              style={{ backgroundColor: accentColor }}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-acars-text font-mono tracking-wide">
                {airspaceName}
              </h2>
              <span
                className="inline-block text-[9px] font-bold tracking-wider uppercase mt-0.5"
                style={{ color: accentColor }}
              >
                {typeLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-border transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-acars-muted" />
          </button>
        </div>

        {/* Summary row: aircraft count + controller count */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1">
            <Plane className="w-3 h-3 text-acars-muted" />
            <span className="text-[11px] font-bold font-mono text-acars-text">
              {insidePilots.length}
            </span>
            <span className="text-[9px] text-acars-muted uppercase">aircraft</span>
          </div>
          {airspaceControllers.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-bold text-green-400">
                {airspaceControllers.length} ATC
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-acars-border shrink-0">
        {([
          { key: 'traffic' as Tab, label: 'Traffic', icon: Plane },
          { key: 'controller' as Tab, label: 'Controller', icon: Radio },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
              tab === key
                ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/5'
                : 'text-acars-muted hover:text-acars-text hover:bg-acars-border'
            }`}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'traffic' && (
          <TrafficTab pilots={insidePilots} />
        )}
        {tab === 'controller' && (
          <ControllerTab
            controllers={airspaceControllers}
            airspaceAtis={airspaceAtis}
            collapsed={collapsed}
            toggle={toggle}
          />
        )}
      </div>
    </div>
  );
}

// ── Traffic Tab ──────────────────────────────────────────────

function TrafficTab({ pilots }: { pilots: VatsimPilot[] }) {
  // Group pilots by status
  const groups = useMemo(() => {
    const map = new Map<string, { color: string; pilots: VatsimPilot[] }>();
    // Define a stable order
    const order = ['Cruising', 'En Route', 'Departing', 'Arriving', 'On Ground'];

    for (const p of pilots) {
      const status = deriveStatus(p);
      if (!map.has(status.label)) {
        map.set(status.label, { color: status.color, pilots: [] });
      }
      map.get(status.label)!.pilots.push(p);
    }

    // Return groups sorted by order
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, ...map.get(label)! }));
  }, [pilots]);

  if (pilots.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-acars-muted">
        No aircraft in this airspace
      </div>
    );
  }

  return (
    <div className="p-2">
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span
              className="text-[9px] font-bold tracking-wider uppercase"
              style={{ color: group.color }}
            >
              {group.label}
            </span>
            <span className="text-[9px] text-acars-muted">({group.pilots.length})</span>
          </div>
          {group.pilots.map((p) => (
            <div
              key={p.cid}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded mb-0.5 hover:bg-acars-border transition-colors"
            >
              <span className="text-[11px] font-bold font-mono text-acars-text w-16 shrink-0">
                {p.callsign}
              </span>
              <span className="text-[10px] font-mono text-acars-muted">
                {p.flight_plan?.aircraft_short || '—'}
              </span>
              <span className="text-[10px] text-acars-muted ml-auto font-mono">
                {p.flight_plan?.departure && p.flight_plan?.arrival
                  ? `${p.flight_plan.departure} → ${p.flight_plan.arrival}`
                  : '—'}
              </span>
              <span className="text-[10px] font-mono text-acars-muted tabular-nums w-14 text-right">
                {formatAltitude(p)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Controller Tab ───────────────────────────────────────────

function ControllerTab({
  controllers,
  airspaceAtis,
  collapsed,
  toggle,
}: {
  controllers: VatsimControllerWithPosition[];
  airspaceAtis: VatsimAtis[];
  collapsed: Record<string, boolean>;
  toggle: (s: string) => void;
}) {
  if (controllers.length === 0 && airspaceAtis.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-xs text-acars-muted">
        No controllers online for this airspace
      </div>
    );
  }

  return (
    <div>
      {/* ATIS */}
      {airspaceAtis.length > 0 && (
        <div className="border-b border-acars-border">
          <CollapsibleSection
            title="ATIS"
            collapsed={collapsed.atis}
            onToggle={() => toggle('atis')}
          >
            {airspaceAtis.map((a) => (
              <div key={a.callsign} className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="text-[11px] font-bold font-mono text-acars-text">{a.callsign}</span>
                  <span className="text-[11px] font-mono text-sky-400">{a.frequency}</span>
                  {a.atis_code && (
                    <span className="ml-auto px-1.5 py-0.5 rounded bg-sky-500/10 text-[10px] font-bold text-sky-400">
                      {a.atis_code}
                    </span>
                  )}
                </div>
                {a.text_atis && a.text_atis.length > 0 && (
                  <div className="p-2 rounded-md bg-acars-bg/60 border border-acars-border text-[10px] font-mono text-acars-muted leading-relaxed max-h-24 overflow-y-auto">
                    {a.text_atis.join(' ')}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleSection>
        </div>
      )}

      {/* Online Controllers */}
      {controllers.length > 0 && (
        <CollapsibleSection
          title="Online Controllers"
          collapsed={collapsed.online}
          onToggle={() => toggle('online')}
        >
          {controllers.map((ctrl) => (
            <div key={ctrl.callsign} className="mb-1.5">
              <div className="flex items-center gap-2 px-1 py-1.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span
                  className="text-[9px] font-bold tracking-wider uppercase w-10 shrink-0 text-center"
                  style={{ color: FACILITY_COLORS[ctrl.facility] }}
                >
                  {FACILITY_NAMES[ctrl.facility]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-acars-text">{ctrl.callsign}</div>
                  <div className="text-[9px] text-acars-muted">
                    {ctrl.name} &middot;{' '}
                    <Clock className="w-2.5 h-2.5 inline-block -mt-px" />{' '}
                    {formatLogonDuration(ctrl.logon_time)}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-sky-400 tabular-nums shrink-0">
                  {ctrl.frequency}
                </span>
              </div>
              {/* Controller ATIS / text block */}
              {ctrl.text_atis && ctrl.text_atis.length > 0 && (
                <ControllerAtisBlock
                  callsign={ctrl.callsign}
                  text={ctrl.text_atis}
                  collapsed={collapsed[`atis-${ctrl.callsign}`]}
                  onToggle={() => toggle(`atis-${ctrl.callsign}`)}
                />
              )}
            </div>
          ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

// ── Controller ATIS Block ────────────────────────────────────

function ControllerAtisBlock({
  callsign,
  text,
  collapsed,
  onToggle,
}: {
  callsign: string;
  text: string[];
  collapsed?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="ml-8 mr-1 mb-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[9px] text-acars-muted hover:text-acars-text transition-colors"
      >
        <ChevronDown
          className={`w-2.5 h-2.5 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
        <span className="uppercase tracking-wider font-semibold">Controller Info</span>
      </button>
      {!collapsed && (
        <div className="mt-1 p-2 rounded-md bg-acars-bg/60 border border-acars-border text-[10px] font-mono text-acars-muted leading-relaxed max-h-24 overflow-y-auto">
          {text.join(' ')}
        </div>
      )}
    </div>
  );
}

// ── Shared Sub-components ────────────────────────────────────

function CollapsibleSection({
  title,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  collapsed?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-acars-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 hover:bg-acars-border transition-colors"
      >
        <span className="text-[10px] font-semibold text-acars-muted tracking-wider uppercase">{title}</span>
        <div className="flex-1" />
        <ChevronDown
          className={`w-3 h-3 text-acars-muted transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      {!collapsed && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
