import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Warning, WarningCircle, CheckCircle } from '@phosphor-icons/react';

interface MaintenanceAlert {
  type: string;
  aircraftReg: string;
  description: string;
  severity: string;
}

interface MaintenanceAlertsWidgetProps {
  alerts: MaintenanceAlert[];
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <WarningCircle weight="fill" className="h-5 w-5 text-red-500 shrink-0" />;
    case 'warning':
      return <Warning weight="fill" className="h-5 w-5 text-amber-500 shrink-0" />;
    default:
      return <Warning weight="fill" className="h-5 w-5 text-muted-foreground shrink-0" />;
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

export function MaintenanceAlertsWidget({ alerts }: MaintenanceAlertsWidgetProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Maintenance Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
            <CheckCircle weight="fill" className="h-5 w-5 text-emerald-500" />
            <span className="text-sm">No active alerts</span>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-md border-l-2 bg-secondary/50 p-3 ${severityBorder(alert.severity)}`}
              >
                {severityIcon(alert.severity)}
                <div className="min-w-0">
                  <p className="text-sm font-medium font-mono">
                    {alert.aircraftReg}
                    <span className="ml-2 text-muted-foreground font-sans font-normal">
                      {alert.type}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
