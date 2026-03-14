import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import { useFlightEventStore } from '../../stores/flightEventStore';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightHeaderProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
  pilotCallsign?: string;
}

/** Format a Unix epoch string (seconds) to "DD - HH:MMz" */
function formatDayTime(epoch: string | undefined): string {
  if (!epoch) return '---';
  const ts = Number(epoch);
  if (isNaN(ts)) return '---';
  const d = new Date(ts * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd} - ${hh}:${mm}z`;
}

/** Format an ISO string to "DD - HH:MMz" */
function formatIso(iso: string | null): string {
  if (!iso) return '---';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '---';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd} - ${hh}:${mm}z`;
}

function formatDateHeader(): string {
  const d = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Phases that indicate the aircraft has departed */
const DEPARTED_PHASES = new Set(['TAKEOFF', 'CLIMB', 'CRUISE', 'DESCENT', 'APPROACH', 'LANDING', 'TAXI_IN', 'PARKED']);
/** Phases that indicate the aircraft has landed */
const LANDED_PHASES = new Set(['LANDING', 'TAXI_IN', 'PARKED']);

export function FlightHeader({ ofp, formData, pilotCallsign }: FlightHeaderProps) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const progress = useFlightPlanStore((s) => s.progress);
  const airports = useFlightPlanStore((s) => s.airports);
  const { flight, connected } = useDispatchTelemetry();

  // OOOI times for actual departure/arrival
  const oooiOff = useFlightEventStore((s) => s.oooiOff);
  const oooiOn = useFlightEventStore((s) => s.oooiOn);

  const origin = flightPlan?.origin ?? 'XXXX';
  const destination = flightPlan?.destination ?? 'XXXX';
  const flightId = formData?.flightNumber || flightPlan?.id || '---';

  const depIata = origin.length === 4 ? origin.slice(1) : '---';
  const arrIata = destination.length === 4 ? destination.slice(1) : '---';

  const depAirport = airports.find((a) => a.icao === origin);
  const arrAirport = airports.find((a) => a.icao === destination);

  const depLabel = depAirport
    ? `${depAirport.name}, ${depAirport.city}, ${depAirport.state}, ${depAirport.country}`
    : origin;
  const arrLabel = arrAirport
    ? `${arrAirport.name}, ${arrAirport.city}, ${arrAirport.state}, ${arrAirport.country}`
    : destination;

  // ── Scheduled times (always shown) ─────────────────────────
  const schedDep = formatDayTime(ofp?.times?.schedDep);
  const schedArr = formatDayTime(ofp?.times?.schedArr);

  // ── Flight phase awareness ─────────────────────────────────
  const phase = flight?.phase ?? null;
  const hasDeparted = phase ? DEPARTED_PHASES.has(phase) : false;
  const hasLanded = phase ? LANDED_PHASES.has(phase) : false;

  // ── Departure time: ETD → ATD after takeoff ────────────────
  let depTimeLabel = '';
  let depTimeValue = '';
  if (hasDeparted && oooiOff) {
    depTimeLabel = 'ATD';
    depTimeValue = formatIso(oooiOff);
  } else if (connected) {
    depTimeLabel = 'ETD';
    depTimeValue = formData?.etd ? formData.etd + 'z' : schedDep;
  }

  // ── Arrival time: ETA → ATA after landing ──────────────────
  let arrTimeLabel = '';
  let arrTimeValue = '';
  if (hasLanded && oooiOn) {
    arrTimeLabel = 'ATA';
    arrTimeValue = formatIso(oooiOn);
  } else if (connected && progress?.etaDestination) {
    arrTimeLabel = 'ETA';
    arrTimeValue = formatIso(progress.etaDestination);
  }

  // ── On Time / Delayed badge ────────────────────────────────
  // Compare STD vs ATD (if available) to determine punctuality
  const schedDepEpoch = ofp?.times?.schedDep ? Number(ofp.times.schedDep) * 1000 : null;
  const atdEpoch = hasDeparted && oooiOff ? new Date(oooiOff).getTime() : null;
  let punctuality: 'on-time' | 'delayed' | 'early' | null = null;
  let delayMinutes = 0;
  if (schedDepEpoch && atdEpoch) {
    delayMinutes = Math.round((atdEpoch - schedDepEpoch) / 60_000);
    if (delayMinutes <= 15) punctuality = delayMinutes < -5 ? 'early' : 'on-time';
    else punctuality = 'delayed';
  }

  // ── ETE ────────────────────────────────────────────────────
  const enrouteMin = ofp?.times?.estEnroute ?? 0;
  const ete = (() => {
    const s = progress?.eteDestination;
    if (s) {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    }
    if (enrouteMin > 0) {
      return `${String(Math.floor(enrouteMin / 60)).padStart(2, '0')}h ${String(enrouteMin % 60).padStart(2, '0')}m`;
    }
    return '---';
  })();

  return (
    <div className="border-b border-acars-border px-4 py-2.5">
      {/* Row 1: Airport names + date */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-1">
        <span className="text-[11px] text-acars-muted/70 truncate">{depLabel}</span>
        <span className="text-[11px] text-acars-muted/70 uppercase tracking-wider shrink-0">{formatDateHeader()}</span>
        <span className="text-[11px] text-acars-muted/70 truncate text-right">{arrLabel}</span>
      </div>

      {/* Row 2: ICAO codes + route center line */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-0">
        {/* Origin */}
        <span className="shrink-0">
          <span className="text-[20px] font-mono font-semibold text-acars-text tabular-nums">{origin}</span>
          <span className="text-[13px] font-mono text-acars-muted/70 ml-1">/ {depIata}</span>
        </span>

        {/* Center: dotted line + flight number */}
        <div className="flex items-center mx-2 min-w-0">
          <div className="flex-1 border-b border-dotted border-acars-border/40" />
          <span className="px-2 shrink-0 text-center text-[15px] font-mono font-medium text-acars-text tabular-nums">
            {flightId}
          </span>
          <div className="flex-1 border-b border-dotted border-acars-border/40" />
        </div>

        {/* Destination */}
        <span className="shrink-0 text-right">
          <span className="text-[20px] font-mono font-semibold text-acars-text tabular-nums">{destination}</span>
          <span className="text-[13px] font-mono text-acars-muted/70 ml-1">/ {arrIata}</span>
        </span>
      </div>

      {/* Row 3: STD + ETD/ATD left | pilot callsign center | STA + ETA/ATA right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-acars-muted/70">STD <span className="text-acars-text/80 font-mono tabular-nums">{schedDep}</span></span>
          {depTimeLabel && (
            <>
              <span className="text-acars-border/60">|</span>
              <span className={depTimeLabel === 'ATD' ? 'text-emerald-400/80' : 'text-acars-muted/70'}>
                {depTimeLabel} <span className="text-acars-text/80 font-mono tabular-nums">{depTimeValue}</span>
              </span>
            </>
          )}
        </div>
        <span className="text-center shrink-0 px-3 text-[12px] font-mono font-medium text-blue-400/80 tabular-nums uppercase">
          {pilotCallsign || '---'}
        </span>
        <div className="flex items-center justify-end gap-2 text-[11px]">
          <span className="text-acars-muted/70">STA <span className="text-acars-text/80 font-mono tabular-nums">{schedArr}</span></span>
          {arrTimeLabel && (
            <>
              <span className="text-acars-border/60">|</span>
              <span className={arrTimeLabel === 'ATA' ? 'text-emerald-400/80' : 'text-acars-muted/70'}>
                {arrTimeLabel} <span className="text-acars-text/80 font-mono tabular-nums">{arrTimeValue}</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Row 4: Punctuality badge left | ETE center */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1">
        <div>
          {punctuality === 'on-time' && (
            <span className="inline-flex items-center px-1.5 py-0 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] bg-emerald-500/15 text-emerald-400">
              On Time
            </span>
          )}
          {punctuality === 'early' && (
            <span className="inline-flex items-center px-1.5 py-0 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] bg-emerald-500/15 text-emerald-400">
              Early {Math.abs(delayMinutes)}m
            </span>
          )}
          {punctuality === 'delayed' && (
            <span className="inline-flex items-center px-1.5 py-0 rounded-[2px] text-[11px] font-semibold uppercase tracking-[0.06em] bg-amber-500/15 text-amber-400">
              Delayed +{delayMinutes}m
            </span>
          )}
        </div>
        <span className="text-center shrink-0 px-3 text-[12px] text-acars-text/80">
          ETE <span className="font-mono tabular-nums font-semibold">{ete}</span>
        </span>
        <div className="flex justify-end">
          {/* Reserved for future badges */}
        </div>
      </div>
    </div>
  );
}
