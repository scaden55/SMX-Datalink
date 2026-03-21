import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function computeEta(etd: string, flightTimeMin: number): string {
  if (!etd) return '--:--';
  // etd could be "HH:MM" or a full datetime
  const parts = etd.split(':');
  if (parts.length < 2) return '--:--';
  const depMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  const arrMinutes = (depMinutes + flightTimeMin) % (24 * 60);
  const h = Math.floor(arrMinutes / 60);
  const m = arrMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}z`;
}

export default function FlightHeader({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEdit, releasedFields } = useDispatchEdit();

  const etd = (editableFields.etd as string) || flight.flightPlanData?.etd || flight.bid.depTime || '';
  const flightTimeMin = flight.bid.flightTimeMin ?? 0;
  const ete = formatMinutes(flightTimeMin);
  const eta = computeEta(etd, flightTimeMin);

  const isReleased = (key: string) => releasedFields?.includes(key);
  const releasedClass = (key: string) =>
    isReleased(key) ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--surface-3)] rounded-md px-3 py-2.5">
      {/* Row 1: Airport names */}
      <div className="flex justify-between mb-1">
        <span className="text-[9px] text-[var(--text-muted)]">{flight.bid.depName}</span>
        <span className="text-[9px] text-[var(--text-muted)]">{flight.bid.arrName}</span>
      </div>

      {/* Row 2: ICAO codes with flight number centered */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[18px] font-bold text-[var(--text-primary)]">
          {flight.bid.depIcao}
        </span>
        <div className="flex-1 flex items-center gap-1.5">
          <div className="flex-1 border-t border-dashed border-[var(--surface-3)]" />
          <span className="font-mono text-[10px] text-[var(--accent-blue-bright)] whitespace-nowrap">
            {flight.bid.flightNumber}
          </span>
          <div className="flex-1 border-t border-dashed border-[var(--surface-3)]" />
        </div>
        <span className="font-mono text-[18px] font-bold text-[var(--text-primary)]">
          {flight.bid.arrIcao}
        </span>
      </div>

      {/* Row 3: ETD / ETE / ETA */}
      <div className="flex items-center justify-between mt-1.5">
        <div className={`${releasedClass('depTime')}`}>
          {canEdit ? (
            <input
              type="text"
              value={etd}
              onChange={(e) => onFieldChange('depTime', e.target.value)}
              className="bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-[var(--text-primary)] w-16"
              placeholder="HH:MM"
            />
          ) : (
            <span className="font-mono text-[9px] tabular-nums text-[var(--text-primary)]">{etd}z</span>
          )}
        </div>
        <span className="font-mono text-[9px] tabular-nums text-[var(--accent)]">{ete}</span>
        <span className="font-mono text-[9px] tabular-nums text-[var(--text-primary)]">{eta}</span>
      </div>
    </div>
  );
}
