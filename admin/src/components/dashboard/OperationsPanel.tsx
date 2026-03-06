import { Plane, ClipboardList, ArrowRight } from 'lucide-react';

interface RecentFlight {
  id: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  status: string;
  pilotCallsign: string;
  landingRate: number | null;
  createdAt: string;
}

interface OperationsPanelProps {
  activeFlights: number;
  pendingPireps: number;
  recentFlights: RecentFlight[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString('en', { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day}, ${time}`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25">
          Approved
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25">
          Pending
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 ring-1 ring-red-500/25">
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-muted-foreground ring-1 ring-white/10">
          {status}
        </span>
      );
  }
}

export function OperationsPanel({ activeFlights, pendingPireps, recentFlights }: OperationsPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Flights</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Plane size={12} className="text-blue-400" />
            <span className="font-mono font-medium text-foreground">{activeFlights}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ClipboardList size={12} className="text-amber-400" />
            <span className="font-mono font-medium text-foreground">{pendingPireps}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/30" />

      {/* Flight cards */}
      <div className="p-3 space-y-1.5">
        {recentFlights.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No recent flights
          </p>
        ) : (
          recentFlights.slice(0, 3).map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2.5 rounded bg-white/[0.04] border border-white/[0.06] px-2.5 py-2"
            >
              {/* Route */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-xs font-mono font-semibold text-foreground">{f.depIcao}</span>
                <ArrowRight size={10} className="text-muted-foreground shrink-0" />
                <span className="text-xs font-mono font-semibold text-foreground">{f.arrIcao}</span>
              </div>

              {/* Flight number */}
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{f.flightNumber}</span>

              {/* Status badge */}
              <div className="shrink-0">
                {statusBadge(f.status)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
