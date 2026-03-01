import { Heartbeat, Warning, WarningCircle, CheckCircle } from '@phosphor-icons/react';

interface MaintenanceAlert {
  type: string;
  aircraftReg: string;
  description: string;
  severity: string;
}

interface FleetPanelProps {
  fleetHealthPct: number;
  maintenanceAlerts: MaintenanceAlert[];
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <WarningCircle weight="fill" className="h-4 w-4 text-red-500 shrink-0" />;
    case 'warning':
      return <Warning weight="fill" className="h-4 w-4 text-amber-500 shrink-0" />;
    default:
      return <Warning weight="fill" className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function severityBorder(severity: string) {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-amber-500';
    default:
      return 'border-l-muted-foreground';
  }
}

export function FleetPanel({ fleetHealthPct, maintenanceAlerts }: FleetPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Fleet</h2>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Heartbeat size={14} weight="duotone" />
          <span className="font-mono font-medium text-foreground">{fleetHealthPct}%</span>
          <span>healthy</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {maintenanceAlerts.length === 0 ? (
          <div className="flex items-center gap-2 py-3 justify-center text-muted-foreground">
            <CheckCircle weight="fill" className="h-4 w-4 text-emerald-500" />
            <span className="text-xs">No active alerts</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {maintenanceAlerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 rounded border-l-2 bg-white/5 p-2.5 ${severityBorder(alert.severity)}`}
              >
                {severityIcon(alert.severity)}
                <div className="min-w-0">
                  <p className="text-xs font-medium font-mono">
                    {alert.aircraftReg}
                    <span className="ml-2 text-muted-foreground font-sans font-normal">
                      {alert.type}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
