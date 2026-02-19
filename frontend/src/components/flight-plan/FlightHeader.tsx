import { useFlightPlanStore } from '../../stores/flightPlanStore';
import { useTelemetry } from '../../hooks/useTelemetry';
import { Badge } from '../common/Badge';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightHeaderProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
}

function formatZuluTime(epoch: string | undefined): string {
  if (!epoch) return '---';
  const ts = Number(epoch);
  if (isNaN(ts)) return '---';
  const d = new Date(ts * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd} - ${hh}:${mm}z`;
}

export function FlightHeader({ ofp, formData }: FlightHeaderProps) {
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);
  const progress = useFlightPlanStore((s) => s.progress);
  const { aircraft } = useTelemetry();

  const origin = flightPlan?.origin ?? 'XXXX';
  const destination = flightPlan?.destination ?? 'XXXX';
  const flightId = flightPlan?.id ?? '---';

  const depIata = origin.length === 4 ? origin.slice(1) : '---';
  const arrIata = destination.length === 4 ? destination.slice(1) : '---';

  const schedDep = formatZuluTime(ofp?.times?.schedDep);
  const schedArr = formatZuluTime(ofp?.times?.schedArr);

  const distNm = flightPlan?.totalDistance ?? 0;
  const enrouteMin = ofp?.times?.estEnroute ?? 0;
  const enrouteStr = enrouteMin > 0 ? `${Math.floor(enrouteMin / 60)}h${String(enrouteMin % 60).padStart(2, '0')}m` : '---';

  const cruiseAlt = ofp?.cruiseAltitude
    ? `FL${Math.round(ofp.cruiseAltitude / 100)}`
    : '---';

  return (
    <div className="border-b border-acars-border px-4 py-3">
      {/* Top row: IATA codes + distance/cruise */}
      <div className="flex items-center justify-between text-[10px] text-acars-muted mb-1">
        <span>{depIata}</span>
        <span>{distNm > 0 ? `${distNm.toLocaleString()} nm` : '---'} | {cruiseAlt} | {enrouteStr}</span>
        <span>{arrIata}</span>
      </div>

      {/* Main route line: ICAO --- flight number ---> ICAO */}
      <div className="flex items-center">
        <span className="text-lg font-bold text-acars-cyan shrink-0">{origin}</span>
        <div className="flex-1 h-px bg-acars-border mx-3" />
        <span className="text-sm font-bold text-acars-text shrink-0">{formData?.flightNumber || flightId}</span>
        <div className="flex-1 flex items-center mx-3">
          <div className="flex-1 h-px bg-acars-border" />
          <span className="text-acars-border text-xs -ml-px">&#9654;</span>
        </div>
        <span className="text-lg font-bold text-acars-cyan shrink-0">{destination}</span>
      </div>

      {/* Bottom row: times + status */}
      <div className="flex items-center justify-between mt-1.5 text-[11px]">
        <span className="text-acars-muted">STD {schedDep}</span>
        <div className="flex items-center gap-2">
          <Badge variant="green">On Time</Badge>
          {aircraft && (
            <span className="text-acars-cyan">
              ETE {(() => {
                const s = progress?.eteDestination;
                if (!s) return '---';
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                return `${h}h ${String(m).padStart(2, '0')}m`;
              })()}
            </span>
          )}
        </div>
        <span className="text-acars-muted">STA {schedArr}</span>
      </div>
    </div>
  );
}
