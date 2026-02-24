import { useState, useEffect } from 'react';
import {
  X, Plane, Navigation, Gauge, ArrowUpDown, Radio, Route, FileText,
  ChevronDown, Clock, Compass, Copy, Check,
} from 'lucide-react';
import type { VatsimPilot } from '@acars/shared';
import { getApiBase } from '../../lib/api';

// ── Helpers ──────────────────────────────────────────────────

/** Status derived from telemetry — mirrors VATSIM Radar approach */
function deriveStatus(pilot: VatsimPilot): { label: string; color: string; bgColor: string; dotColor: string } {
  const gs = pilot.groundspeed;
  const alt = pilot.altitude;

  if (gs < 50)
    return { label: 'On Ground', color: 'text-[#8e939b]', bgColor: 'bg-[#8e939b]/10', dotColor: '#8e939b' };
  if (alt < 10000 && gs >= 50 && gs < 250)
    return { label: 'Departing', color: 'text-[#3fb950]', bgColor: 'bg-[#3fb950]/10', dotColor: '#3fb950' };
  if (alt >= 25000 && gs >= 200)
    return { label: 'Cruising', color: 'text-[#79c0ff]', bgColor: 'bg-[#79c0ff]/10', dotColor: '#79c0ff' };
  if (alt >= 10000)
    return { label: 'En Route', color: 'text-[#58a6ff]', bgColor: 'bg-[#58a6ff]/10', dotColor: '#58a6ff' };
  return { label: 'Arriving', color: 'text-[#f0883e]', bgColor: 'bg-[#f0883e]/10', dotColor: '#f0883e' };
}

