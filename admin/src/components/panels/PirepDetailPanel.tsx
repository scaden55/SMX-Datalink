import { useState } from 'react';
import {
  Plane,
  MapPin,
  Clock,
  Fuel,
  Package,
  Users as UsersIcon,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Star,
  Globe,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

// ── Types ───────────────────────────────────────────────────────

type LogbookStatus = 'pending' | 'approved' | 'completed' | 'diverted' | 'rejected' | 'cancelled';

interface PirepEntry {
  id: number;
  userId: number;
  flightNumber: string;
  depIcao: string;
  arrIcao: string;
  aircraftType: string;
  aircraftRegistration: string | null;
  scheduledDep: string | null;
  scheduledArr: string | null;
  actualDep: string;
  actualArr: string;
  flightTimeMin: number;
  distanceNm: number;
  fuelUsedLbs: number | null;
  fuelPlannedLbs: number | null;
  route: string | null;
  cruiseAltitude: string | null;
  paxCount: number;
  cargoLbs: number;
  landingRateFpm: number | null;
  score: number | null;
  status: LogbookStatus;
  remarks: string | null;
  createdAt: string;
  reviewerId: number | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewerCallsign: string | null;
  reviewerName: string | null;
  vatsimConnected: boolean;
  vatsimCallsign: string | null;
  vatsimCid: number | null;
  oooiOut: string | null;
  oooiOff: string | null;
  oooiOn: string | null;
  oooiIn: string | null;
  blockTimeMin: number | null;
  pilotCallsign?: string;
  pilotName?: string;
  depName?: string;
  arrName?: string;
}

interface PirepDetailPanelProps {
  pirep: PirepEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function landingRateColor(fpm: number | null): string {
  if (fpm === null) return 'text-muted-foreground';
  const abs = Math.abs(fpm);
  if (abs <= 200) return 'text-emerald-400';
  if (abs <= 400) return 'text-amber-400';
  return 'text-red-400';
}

function landingRateLabel(fpm: number | null): string {
  if (fpm === null) return 'N/A';
  const abs = Math.abs(fpm);
  if (abs <= 100) return 'Butter';
  if (abs <= 200) return 'Smooth';
  if (abs <= 300) return 'Normal';
  if (abs <= 400) return 'Firm';
  return 'Hard';
}

function statusBadge(status: LogbookStatus) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
          Pending
        </Badge>
      );
    case 'approved':
    case 'completed':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
          {status === 'approved' ? 'Approved' : 'Completed'}
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/20">
          Rejected
        </Badge>
      );
    case 'diverted':
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/20">
          Diverted
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Cancelled
        </Badge>
      );
  }
}

function scoreDisplay(score: number | null) {
  if (score === null) return <span className="text-muted-foreground">N/A</span>;
  let color = 'text-emerald-400';
  if (score < 60) color = 'text-red-400';
  else if (score < 80) color = 'text-amber-400';
  return <span className={`font-mono font-bold ${color}`}>{score}</span>;
}

// ── Detail Row ──────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{children}</span>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────

