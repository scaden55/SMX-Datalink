import type { FlightPlanFormData } from '@acars/shared';

interface NavProcedureRowProps {
  formData?: FlightPlanFormData | null;
}

interface DropdownFieldProps {
  label: string;
  value?: string;
  options?: string[];
  className?: string;
}

function DropdownField({ label, value = '---', options = [], className = '' }: DropdownFieldProps) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="text-[9px] font-sans text-[#656b75] mb-0.5">{label}</span>
      <select className="bg-acars-input border border-acars-border text-[11px] font-mono text-[#cdd1d8] rounded-md px-1.5 py-0.5 outline-none focus:border-blue-400 truncate">
        <option>{value}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function NavProcedureRow({ formData }: NavProcedureRowProps) {
  const alt1 = formData?.alternate1 || '---';
  const alt2 = formData?.alternate2 || '---';

  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-end gap-1.5">
        <DropdownField label="Runway" value="AUTO" className="flex-1" />
        <DropdownField label="SID" value="AUTO" className="flex-1" />
        <DropdownField label="STAR" value="AUTO" className="flex-1" />
        <DropdownField label="Runway" value="AUTO" className="flex-1" />
        <DropdownField label="Dest Alt 1" value={alt1} className="flex-1" />
        <DropdownField label="Dest Alt 2" value={alt2} className="flex-1" />
      </div>
    </div>
  );
}
