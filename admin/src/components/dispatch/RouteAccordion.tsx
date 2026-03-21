import type { DispatchFlight } from '@acars/shared';
import AccordionSection from './AccordionSection';
import { useDispatchEdit } from './DispatchEditContext';

const labelClass = 'text-[8px] text-[var(--text-muted)] uppercase tracking-wider';
const inputClass =
  'bg-[var(--surface-2)] border border-[var(--surface-3)] rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-[var(--text-primary)] w-full';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function RouteAccordion({ flight }: { flight: DispatchFlight }) {
  const { editableFields, onFieldChange, canEditRoute, releasedFields } = useDispatchEdit();

  const route =
    (editableFields.route as string) ??
    flight.flightPlanData?.route ??
    flight.ofpJson?.route ??
    '';

  const alternate1 = (editableFields.alternate1 as string) ?? flight.flightPlanData?.alternate1 ?? '';
  const alternate2 = (editableFields.alternate2 as string) ?? flight.flightPlanData?.alternate2 ?? '';

  const distanceNm = flight.bid.distanceNm ?? 0;
  const enrouteTime = formatMinutes(flight.bid.flightTimeMin ?? 0);
  const hasRoute = route.length > 0;

  const isReleased = (key: string) => releasedFields?.includes(key) ?? false;
  const releasedClass = (key: string) =>
    isReleased(key) ? 'border-l-2 border-l-amber-400 bg-amber-400/5 pl-1' : '';

  const summary = hasRoute ? `${distanceNm} nm · ${enrouteTime}` : 'No route';

  return (
    <AccordionSection title="Route" summary={summary} status={hasRoute ? 'green' : 'neutral'}>
      {/* Context row */}
      <div className="flex items-center gap-3 mb-2 text-[10px] text-[var(--text-secondary)]">
        <span className="font-mono">
          {flight.bid.depIcao} → {flight.bid.arrIcao}
        </span>
        <span className="font-mono tabular-nums">{distanceNm} nm</span>
        <span className="font-mono tabular-nums">{enrouteTime}</span>
      </div>

      {/* Route textarea */}
      <div className={`mb-2 ${releasedClass('route')}`}>
        <div className={labelClass}>Route</div>
        {canEditRoute ? (
          <textarea
            value={route}
            onChange={(e) => onFieldChange('route', e.target.value)}
            rows={3}
            className={`${inputClass} resize-y min-h-[48px]`}
          />
        ) : (
          <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)] whitespace-pre-wrap">
            {route || '—'}
          </div>
        )}
      </div>

      {/* Alternates */}
      <div className="grid grid-cols-2 gap-3">
        <div className={releasedClass('alternate1')}>
          <div className={labelClass}>Alternate 1</div>
          {canEditRoute ? (
            <input
              type="text"
              value={alternate1}
              onChange={(e) => onFieldChange('alternate1', e.target.value)}
              className={inputClass}
              placeholder="ICAO"
            />
          ) : (
            <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
              {alternate1 || '—'}
            </div>
          )}
        </div>
        <div className={releasedClass('alternate2')}>
          <div className={labelClass}>Alternate 2</div>
          {canEditRoute ? (
            <input
              type="text"
              value={alternate2}
              onChange={(e) => onFieldChange('alternate2', e.target.value)}
              className={inputClass}
              placeholder="ICAO"
            />
          ) : (
            <div className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
              {alternate2 || '—'}
            </div>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}
