import { useState, type ReactNode } from 'react';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useDispatchEdit } from '../../contexts/DispatchEditContext';
import { useFlightPlanStore } from '../../stores/flightPlanStore';
import type { SimBriefOFP, FlightPlanFormData } from '@acars/shared';

interface FlightDetailSectionsProps {
  ofp?: SimBriefOFP | null;
  formData?: FlightPlanFormData | null;
}

function fmt(val: number | string | undefined | null): string {
  if (val === null || val === undefined || val === '') return '---';
  const n = typeof val === 'string' ? Number(val) : val;
  if (isNaN(n)) return '---';
  return Math.round(n).toLocaleString();
}

function fmtK(val: number | undefined | null): string {
  if (val === null || val === undefined) return '---';
  return (val / 1000).toFixed(1);
}

function fmtTime(minutes: number | undefined | null): string {
  if (minutes == null || minutes <= 0) return '---';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ── Reusable collapsible detail row ────────────────────────────── */

function DetailRow({
  title,
  summary,
  hasData,
  amber,
  children,
}: {
  title: string;
  summary: string;
  hasData: boolean;
  amber?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-acars-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center h-8 px-3 w-full text-left hover:bg-acars-input/40 transition-colors duration-100"
      >
        {hasData ? (
          <svg
            className={`w-3 h-3 shrink-0 mr-2 ${amber ? 'text-amber-400' : 'text-emerald-500'}`}
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="w-2 h-2 rounded-full bg-white/10 shrink-0 mr-2" />
        )}
        <span className="text-[11px] font-semibold text-acars-muted">{title}</span>
        <span className="ml-auto text-[11px] font-mono text-acars-text truncate max-w-[400px]">
          {summary}
        </span>
        <svg
          className={`w-3 h-3 text-acars-muted/60 shrink-0 ml-2 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────── */

const inputCls =
  'bg-acars-input border border-acars-border text-[11px] font-mono text-acars-text rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400';
const readOnlyCls =
  'text-[11px] font-mono text-acars-text';
const labelCls =
  'text-[9px] font-medium uppercase tracking-[0.06em] text-acars-muted/70';

/* ── Fuel table row ─────────────────────────────────────────────── */

function FuelTableRow({
  label,
  time,
  value,
  note,
  editable,
  fieldKey,
  onFieldChange,
  indent,
  bold,
  warn,
}: {
  label: string;
  time?: string;
  value: string;
  note?: string;
  editable?: boolean;
  fieldKey?: string;
  onFieldChange?: (key: string, val: string) => void;
  indent?: boolean;
  bold?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`flex items-center py-1 ${indent ? 'pl-4' : ''} border-b border-acars-border/20 last:border-b-0`}>
      <span className={`text-[11px] w-[130px] shrink-0 ${bold ? 'font-semibold text-acars-text/80' : 'text-acars-muted'}`}>
        {label}
      </span>
      <span className="text-[11px] font-mono text-acars-muted w-[55px] shrink-0 text-right pr-2">
        {time || ''}
      </span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={value === '---' ? '' : value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={`${inputCls} w-[80px] shrink-0`}
          placeholder="0"
        />
      ) : (
        <span className={`text-[11px] font-mono w-[80px] shrink-0 text-right ${warn ? 'text-amber-400' : 'text-acars-text'}`}>
          {value}
        </span>
      )}
      {note && (
        <span className="text-[10px] text-acars-muted ml-3 truncate">{note}</span>
      )}
    </div>
  );
}

/* ── Weight table row ───────────────────────────────────────────── */

function WeightTableRow({
  label,
  estimated,
  maximum,
  margin,
  editable,
  fieldKey,
  onFieldChange,
  warn,
}: {
  label: string;
  estimated: string;
  maximum?: string;
  margin?: string;
  editable?: boolean;
  fieldKey?: string;
  onFieldChange?: (key: string, val: string) => void;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center py-1 border-b border-acars-border/20 last:border-b-0">
      <span className="text-[11px] text-acars-muted w-[90px] shrink-0">{label}</span>
      {editable && fieldKey && onFieldChange ? (
        <input
          type="text"
          value={estimated === '---' ? '' : estimated}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={`${inputCls} w-[100px] shrink-0`}
          placeholder="0"
        />
      ) : (
        <span className="text-[11px] font-mono text-acars-text w-[100px] shrink-0 text-right">
          {estimated}
        </span>
      )}
      {maximum !== undefined && (
        <span className="text-[11px] font-mono text-acars-muted w-[100px] shrink-0 text-right">
          {maximum}
        </span>
      )}
      {margin !== undefined && (
        <span className={`text-[11px] font-mono w-[100px] shrink-0 text-right ${warn ? 'text-amber-400 font-semibold' : 'text-emerald-400/70'}`}>
          {margin}
        </span>
      )}
    </div>
  );
}

/* ── Field grid helper ──────────────────────────────────────────── */

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-[11px]">{children}</div>;
}

function EditableField({
  label,
  value,
  fieldKey,
  canEdit,
  onFieldChange,
  placeholder,
  wide,
}: {
  label: string;
  value: string;
  fieldKey: string;
  canEdit: boolean;
  onFieldChange: (key: string, val: string) => void;
  placeholder?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <span className={labelCls}>{label}</span>
      {canEdit ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onFieldChange(fieldKey, e.target.value)}
          className={`${inputCls} w-full mt-0.5`}
          placeholder={placeholder ?? '---'}
        />
      ) : (
        <div className={`${readOnlyCls} mt-0.5`}>{value || '---'}</div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className={`${readOnlyCls} mt-0.5 ${warn ? 'text-amber-400' : ''}`}>{value}</div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function FlightDetailSections({ ofp, formData }: FlightDetailSectionsProps) {
  const { aircraft } = useTelemetry();
  const { editableFields, canEdit, canEditFuel, canEditMEL, canEditRoute, onFieldChange } = useDispatchEdit();
  const flightPlan = useFlightPlanStore((s) => s.flightPlan);

  const w = ofp?.weights;
  const f = ofp?.fuel;
  const t = ofp?.times;

  // ── Aircraft summary
  const tail = aircraft?.atcId ?? '---';
  const acType = aircraft?.atcType ?? '---';
  const ci = editableFields.costIndex ?? formData?.costIndex ?? '---';
  const acftSummary = `${tail} | ${acType} | CI${ci}`;

  // ── MEL & Restrictions summary
  const melText = (editableFields.melRestrictions ?? formData?.melRestrictions ?? '').trim();
  const melLines = melText ? melText.split('\n').filter((l) => l.trim()) : [];
  const hasMEL = melLines.length > 0;
  const melSummary = hasMEL
    ? `${melLines.length} MEL${melLines.length !== 1 ? 's' : ''} | ${melLines.length} Restriction${melLines.length !== 1 ? 's' : ''}`
    : 'None';

  // ── Route summary
  const route = editableFields.route ?? flightPlan?.route ?? '';
  const routeSummary = route || 'No route loaded';

  // ── Fuel summary
  const taxiVal = String(editableFields.fuelTaxi ?? f?.taxiLbs ?? '---');
  const cfVal = String(editableFields.fuelContingency ?? f?.contingencyLbs ?? '---');
  const extraVal = String(editableFields.fuelExtra ?? f?.extraLbs ?? '---');
  const altIcao = editableFields.alternate1 ?? formData?.alternate1 ?? '';
  const reserveVal = String(editableFields.fuelReserve ?? f?.reserveLbs ?? '---');
  const fuelParts: string[] = [];
  if (taxiVal !== '---') fuelParts.push(`Taxi Out :${fmt(taxiVal)}`);
  if (cfVal !== '---') fuelParts.push(`CF:${fmt(cfVal)}`);
  if (extraVal !== '---') fuelParts.push(`Extra :${fmt(extraVal)}`);
  if (altIcao) fuelParts.push(`ALTN ${altIcao}`);
  if (reserveVal !== '---') fuelParts.push(`REMT ${fmt(reserveVal)}`);
  const fuelSummary = fuelParts.length > 0 ? fuelParts.join(' | ') : '---';

  // ── Weights summary
  const weightParts: string[] = [];
  if (w?.estTow != null) weightParts.push(`PTOG: ${fmtK(w.estTow)}`);
  if (w?.maxTow != null) weightParts.push(`ATOG: ${fmtK(w.maxTow)}\u00B7TO`);
  if (w?.estLdw != null) weightParts.push(`PLDW: ${fmtK(w.estLdw)}`);
  if (w?.maxLdw != null) weightParts.push(`ALDW: ${fmtK(w.maxLdw)}\u00B7LD`);
  if (w?.estZfw != null) weightParts.push(`PZFW: ${fmtK(w.estZfw)}`);
  const weightsSummary = weightParts.length > 0 ? weightParts.join(' | ') : '---';

  // ── Terrain summary
  const cruiseAlt = ofp?.cruiseAltitude;
  const cruiseFL = cruiseAlt ? `FL${Math.round(cruiseAlt / 100)}` : '---';
  const terrainSummary = cruiseAlt
    ? `${cruiseFL} | ${ofp?.aircraftType ?? '---'}`
    : '---';

  // ── Computed fuel values
  const totalFuel = Number(editableFields.fuelTotal ?? f?.totalLbs ?? 0);
  const taxiFuel = Number(editableFields.fuelTaxi ?? f?.taxiLbs ?? 0);
  const planToFuel = totalFuel - taxiFuel;
  const burnLbs = Number(editableFields.fuelBurn ?? f?.burnLbs ?? 0);
  const cfNum = Number(editableFields.fuelContingency ?? f?.contingencyLbs ?? 0);
  const cfPct = burnLbs > 0 ? Math.round((cfNum / burnLbs) * 100) : null;

  return (
    <div>
      {/* ── Aircraft ──────────────────────────────────────────── */}
      <DetailRow title="Aircraft" summary={acftSummary} hasData={!!aircraft}>
        <FieldGrid>
          <ReadOnlyField label="Tail Number" value={tail} />
          <ReadOnlyField label="Aircraft Type" value={acType} />
          <ReadOnlyField label="Title" value={aircraft?.title ?? '---'} />
          <EditableField
            label="Cruise FL"
            value={editableFields.cruiseFL ?? formData?.cruiseFL ?? ''}
            fieldKey="cruiseFL"
            canEdit={canEdit}
            onFieldChange={onFieldChange}
            placeholder="FL350"
          />
          <EditableField
            label="Cost Index"
            value={String(ci)}
            fieldKey="costIndex"
            canEdit={canEdit}
            onFieldChange={onFieldChange}
            placeholder="0"
          />
          <EditableField
            label="AOB FL"
            value={editableFields.aobFL ?? formData?.aobFL ?? ''}
            fieldKey="aobFL"
            canEdit={canEdit}
            onFieldChange={onFieldChange}
            placeholder="FL350"
          />
          <EditableField
            label="Pilot in Command"
            value={editableFields.pic ?? formData?.pic ?? ''}
            fieldKey="pic"
            canEdit={canEdit}
            onFieldChange={onFieldChange}
            placeholder="PIC Name"
            wide
          />
          <ReadOnlyField label="SimBrief Type" value={ofp?.aircraftType ?? '---'} />
        </FieldGrid>
      </DetailRow>

      {/* ── MEL & Restrictions ────────────────────────────────── */}
      <DetailRow title="MEL & Restrictions" summary={melSummary} hasData amber={hasMEL}>
        {canEditMEL ? (
          <div>
            <label className={`${labelCls} block mb-1`}>MEL items (one per line)</label>
            <textarea
              value={editableFields.melRestrictions ?? formData?.melRestrictions ?? ''}
              onChange={(e) => onFieldChange('melRestrictions', e.target.value)}
              className="w-full h-20 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
              placeholder="Enter MEL items, one per line..."
            />
          </div>
        ) : (
          <div className="space-y-1.5 text-[11px]">
            {hasMEL ? (
              melLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                  <span className="text-acars-text">{line}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-acars-muted">No active MELs or restrictions</span>
              </div>
            )}
          </div>
        )}
      </DetailRow>

      {/* ── Route ─────────────────────────────────────────────── */}
      <DetailRow title="Route" summary={routeSummary} hasData={!!route}>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[11px]">
            <ReadOnlyField label="Origin" value={ofp?.origin ?? formData?.origin ?? '---'} />
            <span className="text-acars-muted mt-3">→</span>
            <ReadOnlyField label="Destination" value={ofp?.destination ?? formData?.destination ?? '---'} />
            <ReadOnlyField label="Distance" value={
              ofp?.steps?.length
                ? `${fmt(ofp.steps[ofp.steps.length - 1].distanceFromOriginNm)} nm`
                : '---'
            } />
            <ReadOnlyField label="Est Enroute" value={fmtTime(t?.estEnroute)} />
            <ReadOnlyField label="Est Block" value={fmtTime(t?.estBlock)} />
          </div>
          {canEditRoute ? (
            <div>
              <label className={`${labelCls} block mb-1`}>Route</label>
              <textarea
                value={route}
                onChange={(e) => onFieldChange('route', e.target.value)}
                className="w-full h-16 rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 font-mono resize-none focus:outline-none focus:border-sky-400"
                placeholder="Enter ICAO route..."
              />
            </div>
          ) : (
            <div>
              <span className={`${labelCls} block mb-1`}>Route</span>
              <div className="font-mono text-[11px] text-acars-text leading-relaxed break-all">
                {route || <span className="text-acars-muted italic">No route loaded</span>}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 text-[11px]">
            <EditableField
              label="Alternate 1"
              value={editableFields.alternate1 ?? formData?.alternate1 ?? ''}
              fieldKey="alternate1"
              canEdit={canEdit}
              onFieldChange={onFieldChange}
              placeholder="ICAO"
            />
            <EditableField
              label="Alternate 2"
              value={editableFields.alternate2 ?? formData?.alternate2 ?? ''}
              fieldKey="alternate2"
              canEdit={canEdit}
              onFieldChange={onFieldChange}
              placeholder="ICAO"
            />
          </div>
        </div>
      </DetailRow>

      {/* ── Fuel ──────────────────────────────────────────────── */}
      <DetailRow title="Fuel" summary={fuelSummary} hasData={!!f}>
        <div>
          {/* Column headers */}
          <div className="flex items-center pb-1 mb-1 border-b border-acars-border/40">
            <span className={`${labelCls} w-[130px] shrink-0`}>Item</span>
            <span className={`${labelCls} w-[55px] shrink-0 text-right pr-2`}>Time</span>
            <span className={`${labelCls} w-[80px] shrink-0 text-right`}>Fuel (lbs)</span>
            <span className={`${labelCls} ml-3`}>Remarks</span>
          </div>

          {/* Trip Burn */}
          <FuelTableRow
            label="Total Trip"
            time={fmtTime(t?.estEnroute)}
            value={fmt(editableFields.fuelBurn ?? f?.burnLbs)}
            note={`${ofp?.origin ?? '---'}-${ofp?.destination ?? '---'}`}
            bold
          />

          {/* Burn — editable */}
          <FuelTableRow
            label="Burn"
            time={fmtTime(t?.estEnroute)}
            value={String(editableFields.fuelBurn ?? f?.burnLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelBurn"
            onFieldChange={onFieldChange}
          />

          {/* Contingency (CF) */}
          <FuelTableRow
            label="Contingency (CF)"
            value={String(editableFields.fuelContingency ?? f?.contingencyLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelContingency"
            onFieldChange={onFieldChange}
            note={cfPct !== null ? `${cfPct}% of burn` : undefined}
          />

          {/* FAR Reserve */}
          <FuelTableRow
            label="Reserve (REMF)"
            value={String(editableFields.fuelReserve ?? f?.reserveLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelReserve"
            onFieldChange={onFieldChange}
            note="FAA reserve"
          />

          {/* Alternates sub-section */}
          {(ofp?.alternates ?? []).length > 0 && (
            <>
              <div className="flex items-center py-1.5 mt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-acars-muted/70">Alternates</span>
              </div>
              {ofp!.alternates.map((alt, i) => (
                <FuelTableRow
                  key={alt.icao}
                  label={`${i === 0 ? 'Dest Alt 1' : 'Dest Alt 2'} ${alt.icao}`}
                  value={fmt(alt.fuelLbs)}
                  note={`${fmt(alt.distanceNm)} nm — ${alt.name}`}
                  indent
                />
              ))}
            </>
          )}

          {/* Alternate Fuel (ACF) */}
          <FuelTableRow
            label="Alt Fuel (ACF)"
            value={String(editableFields.fuelAlternate ?? f?.alternateLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelAlternate"
            onFieldChange={onFieldChange}
          />

          {/* Extra */}
          <FuelTableRow
            label="Extra"
            value={String(editableFields.fuelExtra ?? f?.extraLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelExtra"
            onFieldChange={onFieldChange}
            note="Pilot discretionary"
          />

          {/* Plan T/O (computed) */}
          <FuelTableRow
            label="Plan T/O"
            value={fmt(planToFuel)}
            note="Total − Taxi"
            bold
          />

          {/* Taxi Out */}
          <FuelTableRow
            label="Taxi Out"
            value={String(editableFields.fuelTaxi ?? f?.taxiLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelTaxi"
            onFieldChange={onFieldChange}
          />

          {/* Plan Gate (total) */}
          <FuelTableRow
            label="Plan Gate"
            time={fmtTime(t?.estBlock)}
            value={String(editableFields.fuelTotal ?? f?.totalLbs ?? '')}
            editable={canEditFuel}
            fieldKey="fuelTotal"
            onFieldChange={onFieldChange}
            bold
          />
        </div>
      </DetailRow>

      {/* ── Weights ───────────────────────────────────────────── */}
      <DetailRow title="Weights" summary={weightsSummary} hasData={!!w}>
        <div>
          {/* Column headers */}
          <div className="flex items-center pb-1 mb-1 border-b border-acars-border/40">
            <span className={`${labelCls} w-[90px] shrink-0`}>Weight</span>
            <span className={`${labelCls} w-[100px] shrink-0 text-right`}>Estimated</span>
            <span className={`${labelCls} w-[100px] shrink-0 text-right`}>Maximum</span>
            <span className={`${labelCls} w-[100px] shrink-0 text-right`}>Margin</span>
          </div>

          <WeightTableRow
            label="ZFW"
            estimated={`${fmt(editableFields.estZfw ?? w?.estZfw)}`}
            maximum={`${fmt(w?.maxZfw)}`}
            margin={w?.maxZfw && w?.estZfw ? `${fmt(w.maxZfw - w.estZfw)}` : '---'}
            editable={canEditFuel}
            fieldKey="estZfw"
            onFieldChange={onFieldChange}
          />
          <WeightTableRow
            label="TOW"
            estimated={`${fmt(editableFields.estTow ?? w?.estTow)}`}
            maximum={`${fmt(w?.maxTow)}`}
            margin={w?.maxTow && w?.estTow ? `${fmt(w.maxTow - w.estTow)}` : '---'}
            warn={w?.maxTow != null && w?.estTow != null && w.estTow > w.maxTow}
            editable={canEditFuel}
            fieldKey="estTow"
            onFieldChange={onFieldChange}
          />
          <WeightTableRow
            label="LDW"
            estimated={`${fmt(editableFields.estLdw ?? w?.estLdw)}`}
            maximum={`${fmt(w?.maxLdw)}`}
            margin={w?.maxLdw && w?.estLdw ? `${fmt(w.maxLdw - w.estLdw)}` : '---'}
            warn={w?.maxLdw != null && w?.estLdw != null && w.estLdw > w.maxLdw}
            editable={canEditFuel}
            fieldKey="estLdw"
            onFieldChange={onFieldChange}
          />

          <div className="h-2" />

          <WeightTableRow
            label="Payload"
            estimated={`${fmt(editableFields.payload ?? w?.payload)}`}
            editable={canEditFuel}
            fieldKey="payload"
            onFieldChange={onFieldChange}
          />
          <WeightTableRow
            label="Pax Count"
            estimated={String(editableFields.paxCount ?? w?.paxCount ?? '---')}
            editable={canEditFuel}
            fieldKey="paxCount"
            onFieldChange={onFieldChange}
          />
          <WeightTableRow
            label="Cargo"
            estimated={`${fmt(editableFields.cargoLbs ?? w?.cargoLbs)}`}
            editable={canEditFuel}
            fieldKey="cargoLbs"
            onFieldChange={onFieldChange}
          />
        </div>
      </DetailRow>

      {/* ── Terrain ───────────────────────────────────────────── */}
      <DetailRow title="Terrain" summary={terrainSummary} hasData={!!cruiseAlt}>
        <div className="space-y-2">
          <FieldGrid>
            <ReadOnlyField label="Cruise Altitude" value={cruiseFL} />
            <ReadOnlyField label="Cost Index" value={ofp?.costIndex != null ? String(ofp.costIndex) : '---'} />
            <ReadOnlyField label="Aircraft Type" value={ofp?.aircraftType ?? '---'} />
          </FieldGrid>

          {/* Key route waypoints with altitudes */}
          {ofp?.steps && ofp.steps.length > 0 && (
            <div>
              <span className={`${labelCls} block mb-1 mt-2`}>Route Profile</span>
              <div className="max-h-[140px] overflow-y-auto rounded border border-acars-border/30">
                <div className="flex items-center px-2 py-1 border-b border-acars-border/40 bg-acars-input/30">
                  <span className={`${labelCls} w-[70px] shrink-0`}>Fix</span>
                  <span className={`${labelCls} w-[60px] shrink-0 text-right`}>Alt (ft)</span>
                  <span className={`${labelCls} w-[60px] shrink-0 text-right`}>Dist (nm)</span>
                  <span className={`${labelCls} w-[80px] shrink-0 text-right`}>Fuel Rem</span>
                  <span className={`${labelCls} w-[50px] shrink-0 text-right`}>Wind</span>
                  <span className={`${labelCls} w-[40px] shrink-0 text-right`}>OAT</span>
                </div>
                {ofp.steps
                  .filter((s) => s.fixType === 'apt' || s.fixType === 'toc' || s.fixType === 'tod' || s.distanceFromOriginNm % 100 < 10 || s.ident.length <= 5)
                  .slice(0, 30)
                  .map((step, i) => (
                    <div
                      key={`${step.ident}-${i}`}
                      className="flex items-center px-2 py-0.5 border-b border-acars-border/10 last:border-b-0"
                    >
                      <span className={`text-[10px] font-mono w-[70px] shrink-0 ${
                        step.fixType === 'toc' || step.fixType === 'tod' ? 'text-blue-400 font-semibold' : 'text-acars-text'
                      }`}>
                        {step.fixType === 'toc' ? 'T/C' : step.fixType === 'tod' ? 'T/D' : step.ident}
                      </span>
                      <span className="text-[10px] font-mono text-acars-text w-[60px] shrink-0 text-right">
                        {fmt(step.altitudeFt)}
                      </span>
                      <span className="text-[10px] font-mono text-acars-muted w-[60px] shrink-0 text-right">
                        {fmt(step.distanceFromOriginNm)}
                      </span>
                      <span className="text-[10px] font-mono text-acars-muted w-[80px] shrink-0 text-right">
                        {fmt(step.fuelRemainLbs)}
                      </span>
                      <span className="text-[10px] font-mono text-acars-muted w-[50px] shrink-0 text-right">
                        {step.wind || '---'}
                      </span>
                      <span className="text-[10px] font-mono text-acars-muted w-[40px] shrink-0 text-right">
                        {step.oat != null ? `${step.oat}°` : '---'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </DetailRow>
    </div>
  );
}
