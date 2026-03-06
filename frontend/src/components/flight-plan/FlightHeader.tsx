import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useDispatchTelemetry } from '../../hooks/useDispatchTelemetry';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightHeaderProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
}

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

function formatDateHeader(): string {
  const d = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function FlightHeader({ ofp, formData }: FlightHeaderProps) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const progress = useFlightPlanStore((s) => s.progress);
  const airports = useFlightPlanStore((s) => s.airports);
  const { aircraft } = useDispatchTelemetry();

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

  const schedDep = formatDayTime(ofp?.times?.schedDep);
  const schedArr = formatDayTime(ofp?.times?.schedArr);
  const etd = formData?.etd ? formData.etd + 'z' : schedDep;
  // ETA: use schedArr as fallback
  const eta = schedArr;

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
        <span className="text-[10px] text-acars-muted/70 truncate">{depLabel}</span>
        <span className="text-[10px] text-acars-muted/70 uppercase tracking-wider shrink-0">{formatDateHeader()}</span>
        <span className="text-[10px] text-acars-muted/70 truncate text-right">{arrLabel}</span>
      </div>

      {/* Row 2: ICAO codes + route center line */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-0">
        {/* Origin */}
        <span className="shrink-0">
          <span className="text-[20px] font-semibold text-acars-text tabular-nums">{origin}</span>
          <span className="text-[13px] text-acars-muted/70 ml-1">/ {depIata}</span>
        </span>

        {/* Center: dotted line + route data + flight number */}
        <div className="flex items-center mx-2 min-w-0">
          <div className="flex-1 border-b border-dotted border-acars-border/40" />
          <span className="px-2 shrink-0 text-center text-[15px] font-medium text-acars-text tabular-nums">
            {flightId}
          </span>
          <div className="flex-1 border-b border-dotted border-acars-border/40" />
        </div>

        {/* Destination */}
        <span className="shrink-0 text-right">
          <span className="text-[20px] font-semibold text-acars-text tabular-nums">{destination}</span>
          <span className="text-[13px] text-acars-muted/70 ml-1">/ {arrIata}</span>
        </span>
      </div>

      {/* Row 3: STD/ETD left | flight number center | STA/ETA right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1.5">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-acars-muted/70">STD <span className="text-acars-text/80 tabular-nums">{schedDep}</span></span>
          <span className="text-acars-border/60">|</span>
          <span className="text-acars-muted/70">ETD <span className="text-acars-text/80 tabular-nums">{etd}</span></span>
        </div>
        <span className="text-center shrink-0 px-3 text-[11px] font-medium text-blue-400/80 tabular-nums">
          {flightId}
        </span>
        <div className="flex items-center justify-end gap-2 text-[10px]">
          <span className="text-acars-muted/70">STA <span className="text-acars-text/80 tabular-nums">{schedArr}</span></span>
          <span className="text-acars-border/60">|</span>
          <span className="text-acars-muted/70">ETA <span className="text-acars-text/80 tabular-nums">{eta}</span></span>
        </div>
      </div>

      {/* Row 4: On Time left | ETE center | late badge right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1">
        <div>
          <span className="inline-flex items-center px-1.5 py-0 rounded-[2px] text-[10px] font-semibold uppercase tracking-[0.06em] bg-emerald-500/15 text-emerald-400">
            On Time
          </span>
        </div>
        <span className="text-center shrink-0 px-3 text-[11px] text-acars-text/80">
          ETE <span className="tabular-nums font-semibold">{ete}</span>
        </span>
        <div className="flex justify-end">
          {/* Show late badge only when there's a delay — placeholder for now */}
        </div>
      </div>
    </div>
  );
}
