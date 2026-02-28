import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  SpinnerGap,
  AirplaneTilt,
  AirplaneTakeoff,
  AirplaneLanding,
  Clock,
  GasPump,
  Ruler,
  Users,
  Package,
  ArrowRight,
  CheckCircle,
  Warning,
  XCircle,
  Prohibit,
  Path,
  Gauge,
  ChartBar,
  ChatText,
  NavigationArrow,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { VatsimBadge } from '../components/common/VatsimBadge';
import type { LogbookEntry, LogbookStatus, FlightExceedance } from '@acars/shared';

// ─── Helpers ────────────────────────────────────────────────────

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'z';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // HH:MM or other non-ISO format
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'z';
}

function formatDurationBetween(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val == null) return '—';
  return val.toLocaleString() + (suffix ? ` ${suffix}` : '');
}

function landingRateLabel(fpm: number): { label: string; color: string } {
  const abs = Math.abs(fpm);
  if (abs <= 100) return { label: 'Butter', color: 'text-emerald-400' };
  if (abs <= 150) return { label: 'Smooth', color: 'text-emerald-400' };
  if (abs <= 200) return { label: 'Normal', color: 'text-blue-400' };
  if (abs <= 250) return { label: 'Firm', color: 'text-amber-400' };
  return { label: 'Hard', color: 'text-red-400' };
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 95) return { label: 'Excellent', color: 'text-emerald-400' };
  if (score >= 85) return { label: 'Good', color: 'text-emerald-400' };
  if (score >= 75) return { label: 'Fair', color: 'text-amber-400' };
  if (score >= 60) return { label: 'Below Average', color: 'text-amber-400' };
  return { label: 'Poor', color: 'text-red-400' };
}

const STATUS_CONFIG: Record<LogbookStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending:   { label: 'Pending',   icon: Clock,         color: 'text-blue-400' },
  approved:  { label: 'Approved',  icon: CheckCircle,  color: 'text-emerald-400' },
  completed: { label: 'Completed', icon: CheckCircle,  color: 'text-emerald-400' },
  diverted:  { label: 'Diverted',  icon: Warning, color: 'text-amber-400' },
  rejected:  { label: 'Rejected',  icon: XCircle,       color: 'text-red-400' },
  cancelled: { label: 'Cancelled', icon: Prohibit,           color: 'text-acars-muted' },
};

