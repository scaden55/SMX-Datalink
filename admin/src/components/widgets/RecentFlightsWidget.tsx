import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

interface RecentFlightsWidgetProps {
  flights: RecentFlight[];
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

export function RecentFlightsWidget({ flights }: RecentFlightsWidgetProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Flights</CardTitle>
      </CardHeader>
      <CardContent>
        {flights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent flights
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Flight #</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Pilot</TableHead>
                <TableHead className="text-right">Landing Rate</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flights.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono font-medium">
                    {f.flightNumber}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{f.depIcao}</span>
                    <span className="text-muted-foreground mx-1.5">&rarr;</span>
                    <span className="font-mono">{f.arrIcao}</span>
                  </TableCell>
                  <TableCell>{f.pilotCallsign}</TableCell>
                  <TableCell className="text-right font-mono">
                    {f.landingRate !== null
                      ? `${f.landingRate} fpm`
                      : '--'}
                  </TableCell>
                  <TableCell className="text-right">
                    {statusBadge(f.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
