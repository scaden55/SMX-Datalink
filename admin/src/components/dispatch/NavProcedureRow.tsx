import { useState, useEffect } from 'react';
import type { DispatchFlight } from '@acars/shared';
import { useDispatchEdit } from './DispatchEditContext';
import { api } from '@/lib/api';

interface AirportRunway {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
}

export default function NavProcedureRow({ flight }: { flight: DispatchFlight }) {
  const { canEdit, editableFields, onFieldChange, releasedFields } = useDispatchEdit();
  const hl = (key: string) => releasedFields?.includes(key) ?? false;
  const [originRunways, setOriginRunways] = useState<string[]>([]);
  const [destRunways, setDestRunways] = useState<string[]>([]);

  const origin = flight.bid.depIcao ?? '';
  const dest = flight.bid.arrIcao ?? '';

  // Fetch physical runways when origin changes
  useEffect(() => {
    if (origin.length === 4) {
      api.get<{ runways: AirportRunway[] }>(`/api/airports/${origin}`)
        .then((data) => {
          const rwys = (data.runways ?? []).flatMap((r) => {
            const entries: string[] = [];
            if (r.le_ident) entries.push(r.le_ident);
            if (r.he_ident) entries.push(r.he_ident);
            return entries;
          });
          setOriginRunways([...new Set(rwys)]);
        })
        .catch(() => setOriginRunways([]));
    } else {
      setOriginRunways([]);
    }
  }, [origin]);

  // Fetch physical runways when destination changes
  useEffect(() => {
    if (dest.length === 4) {
      api.get<{ runways: AirportRunway[] }>(`/api/airports/${dest}`)
        .then((data) => {
          const rwys = (data.runways ?? []).flatMap((r) => {
            const entries: string[] = [];
            if (r.le_ident) entries.push(r.le_ident);
            if (r.he_ident) entries.push(r.he_ident);
            return entries;
          });
          setDestRunways([...new Set(rwys)]);
        })
        .catch(() => setDestRunways([]));
    } else {
      setDestRunways([]);
    }
  }, [dest]);

  const depRunway = (editableFields.depRunway as string) ?? flight.flightPlanData?.depRunway ?? '';
  const arrRunway = (editableFields.arrRunway as string) ?? flight.flightPlanData?.arrRunway ?? '';
  const sid = flight.ofpJson?.sid ?? (editableFields.sid as string) ?? flight.flightPlanData?.sid ?? '';
  const star = flight.ofpJson?.star ?? (editableFields.star as string) ?? flight.flightPlanData?.star ?? '';
  const alt1 = (editableFields.alternate1 as string) ?? flight.flightPlanData?.alternate1 ?? '';
  const alt2 = (editableFields.alternate2 as string) ?? flight.flightPlanData?.alternate2 ?? '';

  const selectCls = "bg-[var(--surface-2)] border border-[var(--surface-3)] text-[12px] font-mono tabular-nums text-[var(--text-primary)] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";
  const inputCls = selectCls;

  return (
    <div className="px-3 py-1.5">
      <div className="flex items-end gap-1.5">
        {/* Departure Runway */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('depRunway') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">Runway</span>
          <select
            value={depRunway}
            onChange={(e) => onFieldChange('depRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {originRunways.sort().map((rwy) => (
              <option key={rwy} value={rwy}>{rwy}</option>
            ))}
          </select>
        </div>

        {/* SID */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('sid') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">SID</span>
          <input
            type="text"
            value={sid}
            onChange={(e) => onFieldChange('sid', e.target.value.toUpperCase())}
            readOnly={!!flight.ofpJson?.sid || !canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* STAR */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('star') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">STAR</span>
          <input
            type="text"
            value={star}
            onChange={(e) => onFieldChange('star', e.target.value.toUpperCase())}
            readOnly={!!flight.ofpJson?.star || !canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* Arrival Runway */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('arrRunway') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">Runway</span>
          <select
            value={arrRunway}
            onChange={(e) => onFieldChange('arrRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {destRunways.sort().map((rwy) => (
              <option key={rwy} value={rwy}>{rwy}</option>
            ))}
          </select>
        </div>

        {/* Dest Alt 1 */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('alternate1') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">Dest Alt 1</span>
          <input
            type="text"
            value={alt1}
            onChange={(e) => onFieldChange('alternate1', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="ICAO"
            className={inputCls}
          />
        </div>

        {/* Dest Alt 2 */}
        <div className={`flex flex-col min-w-0 flex-1 ${hl('alternate2') ? 'border-l-2 border-amber-400 bg-amber-400/5 pl-1' : ''}`}>
          <span className="text-[9px] text-[var(--text-muted)]/70 mb-0.5">Dest Alt 2</span>
          <input
            type="text"
            value={alt2}
            onChange={(e) => onFieldChange('alternate2', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="ICAO"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}