function InfoRow({ label, value, icon: Icon, iconColor, valueClass = '' }: {
  label: string;
  value: string;
  icon?: typeof AirplaneTilt;
  iconColor?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && <Icon className={`w-4 h-4 mt-0.5 flex-none ${iconColor ?? 'text-acars-muted'}`} />}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">{label}</div>
        <div className={`text-sm text-acars-text font-medium ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}

function OooiTimeline({ entry }: { entry: LogbookEntry }) {
  if (!entry.oooiOut) return null;

  const events = [
    { key: 'OUT', time: entry.oooiOut, label: 'Gate Out' },
    { key: 'OFF', time: entry.oooiOff, label: 'Wheels Off' },
    { key: 'ON', time: entry.oooiOn, label: 'Touchdown' },
    { key: 'IN', time: entry.oooiIn, label: 'Gate In' },
  ];

  const taxiOut = entry.oooiOut && entry.oooiOff
    ? formatDurationBetween(entry.oooiOut, entry.oooiOff) : null;
  const airborne = entry.oooiOff && entry.oooiOn
    ? formatDurationBetween(entry.oooiOff, entry.oooiOn) : null;
  const taxiIn = entry.oooiOn && entry.oooiIn
    ? formatDurationBetween(entry.oooiOn, entry.oooiIn) : null;

  return (
    <div className="panel rounded-md p-4 mb-4">
      <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-4 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        OOOI Times
      </h3>

      {/* Timeline bar */}
      <div className="flex items-center gap-0 mb-3">
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-400/30" />
        </div>
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-0.5 border-t-2 border-dashed border-acars-border" />
          {taxiOut && <div className="text-[10px] text-acars-muted mt-1">Taxi {taxiOut}</div>}
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-400/30" />
        </div>
        <div className="flex-[3] flex flex-col items-center">
          <div className="w-full h-0.5 bg-blue-400" />
          {airborne && <div className="text-[10px] text-blue-400 font-semibold mt-1">Flight {airborne}</div>}
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-400/30" />
        </div>
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full h-0.5 border-t-2 border-dashed border-acars-border" />
          {taxiIn && <div className="text-[10px] text-acars-muted mt-1">Taxi {taxiIn}</div>}
        </div>
        <div className="flex flex-col items-center">
          <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-emerald-400/30" />
        </div>
      </div>

      {/* Timestamps row */}
      <div className="flex justify-between text-center">
        {events.map(e => (
          <div key={e.key} className="flex flex-col items-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium">{e.key}</div>
            <div className="text-xs font-mono text-acars-text font-semibold">
              {e.time ? formatTime(e.time) : '—'}
            </div>
            <div className="text-[10px] text-acars-muted">{e.label}</div>
          </div>
        ))}
      </div>

      {/* Block time summary */}
      {entry.blockTimeMin != null && (
        <div className="mt-3 pt-3 border-t border-acars-border flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted">Block Time</div>
            <div className="text-sm font-mono font-bold text-acars-text">{formatDuration(entry.blockTimeMin)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-acars-muted">Flight Time</div>
            <div className="text-sm font-mono font-bold text-blue-400">{entry.flightTimeMin > 0 ? formatDuration(entry.flightTimeMin) : '—'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FlightDetailPage ───────────────────────────────────────────

export function FlightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<LogbookEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exceedances, setExceedances] = useState<FlightExceedance[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<LogbookEntry>(`/api/logbook/${id}`)
      .then(data => setEntry(data))
      .catch(err => setError(err?.message || 'Failed to load flight'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!entry) return;
    api.get<FlightExceedance[]>(`/api/logbook/${entry.id}/exceedances`)
      .then(setExceedances)
      .catch(() => {}); // non-critical
  }, [entry]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <SpinnerGap className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-red-400">{error || 'Flight not found'}</p>
        <button onClick={() => navigate('/logbook')} className="text-xs text-blue-400 hover:underline">
          Back to Logbook
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.approved;
  const StatusIcon = statusCfg.icon;
  const landingInfo = entry.landingRateFpm != null ? landingRateLabel(entry.landingRateFpm) : null;
  const scoreInfo = entry.score != null ? scoreLabel(entry.score) : null;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-5 py-5">

        {/* ── Back + Header ──────────────────────────────────── */}
        <button
          onClick={() => navigate('/logbook')}
          className="flex items-center gap-1.5 text-xs text-acars-muted hover:text-acars-text transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Logbook
        </button>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-amber-500/10 border border-amber-400/20">
              <AirplaneTilt className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-acars-text font-mono">{entry.flightNumber}</h1>
              <p className="text-xs text-acars-muted">{formatDateTime(entry.actualDep)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <VatsimBadge connected={entry.vatsimConnected} callsign={entry.vatsimCallsign} mode="full" />
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold ${
              entry.status === 'approved' || entry.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-400/20' :
              entry.status === 'pending' ? 'bg-blue-500/10 text-blue-400 border border-blue-400/20' :
              entry.status === 'rejected' ? 'bg-red-500/10 text-red-400 border border-red-400/20' :
              entry.status === 'diverted' ? 'bg-amber-500/10 text-amber-400 border border-amber-400/20' :
              'bg-acars-muted/10 text-acars-muted border border-acars-border'
            }`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* ── Path Hero ─────────────────────────────────────── */}
        <div className="panel rounded-md p-5 mb-4">
          <div className="flex items-center justify-center gap-8">
            {/* Departure */}
            <div className="text-center">
              <AirplaneTakeoff className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <div className="text-2xl font-bold font-mono text-acars-text">{entry.depIcao}</div>
              {entry.depName && <div className="text-xs text-acars-muted mt-0.5">{entry.depName}</div>}
              <div className="text-xs text-acars-muted mt-1">
                <span className="text-acars-text font-medium">{formatTime(entry.actualDep)}</span>
                {entry.scheduledDep && (
                  <span className="text-acars-muted ml-1">(sched {formatTime(entry.scheduledDep)})</span>
                )}
              </div>
            </div>

            {/* Connection line */}
            <div className="flex flex-col items-center flex-1 max-w-xs">
              <div className="text-xs text-acars-muted font-mono mb-1">{entry.flightTimeMin > 0 ? formatDuration(entry.flightTimeMin) : '—'}</div>
              <div className="w-full flex items-center">
                <div className="h-px flex-1 bg-acars-border" />
                <ArrowRight className="w-4 h-4 text-sky-400/40 mx-2" />
                <div className="h-px flex-1 bg-acars-border" />
              </div>
              <div className="text-xs text-acars-muted font-mono mt-1">{entry.distanceNm.toLocaleString()} nm</div>
            </div>

            {/* Arrival */}
            <div className="text-center">
              <AirplaneLanding className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <div className="text-2xl font-bold font-mono text-acars-text">{entry.arrIcao}</div>
              {entry.arrName && <div className="text-xs text-acars-muted mt-0.5">{entry.arrName}</div>}
              <div className="text-xs text-acars-muted mt-1">
                <span className="text-acars-text font-medium">{formatTime(entry.actualArr)}</span>
                {entry.scheduledArr && (
                  <span className="text-acars-muted ml-1">(sched {formatTime(entry.scheduledArr)})</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── OOOI Timeline ──────────────────────────────────── */}
        <OooiTimeline entry={entry} />

        {/* ── Performance + Score ─────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Landing & Score */}
          <div className="panel rounded-md p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <ChartBar className="w-3.5 h-3.5 text-emerald-400" />
              Performance
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">Landing Rate</div>
                {entry.landingRateFpm != null ? (
                  <>
                    <div className={`text-xl font-bold font-mono ${landingInfo!.color}`}>
                      {entry.landingRateFpm} <span className="text-xs font-normal">fpm</span>
                    </div>
                    <div className={`text-xs ${landingInfo!.color}`}>{landingInfo!.label}</div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-acars-muted">—</div>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">Flight Score</div>
                {entry.score != null ? (
                  <>
                    <div className={`text-xl font-bold font-mono ${scoreInfo!.color}`}>
                      {entry.score} <span className="text-xs font-normal">/ 100</span>
                    </div>
                    <div className={`text-xs ${scoreInfo!.color}`}>{scoreInfo!.label}</div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-acars-muted">—</div>
                )}
              </div>
            </div>
          </div>

          {/* GasPump */}
          <div className="panel rounded-md p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <GasPump className="w-3.5 h-3.5 text-amber-400" />
              Fuel
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">Fuel Used</div>
                <div className="text-xl font-bold font-mono text-acars-text">
                  {entry.fuelUsedLbs != null ? entry.fuelUsedLbs.toLocaleString() : '—'}
                  {entry.fuelUsedLbs != null && <span className="text-xs font-normal text-acars-muted ml-1">lbs</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-acars-muted mb-1">Fuel Planned</div>
                <div className="text-xl font-bold font-mono text-acars-text">
                  {entry.fuelPlannedLbs != null ? entry.fuelPlannedLbs.toLocaleString() : '—'}
                  {entry.fuelPlannedLbs != null && <span className="text-xs font-normal text-acars-muted ml-1">lbs</span>}
                </div>
              </div>
            </div>
            {entry.fuelUsedLbs != null && entry.fuelPlannedLbs != null && (
              <div className="mt-2 pt-2 border-t border-acars-border">
                <div className="text-[10px] uppercase tracking-wider text-acars-muted">Variance</div>
                <div className={`text-sm font-mono font-semibold ${
                  entry.fuelUsedLbs <= entry.fuelPlannedLbs ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {entry.fuelUsedLbs <= entry.fuelPlannedLbs ? '' : '+'}
                  {(entry.fuelUsedLbs - entry.fuelPlannedLbs).toLocaleString()} lbs
                  ({Math.round((entry.fuelUsedLbs / entry.fuelPlannedLbs) * 100)}% of planned)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Events ───────────────────────────────────────── */}
        {exceedances.length > 0 && (
          <div className="panel rounded-md p-4 mb-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <Warning className="w-3.5 h-3.5 text-amber-400" weight="fill" />
              Events ({exceedances.length})
            </h3>
            <div className="space-y-2">
              {exceedances.map((exc) => (
                <div
                  key={exc.id}
                  className={`flex items-start justify-between text-xs p-3 rounded-md border ${
                    exc.severity === 'critical'
                      ? 'border-l-2 border-l-red-500 border-red-500/20 bg-red-500/5'
                      : 'border-l-2 border-l-amber-500 border-amber-500/20 bg-amber-500/5'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-medium text-acars-text">
                      {exc.type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-acars-muted">{exc.message}</div>
                    <div className="text-acars-muted text-[10px]">
                      Detected during {exc.phase} at{' '}
                      {new Date(exc.detectedAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZone: 'UTC',
                      })}{' '}
                      UTC
                    </div>
                    {exc.type === 'HARD_LANDING' && (
                      <div className="text-amber-400 text-[10px] mt-1">
                        → Maintenance inspection scheduled
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      exc.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {exc.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Flight Details ──────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="panel rounded-md p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <AirplaneTilt className="w-3.5 h-3.5 text-sky-400" />
              Aircraft
            </h3>
            <InfoRow label="Type" value={entry.aircraftType} icon={AirplaneTilt} iconColor="text-sky-400" />
            {entry.aircraftRegistration && (
              <InfoRow label="Registration" value={entry.aircraftRegistration} icon={NavigationArrow} iconColor="text-blue-400" />
            )}
            <InfoRow label="Passengers" value={fmt(entry.paxCount)} icon={Users} iconColor="text-blue-400" />
            <InfoRow label="Cargo" value={fmt(entry.cargoLbs, 'lbs')} icon={Package} iconColor="text-amber-400" />
          </div>

          <div className="panel rounded-md p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
              <Path className="w-3.5 h-3.5 text-blue-400" />
              Flight Plan
            </h3>
            <InfoRow label="Cruise Altitude" value={entry.cruiseAltitude ?? '—'} icon={Gauge} iconColor="text-blue-400" />
            <InfoRow label="Distance" value={fmt(entry.distanceNm, 'nm')} icon={Ruler} iconColor="text-sky-400" />
            <InfoRow label="Flight Time" value={entry.flightTimeMin > 0 ? formatDuration(entry.flightTimeMin) : '—'} icon={Clock} iconColor="text-amber-400" />
            <InfoRow
              label="Network"
              value={entry.vatsimConnected ? `VATSIM (${entry.vatsimCallsign ?? 'Connected'})` : 'Offline'}
              valueClass={entry.vatsimConnected ? 'text-emerald-400' : ''}
            />
            {entry.route && (
              <div className="mt-2 pt-2 border-t border-acars-border">
                <div className="text-[10px] uppercase tracking-wider text-acars-muted font-medium mb-1">Path</div>
                <div className="text-xs text-acars-text font-mono leading-relaxed bg-acars-bg rounded px-2 py-1.5 border border-acars-border">
                  {entry.route}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Pilot & Remarks ─────────────────────────────────── */}
        <div className="panel rounded-md p-4 mb-4">
          <h3 className="text-[11px] uppercase tracking-wider text-acars-muted font-medium mb-3 flex items-center gap-2">
            <ChatText className="w-3.5 h-3.5 text-blue-400" />
            Pilot Notes
          </h3>
          <div className="flex items-center gap-4 mb-3">
            {entry.pilotCallsign && (
              <div className="text-xs">
                <span className="text-acars-muted">Pilot: </span>
                <span className="text-acars-text font-semibold font-mono">{entry.pilotCallsign}</span>
                {entry.pilotName && <span className="text-acars-muted ml-1">({entry.pilotName})</span>}
              </div>
            )}
            <div className="text-xs">
              <span className="text-acars-muted">Filed: </span>
              <span className="text-acars-text">{formatDateTime(entry.createdAt)}</span>
            </div>
          </div>
          {entry.remarks ? (
            <div className="text-sm text-acars-text bg-acars-bg rounded px-3 py-2 border border-acars-border leading-relaxed">
              {entry.remarks}
            </div>
          ) : (
            <p className="text-xs text-acars-muted italic">No remarks recorded for this flight.</p>
          )}
        </div>

      </div>
    </div>
  );
}
