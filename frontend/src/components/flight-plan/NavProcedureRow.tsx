import { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useVatsimStore } from '../../stores/vatsimStore';
import { AirportSearchDropdown } from './AirportSearchModal';
import type { FlightPlanFormData } from '@acars/shared';
import type { VatsimAtis } from '@acars/shared';

interface AirportRunway {
  le_ident: string;
  he_ident: string;
  length_ft: number;
  width_ft: number;
  surface: string;
  lighted: boolean;
}

interface NavProcedureRowProps {
  formData?: FlightPlanFormData | null;
}

// ── ATIS Runway Parser ──────────────────────────────────────────

interface ParsedAtisRunways {
  departing: string[];
  landing: string[];
  /** Runways mentioned without clear dep/arr context */
  general: string[];
}

/**
 * Extract active runway identifiers from VATSIM ATIS text.
 * Handles patterns like "LANDING RWY 04L", "DEPARTING RUNWAY 22R",
 * "RWY 31L IN USE", "EXPECT ILS APPROACH RWY 13R", etc.
 */
function parseAtisRunways(atisEntries: VatsimAtis[]): ParsedAtisRunways {
  const result: ParsedAtisRunways = { departing: [], landing: [], general: [] };
  if (!atisEntries.length) return result;

  // Combine all ATIS text lines into one string for parsing
  const fullText = atisEntries
    .flatMap((a) => a.text_atis ?? [])
    .join(' ')
    .toUpperCase();

  if (!fullText) return result;

  // Runway ident pattern: 1-36, optional L/C/R
  const rwyIdent = '(\\d{1,2}[LCR]?)';

  // Match "DEPARTING RWY/RUNWAY 04L [AND 04R]"
  const depPatterns = [
    new RegExp(`DEPART(?:ING|URE)\\s+(?:RUNWAYS?|RWYS?)\\s+${rwyIdent}(?:\\s+AND\\s+${rwyIdent})?`, 'g'),
  ];

  // Match "LANDING RWY/RUNWAY 22L [AND 22R]"
  const arrPatterns = [
    new RegExp(`(?:LANDING|ARRIVAL|ARRIVING)\\s+(?:RUNWAYS?|RWYS?)\\s+${rwyIdent}(?:\\s+AND\\s+${rwyIdent})?`, 'g'),
    new RegExp(`EXPECT\\s+(?:ILS|RNAV|RNP|VISUAL|VOR|LOC|NDB|GPS)?\\s*(?:APPROACH)?\\s*(?:RUNWAYS?|RWYS?)\\s+${rwyIdent}`, 'g'),
  ];

  // General: "RWY 04L IN USE" or "RUNWAY 04L IN USE FOR LANDING AND DEPARTING"
  const generalPattern = new RegExp(`(?:RUNWAYS?|RWYS?)\\s+${rwyIdent}(?:\\s+AND\\s+${rwyIdent})?\\s+IN\\s+USE`, 'g');

  for (const pat of depPatterns) {
    let m;
    while ((m = pat.exec(fullText)) !== null) {
      if (m[1]) result.departing.push(normalizeRunway(m[1]));
      if (m[2]) result.departing.push(normalizeRunway(m[2]));
    }
  }

  for (const pat of arrPatterns) {
    let m;
    while ((m = pat.exec(fullText)) !== null) {
      if (m[1]) result.landing.push(normalizeRunway(m[1]));
      if (m[2]) result.landing.push(normalizeRunway(m[2]));
    }
  }

  {
    let m;
    while ((m = generalPattern.exec(fullText)) !== null) {
      if (m[1]) result.general.push(normalizeRunway(m[1]));
      if (m[2]) result.general.push(normalizeRunway(m[2]));
    }
  }

  // Dedupe
  result.departing = [...new Set(result.departing)];
  result.landing = [...new Set(result.landing)];
  result.general = [...new Set(result.general)];

  return result;
}

/** Pad single-digit runway numbers: "4L" → "04L" */
function normalizeRunway(rwy: string): string {
  const m = rwy.match(/^(\d{1,2})([LCR]?)$/);
  if (!m) return rwy;
  return m[1].padStart(2, '0') + m[2];
}

// Stable empty array to avoid Zustand selector creating new refs each render
const EMPTY_ATIS: VatsimAtis[] = [];