/** Calculate great-circle distance in km between two lat/lon points */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatLogonDuration(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatFlightRules(rules: string): string {
  switch (rules) {
    case 'I': return 'IFR';
    case 'V': return 'VFR';
    case 'Y': return 'IFR→VFR';
    case 'Z': return 'VFR→IFR';
    default: return rules;
  }
}

/** Position-based progress: haversine(dep→current) / haversine(dep→arr) × 100 */
function estimateProgress(
  pilot: VatsimPilot,
  depCoords: [number, number] | null,
  arrCoords: [number, number] | null,
): number | null {
  const fp = pilot.flight_plan;
  if (!fp?.departure || !fp?.arrival) return null;
  if (pilot.groundspeed < 50) return 0;

  // Position-based (most accurate)
  if (depCoords && arrCoords) {
    const totalDist = haversine(depCoords[0], depCoords[1], arrCoords[0], arrCoords[1]);
    if (totalDist > 10) { // > 10 km to avoid div-by-zero on short hops
      const flownDist = haversine(depCoords[0], depCoords[1], pilot.latitude, pilot.longitude);
      return Math.max(0, Math.min(100, (flownDist / totalDist) * 100));
    }
  }

  // Fallback: time-based using deptime + enroute_time
  if (fp.deptime && fp.enroute_time) {
    const depH = parseInt(fp.deptime.slice(0, 2), 10);
    const depM = parseInt(fp.deptime.slice(2, 4), 10);

    // enroute_time can be "HHMM" or "HH:MM"
    let enrH: number, enrM: number;
    if (fp.enroute_time.includes(':')) {
      const parts = fp.enroute_time.split(':');
      enrH = parseInt(parts[0], 10);
      enrM = parseInt(parts[1] ?? '0', 10);
    } else {
      enrH = parseInt(fp.enroute_time.slice(0, 2), 10);
      enrM = parseInt(fp.enroute_time.slice(2, 4), 10);
    }
    const totalEnrouteMin = enrH * 60 + enrM;

    if (totalEnrouteMin > 0 && !isNaN(depH) && !isNaN(depM)) {
      const now = new Date();
      const nowUTCMin = now.getUTCHours() * 60 + now.getUTCMinutes();
      let elapsed = nowUTCMin - (depH * 60 + depM);
      if (elapsed < -120) elapsed += 1440; // day wrap
      return Math.max(0, Math.min(100, (elapsed / totalEnrouteMin) * 100));
    }
  }

  return null;
}

// ── Component ────────────────────────────────────────────────

interface Props {
  pilot: VatsimPilot;
  onClose: () => void;
  onRouteResolved?: (dep: [number, number] | null, arr: [number, number] | null) => void;
}

export function PilotDetailPanel({ pilot, onClose, onRouteResolved }: Props) {
  const status = deriveStatus(pilot);
  const fp = pilot.flight_plan;
  const [copiedRoute, setCopiedRoute] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Fetch dep/arr airport coordinates for position-based progress
  const [depCoords, setDepCoords] = useState<[number, number] | null>(null);
  const [arrCoords, setArrCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    setDepCoords(null);
    setArrCoords(null);
    if (!fp?.departure || !fp?.arrival) return;

    fetch(`${getApiBase()}/api/airports/${encodeURIComponent(fp.departure)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setDepCoords([d.latitude, d.longitude]); })
      .catch(() => {});

    fetch(`${getApiBase()}/api/airports/${encodeURIComponent(fp.arrival)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setArrCoords([d.latitude, d.longitude]); })
      .catch(() => {});
  }, [fp?.departure, fp?.arrival]);

  // Notify parent of resolved route coords (for drawing route line on map)
  useEffect(() => {
    onRouteResolved?.(depCoords, arrCoords);
  }, [depCoords, arrCoords, onRouteResolved]);

  const progress = estimateProgress(pilot, depCoords, arrCoords);

  const toggle = (section: string) =>
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));

  const copyRoute = () => {
    if (fp?.route) {
      navigator.clipboard.writeText(fp.route);
      setCopiedRoute(true);
      setTimeout(() => setCopiedRoute(false), 2000);
    }
  };

  return (
    <div className="absolute top-3 right-3 bottom-3 w-[350px] z-[1000] bg-acars-panel rounded-md border border-acars-border flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* ── Sticky Header ── */}
      <div className="px-4 py-3 border-b border-acars-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-acars-text font-mono tracking-wide">{pilot.callsign}</h2>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${status.bgColor} ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-acars-muted mt-0.5">
              {pilot.name} &middot; CID {pilot.cid}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-acars-border transition-colors shrink-0 ml-2"
          >
            <X className="w-4 h-4 text-acars-muted" />
          </button>
        </div>

        {/* Online time */}
        <div className="flex items-center gap-1.5 mt-2">
          <Clock className="w-3 h-3 text-acars-muted" />
          <span className="text-[10px] text-acars-muted">
            Online {formatLogonDuration(pilot.logon_time)}
          </span>
          {fp && (
            <>
              <span className="text-acars-border mx-1">|</span>
              <span className="text-[10px] text-acars-muted font-mono">
                {formatFlightRules(fp.flight_rules)}
              </span>
              <span className="text-[10px] text-acars-muted font-mono ml-1">
                {fp.aircraft_short || fp.aircraft_faa || '—'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Route Progress ── */}
        {fp && (
          <div className="px-4 py-3 border-b border-acars-border">
            {/* Airport pair */}
            <div className="flex items-center gap-2 mb-3">
              <div className="text-center">
                <div className="text-base font-bold font-mono text-acars-text">{fp.departure}</div>
              </div>
              <div className="flex-1 relative h-6 flex items-center">
                {/* Track line */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-acars-border rounded-full" />
                {/* Filled portion */}
                {progress != null && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] rounded-full"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      background: `linear-gradient(90deg, ${status.dotColor}40, ${status.dotColor})`,
                    }}
                  />
                )}
                {/* Plane icon on the track */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000"
                  style={{ left: `${Math.min(progress ?? 50, 97)}%` }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: status.dotColor, boxShadow: `0 0 8px ${status.dotColor}60` }}
                  >
                    <Plane className="w-3 h-3 text-acars-bg" style={{ transform: 'rotate(45deg)' }} />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-base font-bold font-mono text-acars-text">{fp.arrival}</div>
              </div>
            </div>

            {/* Progress percentage + alternate */}
            <div className="flex items-center justify-between text-[10px]">
              {progress != null && (
                <span className="text-acars-muted">{Math.round(progress)}% complete</span>
              )}
              {fp.alternate && (
                <span className="text-acars-muted ml-auto">
                  ALT <span className="font-mono text-acars-text">{fp.alternate}</span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Data Cards (GS / ALT / HDG) ── */}
        <div className="px-4 py-3 border-b border-acars-border">
          <div className="grid grid-cols-3 gap-2">
            <DataCard
              label="Ground Speed"
              value={`${pilot.groundspeed}`}
              unit="kt"
              icon={Gauge}
            />
            <DataCard
              label="Altitude"
              value={pilot.altitude.toLocaleString()}
              unit="ft"
              icon={ArrowUpDown}
            />
            <DataCard
              label="Heading"
              value={pilot.heading.toString().padStart(3, '0')}
              unit="°"
              icon={Compass}
            />
          </div>
        </div>

        {/* ── Position Details (collapsible) ── */}
        <CollapsibleSection
          title="Position"
          icon={Navigation}
          collapsed={collapsed.position}
          onToggle={() => toggle('position')}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <DataRow label="Squawk" value={pilot.transponder} />
            <DataRow label="QNH" value={`${pilot.qnh_mb} mb / ${pilot.qnh_i_hg.toFixed(2)} inHg`} />
            <DataRow label="Latitude" value={pilot.latitude.toFixed(4)} />
            <DataRow label="Longitude" value={pilot.longitude.toFixed(4)} />
            <DataRow label="Server" value={pilot.server} />
            <DataRow label="Rating" value={pilotRatingName(pilot.pilot_rating)} />
          </div>
        </CollapsibleSection>

        {/* ── Flight Plan (collapsible) ── */}
        {fp ? (
          <CollapsibleSection
            title="Flight Plan"
            icon={FileText}
            collapsed={collapsed.flightplan}
            onToggle={() => toggle('flightplan')}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <DataRow label="Aircraft" value={fp.aircraft_short || fp.aircraft_faa || fp.aircraft} />
              <DataRow label="Rules" value={formatFlightRules(fp.flight_rules)} />
              <DataRow label="Cruise TAS" value={`${fp.cruise_tas} kt`} />
              <DataRow label="Filed Alt" value={fp.altitude} />
              <DataRow label="Dep Time" value={fp.deptime ? `${fp.deptime.slice(0, 2)}:${fp.deptime.slice(2)}z` : '—'} />
              <DataRow label="Enroute" value={fp.enroute_time || '—'} />
              <DataRow label="Fuel Time" value={fp.fuel_time || '—'} />
              <DataRow label="Transponder" value={fp.assigned_transponder || '—'} />
            </div>
          </CollapsibleSection>
        ) : (
          <div className="px-4 py-8 text-center text-xs text-acars-muted">
            No flight plan filed
          </div>
        )}

        {/* ── Route String (collapsible) ── */}
        {fp?.route && (
          <CollapsibleSection
            title="Route"
            icon={Route}
            collapsed={collapsed.route}
            onToggle={() => toggle('route')}
            action={
              <button
                onClick={(e) => { e.stopPropagation(); copyRoute(); }}
                className="p-1 rounded hover:bg-acars-border transition-colors"
                title="Copy route"
              >
                {copiedRoute
                  ? <Check className="w-3 h-3 text-emerald-400" />
                  : <Copy className="w-3 h-3 text-acars-muted" />
                }
              </button>
            }
          >
            <div className="p-2.5 rounded-md bg-acars-bg/80 border border-acars-border text-[11px] font-mono text-acars-text leading-relaxed max-h-28 overflow-y-auto break-all select-all">
              {fp.route}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Remarks (collapsible) ── */}
        {fp?.remarks && (
          <CollapsibleSection
            title="Remarks"
            collapsed={collapsed.remarks}
            onToggle={() => toggle('remarks')}
          >
            <div className="p-2.5 rounded-md bg-acars-bg/80 border border-acars-border text-[10px] font-mono text-acars-muted leading-relaxed max-h-24 overflow-y-auto break-all">
              {fp.remarks}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

// ── Pilot Rating Helper ──────────────────────────────────────

function pilotRatingName(rating: number): string {
  switch (rating) {
    case 0: return 'NEW';
    case 1: return 'PPL';
    case 3: return 'IR';
    case 7: return 'CMEL';
    case 15: return 'ATPL';
    default: return `P${rating}`;
  }
}

// ── Sub-components ───────────────────────────────────────────

/** A prominent data card with icon, label, and large value */
function DataCard({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-md bg-acars-bg/60 border border-acars-border px-2.5 py-2">
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3 text-acars-muted" />
        <span className="text-[9px] text-acars-muted uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-base font-bold font-mono text-acars-text tabular-nums">{value}</span>
        <span className="text-[10px] text-acars-muted">{unit}</span>
      </div>
    </div>
  );
}

/** Collapsible section with header */
function CollapsibleSection({
  title,
  icon: Icon,
  collapsed,
  onToggle,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsed?: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-acars-border">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
        className="w-full flex items-center gap-1.5 px-4 py-2.5 hover:bg-acars-border transition-colors cursor-pointer select-none"
      >
        {Icon && <Icon className="w-3 h-3 text-acars-muted" />}
        <span className="text-[10px] font-semibold text-acars-muted tracking-wider uppercase">{title}</span>
        <div className="flex-1" />
        {action}
        <ChevronDown
          className={`w-3 h-3 text-acars-muted transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`}
        />
      </div>
      {!collapsed && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Compact label→value row */
function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-acars-muted">{label}</span>
      <span className="text-[11px] text-acars-text font-mono tabular-nums">{value}</span>
    </div>
  );
}
