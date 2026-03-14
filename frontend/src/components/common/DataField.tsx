interface DataFieldProps {
  label: string;
  value: string | number | null;
  unit?: string;
  className?: string;
}

export function DataField({ label, value, unit, className = '' }: DataFieldProps) {
  return (
    <div className={className}>
      <div className="data-label">{label}</div>
      <div className="data-value">
        {value ?? '---'}
        {unit && value !== null && <span className="text-acars-muted ml-1 text-[11px]">{unit}</span>}
      </div>
    </div>
  );
}
