import { Airplane, ClipboardText } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';

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

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/20">
          Approved
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/25 hover:bg-amber-500/20">
          Pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/15 text-red-500 border-red-500/25 hover:bg-red-500/20">
          Rejected
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
}

export function OperationsPanel({ activeFlights, pendingPireps, recentFlights }: OperationsPanelProps) {
  return (
    <div className="rounded-md bg-[#1c2033]/90 border border-border/50 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <h2 className="text-sm font-semibold">Operations</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Airplane size={14} weight="duotone" />
            <span className="font-mono font-medium text-foreground">{activeFlights}</span>
            <span>active</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClipboardText size={14} weight="duotone" />
            <span className="font-mono font-medium text-foreground">{pendingPireps}</span>
            <span>pending</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4">
        {recentFlights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent flights
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-xs">Flight</TableHead>
                <TableHead className="text-xs">Route</TableHead>
                <TableHead className="text-xs">Pilot</TableHead>
                <TableHead className="text-xs text-right">Ldg Rate</TableHead>
                <TableHead className="text-xs text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFlights.map((f) => (
                <TableRow key={f.id} className="border-border/30">
                  <TableCell className="font-mono font-medium text-xs py-2">
                    {f.flightNumber}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <span className="font-mono">{f.depIcao}</span>
                    <span className="text-muted-foreground mx-1">&rarr;</span>
                    <span className="font-mono">{f.arrIcao}</span>
                  </TableCell>
                  <TableCell className="text-xs py-2">{f.pilotCallsign}</TableCell>
                  <TableCell className="text-right font-mono text-xs py-2">
                    {f.landingRate !== null ? `${f.landingRate} fpm` : '--'}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {statusBadge(f.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