export function PirepDetailPanel({ pirep, open, onOpenChange, onReviewed }: PirepDetailPanelProps) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canReview = pirep?.status === 'pending';

  async function handleReview(status: 'approved' | 'rejected') {
    if (!pirep) return;
    setSubmitting(true);
    try {
      await api.post(`/api/admin/pireps/${pirep.id}/review`, {
        status,
        notes: notes.trim() || undefined,
      });
      toast.success(`PIREP ${pirep.flightNumber} ${status}`);
      setNotes('');
      onReviewed();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Failed to ${status} PIREP`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {pirep ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SheetTitle className="font-mono text-lg">
                  {pirep.flightNumber}
                </SheetTitle>
                {statusBadge(pirep.status)}
              </div>
              <SheetDescription>
                {pirep.pilotCallsign && (
                  <span className="font-mono">{pirep.pilotCallsign}</span>
                )}
                {pirep.pilotName && (
                  <span className="text-muted-foreground"> ({pirep.pilotName})</span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* ── Flight Info ─────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Plane size={14} />
                  Flight Info
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Route">
                    <span className="font-mono font-medium">
                      {pirep.depIcao} <span className="text-muted-foreground mx-1">&rarr;</span> {pirep.arrIcao}
                    </span>
                  </DetailRow>
                  {pirep.depName && pirep.arrName && (
                    <DetailRow label="Airports">
                      <span className="text-xs text-muted-foreground">
                        {pirep.depName} &mdash; {pirep.arrName}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="Aircraft">
                    <span className="font-mono">{pirep.aircraftType}</span>
                    {pirep.aircraftRegistration && (
                      <span className="text-muted-foreground ml-1">({pirep.aircraftRegistration})</span>
                    )}
                  </DetailRow>
                  {pirep.route && (
                    <DetailRow label="Route String">
                      <span className="text-xs font-mono break-all">{pirep.route}</span>
                    </DetailRow>
                  )}
                  {pirep.cruiseAltitude && (
                    <DetailRow label="Cruise Alt">
                      <span className="font-mono">{pirep.cruiseAltitude}</span>
                    </DetailRow>
                  )}
                  <DetailRow label="Filed">
                    {formatDate(pirep.createdAt)}
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* ── Performance ──────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ArrowDown size={14} />
                  Performance
                </h3>

                {/* Landing Rate - large display */}
                <div className="bg-muted/30 rounded-md p-4 mb-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Landing Rate</p>
                  <p className={`text-3xl font-mono font-bold ${landingRateColor(pirep.landingRateFpm)}`}>
                    {pirep.landingRateFpm !== null ? `${pirep.landingRateFpm} fpm` : 'N/A'}
                  </p>
                  <p className={`text-xs mt-1 ${landingRateColor(pirep.landingRateFpm)}`}>
                    {landingRateLabel(pirep.landingRateFpm)}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <DetailRow label="Flight Time">
                    <span className="font-mono flex items-center gap-1.5">
                      <Clock size={13} className="text-muted-foreground" />
                      {formatMinutes(pirep.flightTimeMin)}
                    </span>
                  </DetailRow>
                  {pirep.blockTimeMin !== null && (
                    <DetailRow label="Block Time">
                      <span className="font-mono">{formatMinutes(pirep.blockTimeMin)}</span>
                    </DetailRow>
                  )}
                  <DetailRow label="Distance">
                    <span className="font-mono flex items-center gap-1.5">
                      <MapPin size={13} className="text-muted-foreground" />
                      {pirep.distanceNm.toLocaleString()} nm
                    </span>
                  </DetailRow>
                </div>
              </section>

              <Separator />

              {/* ── Fuel ─────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Fuel size={14} />
                  Fuel
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Fuel Used">
                    <span className="font-mono">
                      {pirep.fuelUsedLbs !== null ? `${pirep.fuelUsedLbs.toLocaleString()} lbs` : 'N/A'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Fuel Planned">
                    <span className="font-mono">
                      {pirep.fuelPlannedLbs !== null ? `${pirep.fuelPlannedLbs.toLocaleString()} lbs` : 'N/A'}
                    </span>
                  </DetailRow>
                  {pirep.fuelUsedLbs !== null && pirep.fuelPlannedLbs !== null && pirep.fuelPlannedLbs > 0 && (
                    <DetailRow label="Fuel Variance">
                      <span className={`font-mono ${
                        pirep.fuelUsedLbs <= pirep.fuelPlannedLbs ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {pirep.fuelUsedLbs <= pirep.fuelPlannedLbs ? '-' : '+'}
                        {Math.abs(pirep.fuelUsedLbs - pirep.fuelPlannedLbs).toLocaleString()} lbs
                      </span>
                    </DetailRow>
                  )}
                </div>
              </section>

              <Separator />

              {/* ── Load ──────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package size={14} />
                  Load
                </h3>
                <div className="space-y-0.5">
                  <DetailRow label="Cargo">
                    <span className="font-mono">{pirep.cargoLbs.toLocaleString()} lbs</span>
                  </DetailRow>
                  <DetailRow label="Passengers">
                    <span className="font-mono flex items-center gap-1.5">
                      <UsersIcon size={13} className="text-muted-foreground" />
                      {pirep.paxCount}
                    </span>
                  </DetailRow>
                </div>
              </section>

              {/* ── Score ─────────────────────────────────────── */}
              {pirep.score !== null && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Star size={14} />
                      Score
                    </h3>
                    <div className="bg-muted/30 rounded-md p-4 text-center">
                      <p className="text-4xl font-mono font-bold">
                        {scoreDisplay(pirep.score)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">/ 100</p>
                    </div>
                  </section>
                </>
              )}

              {/* ── VATSIM ────────────────────────────────────── */}
              {pirep.vatsimConnected && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe size={14} />
                      VATSIM
                    </h3>
                    <div className="space-y-0.5">
                      {pirep.vatsimCallsign && (
                        <DetailRow label="Callsign">
                          <span className="font-mono">{pirep.vatsimCallsign}</span>
                        </DetailRow>
                      )}
                      {pirep.vatsimCid && (
                        <DetailRow label="CID">
                          <span className="font-mono">{pirep.vatsimCid}</span>
                        </DetailRow>
                      )}
                    </div>
                  </section>
                </>
              )}

              {/* ── OOOI Timestamps ───────────────────────────── */}
              {(pirep.oooiOut || pirep.oooiOff || pirep.oooiOn || pirep.oooiIn) && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Clock size={14} />
                      OOOI Timestamps
                    </h3>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        { label: 'OUT', value: pirep.oooiOut },
                        { label: 'OFF', value: pirep.oooiOff },
                        { label: 'ON', value: pirep.oooiOn },
                        { label: 'IN', value: pirep.oooiIn },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-muted/30 rounded-md p-2">
                          <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
                          <p className="text-xs font-mono mt-0.5">
                            {value
                              ? new Date(value).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '--:--'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

              {/* ── Remarks ───────────────────────────────────── */}
              {pirep.remarks && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Pilot Remarks
                    </h3>
                    <p className="text-sm bg-muted/30 rounded-md p-3">
                      {pirep.remarks}
                    </p>
                  </section>
                </>
              )}

              {/* ── Previous Review ───────────────────────────── */}
              {pirep.reviewedAt && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Review History
                    </h3>
                    <div className="bg-muted/30 rounded-md p-3 space-y-1">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Reviewed by </span>
                        <span className="font-mono font-medium">
                          {pirep.reviewerCallsign || 'Unknown'}
                        </span>
                        <span className="text-muted-foreground"> on </span>
                        {formatDate(pirep.reviewedAt)}
                      </p>
                      {pirep.reviewNotes && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {pirep.reviewNotes}
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}

              {/* ── Review Form ───────────────────────────────── */}
              {canReview && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Review
                    </h3>
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Admin notes (optional)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        disabled={submitting}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleReview('approved')}
                          disabled={submitting}
                        >
                          <CheckCircle2 size={16} />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleReview('rejected')}
                          disabled={submitting}
                        >
                          <XCircle size={16} />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </div>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle>PIREP Detail</SheetTitle>
            <SheetDescription>Select a PIREP to view details.</SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

export type { PirepEntry };
