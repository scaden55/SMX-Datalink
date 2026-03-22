import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

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

function formatDateHeader(): string {
  const d = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${days[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function FlightHeader({ flight }: { flight: DispatchFlight }) {
  const { editableFields } = useDispatchEdit();

  const origin = flight.bid.depIcao ?? 'XXXX';
  const destination = flight.bid.arrIcao ?? 'XXXX';
  const flightId = flight.bid.flightNumber || '---';

  const depIata = origin.length === 4 ? origin.slice(1) : '---';
  const arrIata = destination.length === 4 ? destination.slice(1) : '---';

  const depLabel = flight.bid.depName || origin;
  const arrLabel = flight.bid.arrName || destination;

  // Scheduled times
  const schedDep = formatDayTime(flight.ofpJson?.times?.schedDep);
  const schedArr = formatDayTime(flight.ofpJson?.times?.schedArr);

  // ETD from editable fields or flight plan data
  const etd = (editableFields.etd as string) || flight.flightPlanData?.etd || flight.bid.depTime || '';

  // ETE
  const enrouteMin = flight.ofpJson?.times?.estEnroute ?? flight.bid.flightTimeMin ?? 0;
  const ete = enrouteMin > 0
    ? `${String(Math.floor(enrouteMin / 60)).padStart(2, '0')}h ${String(enrouteMin % 60).padStart(2, '0')}m`
    : '---';

  // Pilot callsign
  const pilotCallsign = flight.pilot.callsign || '---';

  return (
    <div className="border-b border-[var(--surface-3)] px-4 py-2.5">
      {/* Row 1: Airport names + date */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-1">
        <span className="text-[11px] text-[var(--text-muted)]/70 truncate">{depLabel}</span>
        <span className="text-[11px] text-[var(--text-muted)]/70 uppercase tracking-wider shrink-0">{formatDateHeader()}</span>
        <span className="text-[11px] text-[var(--text-muted)]/70 truncate text-right">{arrLabel}</span>
      </div>

      {/* Row 2: ICAO codes + route center line */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-0">
        {/* Origin */}
        <span className="shrink-0">
          <span className="text-[20px] font-mono font-semibold text-[var(--text-primary)] tabular-nums">{origin}</span>
          <span className="text-[13px] font-mono text-[var(--text-muted)]/70 ml-1">/ {depIata}</span>
        </span>

        {/* Center: dotted line + flight number */}
        <div className="flex items-center mx-2 min-w-0">
          <div className="flex-1 border-b border-dotted border-[var(--surface-3)]/40" />
          <span className="px-2 shrink-0 text-center text-[15px] font-mono font-medium text-[var(--text-primary)] tabular-nums">
            {flightId}
          </span>
          <div className="flex-1 border-b border-dotted border-[var(--surface-3)]/40" />
        </div>

        {/* Destination */}
        <span className="shrink-0 text-right">
          <span className="text-[20px] font-mono font-semibold text-[var(--text-primary)] tabular-nums">{destination}</span>
          <span className="text-[13px] font-mono text-[var(--text-muted)]/70 ml-1">/ {arrIata}</span>
        </span>
      </div>

      {/* Row 3: STD left | pilot callsign center | STA right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[var(--text-muted)]/70">STD <span className="text-[var(--text-primary)]/80 font-mono tabular-nums">{schedDep}</span></span>
          {etd && (
            <>
              <span className="text-[var(--surface-3)]/60">|</span>
              <span className="text-[var(--text-muted)]/70">
                ETD <span className="text-[var(--text-primary)]/80 font-mono tabular-nums">{etd}z</span>
              </span>
            </>
          )}
        </div>
        <span className="text-center shrink-0 px-3 text-[12px] font-mono font-medium text-blue-400/80 tabular-nums uppercase">
          {pilotCallsign}
        </span>
        <div className="flex items-center justify-end gap-2 text-[11px]">
          <span className="text-[var(--text-muted)]/70">STA <span className="text-[var(--text-primary)]/80 font-mono tabular-nums">{schedArr}</span></span>
        </div>
      </div>

      {/* Row 4: ETE center */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mt-1">
        <div />
        <span className="text-center shrink-0 px-3 text-[12px] text-[var(--text-primary)]/80">
          ETE <span className="font-mono tabular-nums font-semibold">{ete}</span>
        </span>
        <div />
      </div>
    </div>
  );
}
