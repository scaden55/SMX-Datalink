import { Badge } from '../common/Badge';
import type { FlightPlanFormData } from '@acars/shared';

interface ScenarioBarProps {
  formData?: FlightPlanFormData | null;
}

export function ScenarioBar({ formData }: ScenarioBarProps) {
  const flightRules = formData?.flightRules ?? 'IFR';
  const aircraftType = formData?.aircraftType ?? '---';
  const cruiseFL = formData?.cruiseFL ?? '---';

  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-acars-muted mr-1">Flight Rules</span>
        <Badge variant={flightRules === 'IFR' ? 'blue' : 'green'}>{flightRules}</Badge>
        <Badge variant="magenta">{aircraftType}</Badge>
        {cruiseFL !== '---' && <Badge variant="amber">{cruiseFL}</Badge>}
      </div>
    </div>
  );
}
