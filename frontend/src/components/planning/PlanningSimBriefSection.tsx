import { Cog } from 'lucide-react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useFlightPlanStore } from '../../stores/flightPlanStore';

export function PlanningSimBriefSection() {
  const { form, setFormField } = useFlightPlanStore();

  const labelClass = 'text-[9px] uppercase tracking-wider text-acars-muted font-medium mb-1 block';
  const selectClass = 'w-full rounded bg-acars-bg border border-acars-border text-acars-text text-[11px] px-2 py-1.5 outline-none focus:border-acars-blue transition-colors';
  const checkboxRow = 'flex items-center gap-2 text-[11px] text-acars-text';
  const checkboxClass = 'w-3.5 h-3.5 rounded border-acars-border bg-acars-bg accent-acars-blue';

  return (
    <CollapsibleSection title="Generation Options" icon={<Cog className="w-3.5 h-3.5" />} defaultOpen>
      <div className="space-y-3">
        {/* Row 1: Units, Cont Fuel, Reserve */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={labelClass}>Units</label>
            <select
              value={form.units}
              onChange={(e) => setFormField('units', e.target.value as 'LBS' | 'KGS')}
              className={selectClass}
            >
              <option value="LBS">LBS</option>
              <option value="KGS">KGS</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Cont Fuel</label>
            <select
              value={form.contpct}
              onChange={(e) => setFormField('contpct', e.target.value)}
              className={selectClass}
            >
              <option value="auto">AUTO</option>
              <option value="0">0%</option>
              <option value="0.02">2%</option>
              <option value="0.03">3%</option>
              <option value="0.05">5%</option>
              <option value="0.1">10%</option>
              <option value="0.15">15%</option>
              <option value="0.2">20%</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Reserve</label>
            <select
              value={form.resvrule}
              onChange={(e) => setFormField('resvrule', e.target.value)}
              className={selectClass}
            >
              <option value="auto">AUTO</option>
              <option value="0">0 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="75">75 min</option>
              <option value="90">90 min</option>
            </select>
          </div>
        </div>

        {/* Row 2: Plan Format, Maps */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>OFP Format</label>
            <select
              value={form.planformat}
              onChange={(e) => setFormField('planformat', e.target.value)}
              className={selectClass}
            >
              <option value="lido">LIDO</option>
              <option value="aal">AAL</option>
              <option value="baw">BAW</option>
              <option value="dal">DAL</option>
              <option value="ual">UAL</option>
              <option value="afl">AFL</option>
              <option value="klm">KLM</option>
              <option value="thy">THY</option>
              <option value="eia">EIA</option>
              <option value="volaris">Volaris</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Maps</label>
            <select
              value={form.maps}
              onChange={(e) => setFormField('maps', e.target.value as 'detail' | 'simple' | 'none')}
              className={selectClass}
            >
              <option value="detail">Detailed</option>
              <option value="simple">Simple</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>

        {/* Row 3: Toggles */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <label className={checkboxRow}>
            <input
              type="checkbox"
              checked={form.stepclimbs}
              onChange={(e) => setFormField('stepclimbs', e.target.checked)}
              className={checkboxClass}
            />
            Stepclimbs
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              checked={form.tlr}
              onChange={(e) => setFormField('tlr', e.target.checked)}
              className={checkboxClass}
            />
            Runway Analysis
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              checked={form.etops}
              onChange={(e) => setFormField('etops', e.target.checked)}
              className={checkboxClass}
            />
            ETOPS Planning
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              checked={form.inclNotams}
              onChange={(e) => setFormField('inclNotams', e.target.checked)}
              className={checkboxClass}
            />
            Include NOTAMs
          </label>
          <label className={checkboxRow}>
            <input
              type="checkbox"
              checked={form.firnot}
              onChange={(e) => setFormField('firnot', e.target.checked)}
              className={checkboxClass}
            />
            FIR NOTAMs
          </label>
        </div>
      </div>
    </CollapsibleSection>
  );
}
