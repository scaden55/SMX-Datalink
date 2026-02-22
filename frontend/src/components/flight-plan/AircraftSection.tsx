import type { FlightPlanFormData } from '@acars/shared';

interface AircraftSectionProps {
  title: string;
  tailNumber: string;
  type: string;
  formData?: FlightPlanFormData | null;
}

interface LabeledInputProps {
  label: string;
  value: string;
  className?: string;
  wider?: boolean;
}

function LabeledInput({ label, value, className = '', wider }: LabeledInputProps) {
  return (
    <div className={`flex flex-col min-w-0 ${wider ? 'flex-[2]' : 'flex-1'} ${className}`}>
      <span className="text-[9px] font-sans text-[#656b75] mb-0.5">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full"
      />
    </div>
  );
}

export function AircraftSection({ title, tailNumber, type, formData }: AircraftSectionProps) {
  const cruiseFL = formData?.cruiseFL ?? '---';
  const costIdx = formData?.costIndex ?? '---';

  return (
    <div className="border-b border-acars-border px-3 py-2 space-y-2">
      {/* Row 1: Aircraft / Cruise / CI / AOB */}
      <div className="flex items-end gap-1.5">
        <LabeledInput label="Aircraft" value={`${tailNumber} (${type})`} wider />
        <LabeledInput label="Cruise" value={cruiseFL} />
        <LabeledInput label="CI Value" value={costIdx} />
        <LabeledInput label="AOB FL" value={cruiseFL} />
      </div>

      {/* Row 2: Pilot in Command */}
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-[9px] font-sans text-[#656b75] mb-0.5">Pilot in Command</span>
          <input
            type="text"
            readOnly
            value={title !== '---' ? `${title} | PIC | Left Seat` : '---'}
            className="bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate w-full"
          />
        </div>
      </div>
    </div>
  );
}
