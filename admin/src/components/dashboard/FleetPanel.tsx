import { HeartPulse, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

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
      return <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    default:
      return <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function healthBarColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export function FleetPanel({ fleetHealthPct, maintenanceAlerts }: FleetPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fleet Health</h2>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <HeartPulse size={12} className="text-emerald-400" />
          <span className="font-mono font-medium text-foreground">{fleetHealthPct}%</span>
        </div>
      </div>

      {/* Health progress bar */}
      <div className="mx-3 mb-3">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${healthBarColor(fleetHealthPct)}`}
            style={{ width: `${fleetHealthPct}%` }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Content */}
      <div className="p-3">
        {maintenanceAlerts.length === 0 ? (
          <div className="flex items-center gap-2 py-2 justify-center text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs">All aircraft operational</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {maintenanceAlerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded bg-white/[0.04] border border-white/[0.06] p-2"
              >
                {severityIcon(alert.severity)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-semibold">{alert.aircraftReg}</span>
                    <span className="text-[10px] text-muted-foreground">{alert.type}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
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
