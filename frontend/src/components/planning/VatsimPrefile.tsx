import { useState, useMemo } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Radio,
  Plane,
  Navigation,
  Route,
  Clock,
  Fuel,
  ArrowRight,
  X,
} from 'lucide-react';
import type { FlightPlanFormData, SimBriefOFP } from '@acars/shared';
import type { FleetAircraft } from '@acars/shared';

interface Props {
  form: FlightPlanFormData;
  ofp: SimBriefOFP | null;
  aircraft: FleetAircraft | null;
  onClose: () => void;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-1 py-0.5 rounded-md text-[10px] text-acars-muted hover:text-acars-text hover:bg-acars-input transition-colors"
      title={`Copy ${label}`}
    >
      {copied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
    </button>
  );
}

export function VatsimPrefile({ form, ofp, aircraft, onClose }: Props) {
  const [fullCopied, setFullCopied] = useState(false);

  const equipmentString = useMemo(() => {
    if (!aircraft) return form.aircraftType || '????';
    const icao = aircraft.icaoType || form.aircraftType;
    const cat = aircraft.cat || 'M';
    const equip = aircraft.equipCode || 'SDE3FGHIRWXY';
    const xpdr = aircraft.transponderCode || 'LB1';
    return `${icao}/${cat}-${equip}/${xpdr}`;
  }, [aircraft, form.aircraftType]);

  const fields = useMemo(() => {
    const cruiseAlt = form.cruiseFL
      ? (form.cruiseFL.startsWith('FL') ? form.cruiseFL : `FL${form.cruiseFL}`)
      : ofp
        ? `FL${Math.round(ofp.cruiseAltitude / 100)}`
        : 'FL350';

    const cruiseTas = ofp
      ? `N${Math.round(ofp.steps?.[Math.floor(ofp.steps.length / 2)]?.oat ? 450 : 450)}`
      : 'N0450';

    const enrouteHrs = ofp ? Math.floor(ofp.times.estEnroute / 60) : 0;
    const enrouteMin = ofp ? ofp.times.estEnroute % 60 : 0;
    const enrouteStr = `${String(enrouteHrs).padStart(2, '0')}${String(enrouteMin).padStart(2, '0')}`;

    const fuelHrs = ofp ? Math.floor((ofp.fuel.totalLbs / (ofp.fuel.burnLbs / ofp.times.estEnroute * 60)) / 60) : 0;
    const fuelMin = ofp ? Math.floor((ofp.fuel.totalLbs / (ofp.fuel.burnLbs / ofp.times.estEnroute * 60)) % 60) : 0;
    const fuelStr = ofp ? `${String(Math.min(fuelHrs, 99)).padStart(2, '0')}${String(fuelMin).padStart(2, '0')}` : '0000';

    return {
      callsign: form.flightNumber || 'SMA001',
      flightRules: form.flightRules === 'VFR' ? 'V' : 'I',
      equipment: equipmentString,
      departure: form.origin || '????',
      depTime: (form.etd || '0000').replace(':', ''),
      cruiseSpeed: cruiseTas,
      cruiseAlt,
      route: form.route || ofp?.route || '',
      destination: form.destination || '????',
      enrouteTime: enrouteStr,
      alternate: form.alternate1 || ofp?.alternates?.[0]?.icao || '',
      alternate2: form.alternate2 || ofp?.alternates?.[1]?.icao || '',
      fuelEndurance: fuelStr,
      remarks: `PBN/${aircraft?.pbn || 'A1B1C1D1S2'} DOF/${new Date().toISOString().slice(0, 10).replace(/-/g, '')} RMK/TCAS`,
      pob: form.paxCount || '0',
    };
  }, [form, ofp, aircraft, equipmentString]);

  const fullPlan = useMemo(() => {
    const lines = [
      `(FPL-${fields.callsign}-${fields.flightRules}S`,
      `-${fields.equipment}`,
      `-${fields.departure}${fields.depTime}`,
      `-${fields.cruiseSpeed}${fields.cruiseAlt} ${fields.route}`,
      `-${fields.destination}${fields.enrouteTime} ${fields.alternate}${fields.alternate2 ? ` ${fields.alternate2}` : ''}`,
      `-${fields.remarks})`,
    ];
    return lines.join('\n');
  }, [fields]);

  const handleCopyFull = () => {
    navigator.clipboard.writeText(fullPlan).then(() => {
      setFullCopied(true);
      setTimeout(() => setFullCopied(false), 2000);
    });
  };

  const handleOpenMyVatsim = () => {
    window.open('https://my.vatsim.net/pilots/flightplan', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-acars-border bg-acars-bg">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[12px] font-semibold text-acars-text font-sans">VATSIM Flight Plan</span>
        </div>
        <button
          onClick={onClose}
          className="text-acars-muted hover:text-acars-text p-1 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Route summary */}
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="text-center">
            <div className="text-base font-bold font-mono text-acars-mono">{fields.departure}</div>
            <div className="text-[11px] text-acars-muted font-mono">{fields.depTime}z</div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-sky-400/50" />
          <div className="text-center">
            <div className="text-base font-bold font-mono text-acars-mono">{fields.destination}</div>
            <div className="text-[11px] text-acars-muted font-mono">{fields.enrouteTime} enr</div>
          </div>
        </div>

        {/* Field-by-field breakdown */}
        <div className="space-y-1">
          <FieldRow icon={<Plane className="w-3 h-3" />} label="Callsign" value={fields.callsign} />
          <FieldRow icon={<Navigation className="w-3 h-3" />} label="Equipment" value={fields.equipment} />
          <FieldRow icon={<Route className="w-3 h-3" />} label="Route" value={fields.route || '(direct)'} />
          <FieldRow icon={<ArrowRight className="w-3 h-3" />} label="Cruise" value={`${fields.cruiseSpeed} ${fields.cruiseAlt}`} />
          <FieldRow icon={<Clock className="w-3 h-3" />} label="Enroute" value={fields.enrouteTime} />
          <FieldRow icon={<Fuel className="w-3 h-3" />} label="Fuel Endurance" value={fields.fuelEndurance} />
          {fields.alternate && (
            <FieldRow icon={<Plane className="w-3 h-3" />} label="Alternate" value={`${fields.alternate}${fields.alternate2 ? ` / ${fields.alternate2}` : ''}`} />
          )}
        </div>

        {/* ICAO format preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="planning-label">ICAO Format</span>
          </div>
          <pre className="text-[11px] text-acars-mono font-mono bg-acars-input rounded-md border border-acars-border p-2 leading-relaxed whitespace-pre-wrap break-all">
            {fullPlan}
          </pre>
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 border-t border-acars-border space-y-1.5">
        <button
          onClick={handleOpenMyVatsim}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 text-[11px] font-semibold font-sans hover:bg-emerald-500/20 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Open myVATSIM Prefile
        </button>
        <button
          onClick={handleCopyFull}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md bg-acars-panel border border-acars-border text-[11px] font-medium font-sans text-acars-text hover:bg-acars-input transition-colors"
        >
          {fullCopied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              Copied to Clipboard
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy Flight Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function FieldRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-1 px-2 rounded-md hover:bg-acars-input/50 group">
      <span className="text-acars-muted mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-[0.08em] text-acars-muted font-sans">{label}</div>
        <div className="text-[12px] text-acars-mono font-mono truncate">{value}</div>
      </div>
      <CopyButton text={value} label={label} />
    </div>
  );
}
