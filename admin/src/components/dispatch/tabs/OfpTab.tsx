import type { DispatchFlight } from '@acars/shared';

interface OfpTabProps {
  flight: DispatchFlight;
}

export default function OfpTab({ flight }: OfpTabProps) {
  const ofp = flight.ofpJson;

  if (!ofp) {
    return (
      <div className="flex items-center justify-center py-12 text-xs text-[var(--text-muted)]">
        No OFP data available — SimBrief flight plan not loaded
      </div>
    );
  }

  // If rawText exists, show it directly
  if (ofp.rawText) {
    return (
      <div className="rounded bg-[var(--surface-1)] p-3 overflow-auto">
        <div className="font-mono text-[10px] text-[var(--accent-blue-bright)] font-bold mb-2 tracking-wider">
          OPERATIONAL FLIGHT PLAN
        </div>
        <pre className="font-mono text-[10px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap break-words">
          {ofp.rawText}
        </pre>
      </div>
    );
  }

  // Construct summary from OFP fields
  const fuel = ofp.fuel;
  const wgt = ofp.weights;

  return (
    <div className="rounded bg-[var(--surface-1)] p-3 overflow-auto">
      <pre className="font-mono text-[10px] leading-[1.8] text-[var(--text-secondary)] whitespace-pre-wrap">
        <span className="text-[var(--accent-blue-bright)] font-bold tracking-wider">OPERATIONAL FLIGHT PLAN — {ofp.flightNumber}</span>
{'\n'}{ofp.origin}/{ofp.depRunway || '--'}  {ofp.destination}/{ofp.arrRunway || '--'}  CR FL{ofp.cruiseAltitude ? String(Math.round(ofp.cruiseAltitude / 100)).padStart(3, '0') : '---'}  CI{ofp.costIndex ?? '--'}
{'\n'}
{'\n'}RTE: {ofp.route || '--'}
{'\n'}SID: {ofp.sid || '--'}  STAR: {ofp.star || '--'}
{'\n'}
{'\n'}FUEL:
{'\n'}  TRIP {fuel?.burnLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  CONT {fuel?.contingencyLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  ALTN {fuel?.alternateLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  RSV  {fuel?.reserveLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  TAXI {fuel?.taxiLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  XTR  {fuel?.extraLbs?.toLocaleString() ?? '--'} LBS
{'\n'}  TOT  {fuel?.totalLbs?.toLocaleString() ?? '--'} LBS
{'\n'}
{'\n'}WGT:
{'\n'}  ZFW {wgt?.estZfw?.toLocaleString() ?? '--'} LBS
{'\n'}  TOW {wgt?.estTow?.toLocaleString() ?? '--'} LBS
{'\n'}  LDW {wgt?.estLdw?.toLocaleString() ?? '--'} LBS
{'\n'}
{'\n'}TIMES:
{'\n'}  DEP {ofp.times?.schedDep ?? '--'}
{'\n'}  ARR {ofp.times?.schedArr ?? '--'}
{'\n'}  ENR {ofp.times?.estEnroute ? `${Math.floor(ofp.times.estEnroute / 60)}h${String(ofp.times.estEnroute % 60).padStart(2, '0')}m` : '--'}
{ofp.alternates && ofp.alternates.length > 0 && (
<>{'\n'}{'\n'}ALTERNATES:{ofp.alternates.map((a) => `\n  ${a.icao} ${a.name} ${a.distanceNm}NM ${a.fuelLbs?.toLocaleString() ?? '--'} LBS`).join('')}</>
)}
      </pre>
    </div>
  );
}