// ── Component ──────────────────────────────────────────────────

export function NavProcedureRow({ formData }: NavProcedureRowProps) {
  const { canEdit, editableFields, onFieldChange } = useDispatchEdit();
  const [originRunways, setOriginRunways] = useState<string[]>([]);
  const [destRunways, setDestRunways] = useState<string[]>([]);

  const origin = formData?.origin ?? '';
  const dest = formData?.destination ?? '';

  // VATSIM ATIS for origin and destination
  const atis = useVatsimStore((s) => s.snapshot?.atis ?? EMPTY_ATIS);

  const originAtis = useMemo(
    () => (origin ? atis.filter((a) => a.callsign.startsWith(origin.toUpperCase())) : []),
    [origin, atis],
  );
  const destAtis = useMemo(
    () => (dest ? atis.filter((a) => a.callsign.startsWith(dest.toUpperCase())) : []),
    [dest, atis],
  );

  const originAtisRunways = useMemo(() => parseAtisRunways(originAtis), [originAtis]);
  const destAtisRunways = useMemo(() => parseAtisRunways(destAtis), [destAtis]);

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

  const depRunway = editableFields.depRunway ?? formData?.depRunway ?? '';
  const arrRunway = editableFields.arrRunway ?? formData?.arrRunway ?? '';
  const sid = editableFields.sid ?? formData?.sid ?? '';
  const star = editableFields.star ?? formData?.star ?? '';
  const alt1 = editableFields.alternate1 ?? formData?.alternate1 ?? '';
  const alt2 = editableFields.alternate2 ?? formData?.alternate2 ?? '';

  // Build sorted runway lists: ATIS-active first, then the rest
  const depActiveSet = new Set([...originAtisRunways.departing, ...originAtisRunways.general]);
  const arrActiveSet = new Set([...destAtisRunways.landing, ...destAtisRunways.general]);

  const sortedDepRunways = sortRunways(originRunways, depActiveSet);
  const sortedArrRunways = sortRunways(destRunways, arrActiveSet);

  const hasDepAtis = depActiveSet.size > 0;
  const hasArrAtis = arrActiveSet.size > 0;

  const selectCls = "bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full";
  const inputCls = selectCls;

  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-end gap-1.5">
        {/* Departure Runway */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">
            Runway {hasDepAtis && <span className="text-emerald-400" title="ATIS active">●</span>}
          </span>
          <select
            value={depRunway}
            onChange={(e) => onFieldChange('depRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {sortedDepRunways.map((rwy) => (
              <option key={rwy.ident} value={rwy.ident}>
                {rwy.ident}{rwy.active ? ' ●' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* SID */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">SID</span>
          <input
            type="text"
            value={sid}
            onChange={(e) => onFieldChange('sid', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* STAR */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">STAR</span>
          <input
            type="text"
            value={star}
            onChange={(e) => onFieldChange('star', e.target.value.toUpperCase())}
            readOnly={!canEdit}
            placeholder="---"
            className={inputCls}
          />
        </div>

        {/* Arrival Runway */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">
            Runway {hasArrAtis && <span className="text-emerald-400" title="ATIS active">●</span>}
          </span>
          <select
            value={arrRunway}
            onChange={(e) => onFieldChange('arrRunway', e.target.value)}
            disabled={!canEdit}
            className={selectCls}
          >
            <option value="">AUTO</option>
            {sortedArrRunways.map((rwy) => (
              <option key={rwy.ident} value={rwy.ident}>
                {rwy.ident}{rwy.active ? ' ●' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Dest Alt 1 */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Dest Alt 1</span>
          <AirportSearchDropdown
            value={alt1}
            onChange={(v) => onFieldChange('alternate1', v)}
            disabled={!canEdit}
          />
        </div>

        {/* Dest Alt 2 */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Dest Alt 2</span>
          <AirportSearchDropdown
            value={alt2}
            onChange={(v) => onFieldChange('alternate2', v)}
            disabled={!canEdit}
          />
        </div>
      </div>
    </div>
  );
}

/** Sort runways: ATIS-active first, then alphabetical */
function sortRunways(
  runways: string[],
  activeSet: Set<string>,
): { ident: string; active: boolean }[] {
  return runways
    .map((ident) => ({ ident, active: activeSet.has(ident) }))
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.ident.localeCompare(b.ident);
    });
}
