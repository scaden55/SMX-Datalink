import { Badge } from '../common/Badge';

export function ScenarioBar() {
  return (
    <div className="border-b border-acars-border px-3 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-acars-muted mr-1">Flight Rules</span>
        <Badge variant="blue">R-121 DOM</Badge>
        <Badge variant="green">F-UA DOM</Badge>
        <Badge variant="magenta">RTE-FAA</Badge>
        <Badge variant="amber">A-8653</Badge>
        <Badge variant="blue">S-OPT-10</Badge>
      </div>
    </div>
  );
}
